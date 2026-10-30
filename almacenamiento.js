// ============================================================
// almacenamiento.js  -  El "archivero" de la tortillería
// ------------------------------------------------------------
// Este archivo es el ÚNICO que sabe dónde se guardan los datos
// (hoy: la memoria local del navegador). Las pantallas le piden
// guardar o leer, y no les importa cómo lo hace. Así, cuando
// pasemos al iPhone, solo hay que cambiar este archivo.
//
// Qué se guarda:
//   tortilleria:tiendas             -> lista de tiendas (datos maestros)
//   tortilleria:reparto:AAAA-MM-DD  -> un reparto por fecha (historial)
//   tortilleria:ultimoRespaldo      -> cuándo se descargó el último respaldo
//   tortilleria:rancho:AAAA-MM-DD   -> el rancho de cada fecha (con sus fiados)
//   tortilleria:personas            -> personas a quienes se fía (datos maestros)
//   tortilleria:preciosRancho       -> precios actuales del rancho
//   tortilleria:cobros              -> pagos recibidos de los fiados (por persona y fecha)
//   tortilleria:paralelo:AAAA-MM-DD -> lo que dice la libreta de cada día (prueba en paralelo)
//   tortilleria:cobrosTiendas       -> pagos recibidos de las tiendas con días sin cobrar
//   tortilleria:copiaPrevia         -> última copia completa, para poder deshacer (no va en el respaldo)
//
// Reglas de seguridad:
//   - Una fecha = un solo reparto (no se pueden duplicar días).
//   - Cada reparto guarda el precio de cada tienda DE ESE DÍA.
//   - Un reparto cerrado no se puede modificar sin reabrirlo.
//   - Después de escribir, se vuelve a leer para comprobar que
//     de verdad quedó guardado.
// ============================================================

const Almacen = {
  PREFIJO: "tortilleria:",
  _backend: null,

  // Para las pruebas: permite usar una memoria falsa en lugar de la real
  usarBackend(backend) { this._backend = backend; },
  _bk() { return this._backend || window.localStorage; },

  // ¿Este navegador puede guardar y leer datos?
  disponible() {
    try {
      const bk = this._bk();
      const clave = this.PREFIJO + "prueba";
      bk.setItem(clave, "1");
      const ok = bk.getItem(clave) === "1";
      bk.removeItem(clave);
      return ok;
    } catch (e) {
      return false;
    }
  },

  _leer(clave) {
    const texto = this._bk().getItem(this.PREFIJO + clave);
    if (texto === null) return null;
    try {
      return JSON.parse(texto);
    } catch (e) {
      throw new Error("Datos dañados en '" + clave + "'. No se modificó nada.");
    }
  },

  // Escribe y vuelve a leer para confirmar. Devuelve true o false.
  _escribir(clave, valor) {
    try {
      const texto = JSON.stringify(valor);
      const bk = this._bk();
      bk.setItem(this.PREFIJO + clave, texto);
      return bk.getItem(this.PREFIJO + clave) === texto;
    } catch (e) {
      return false;
    }
  },

  // ---------------- Tiendas (datos maestros) ----------------
  tiendasDeEjemplo() {
    const lista = [];
    for (let i = 1; i <= 15; i++) {
      lista.push({
        id: i,
        nombre: "Tienda " + i,
        precio: (i % 2 === 0 || i === 3) ? 18 : 17,
        activa: true,
        cobroQuincenal: false
      });
    }
    return lista;
  },

  obtenerTiendas() {
    let tiendas = this._leer("tiendas");
    if (tiendas === null) {
      tiendas = this.tiendasDeEjemplo();
      if (!this._escribir("tiendas", tiendas)) {
        throw new Error("No se pudo guardar la lista de tiendas.");
      }
    }
    return tiendas;
  },

  guardarTiendas(tiendas) {
    return this._escribir("tiendas", tiendas);
  },

  // ---------------- Repartos (historial) ----------------
  // Crea un reparto NUEVO (todavía sin guardar) copiando el precio
  // actual de cada tienda activa. Esa copia es el "precio del día".
  nuevoReparto(fecha, tiendas) {
    return {
      fecha: fecha,
      estado: "abierto",
      creadoEn: new Date().toISOString(),
      cerradoEn: null,
      lineas: tiendas.filter(function (t) { return t.activa; }).map(function (t) {
        return {
          tiendaId: t.id, nombre: t.nombre, precio: t.precio,
          entregados: "", extras: "", devoluciones: "", sobrantes: "",
          cobrar: !t.cobroQuincenal, cobrarManual: false
        };
      })
    };
  },

  obtenerReparto(fecha) {
    return this._leer("reparto:" + fecha);
  },

  // Guarda un reparto abierto. Devuelve true si quedó confirmado.
  guardarReparto(reparto) {
    const existente = this.obtenerReparto(reparto.fecha);
    if (existente && existente.estado === "cerrado") {
      throw new Error("Este reparto está cerrado. Reábrelo para modificarlo.");
    }
    return this._escribir("reparto:" + reparto.fecha, reparto);
  },

  // Fechas con reparto guardado, de la más reciente a la más antigua
  listarFechas() {
    const bk = this._bk();
    const prefijo = this.PREFIJO + "reparto:";
    const fechas = [];
    for (let i = 0; i < bk.length; i++) {
      const clave = bk.key(i);
      if (clave && clave.indexOf(prefijo) === 0) fechas.push(clave.substring(prefijo.length));
    }
    fechas.sort();
    fechas.reverse();
    return fechas;
  },

  // Resumen de cuentas de un reparto guardado
  resumenDe(reparto) {
    return Logica.resumirReparto(reparto.lineas.map(function (l) {
      return {
        precio: l.precio, entregados: l.entregados, sobrantes: l.sobrantes, activa: true,
        extras: l.extras, devoluciones: l.devoluciones, cobrar: l.cobrar
      };
    }));
  },

  // Cierra un reparto SOLO si está listo (sin errores y con datos)
  cerrarReparto(fecha) {
    const reparto = this.obtenerReparto(fecha);
    if (!reparto) throw new Error("No existe un reparto para esa fecha.");
    if (reparto.estado === "cerrado") return reparto;
    const resumen = this.resumenDe(reparto);
    if (resumen.estado !== "Listo para cerrar") {
      throw new Error("El reparto no está listo para cerrar: " + resumen.estado + ".");
    }
    reparto.estado = "cerrado";
    reparto.cerradoEn = new Date().toISOString();
    if (!this._escribir("reparto:" + fecha, reparto)) {
      throw new Error("No se pudo confirmar el cierre en el almacenamiento.");
    }
    return reparto;
  },

  reabrirReparto(fecha) {
    const reparto = this.obtenerReparto(fecha);
    if (!reparto) throw new Error("No existe un reparto para esa fecha.");
    const ranchoDelDia = this.obtenerRancho(fecha);
    if (ranchoDelDia && ranchoDelDia.estado === "cerrado") {
      throw new Error("Reabre primero el rancho de esa fecha: usa la fría de este reparto.");
    }
    reparto.estado = "abierto";
    reparto.cerradoEn = null;
    if (!this._escribir("reparto:" + fecha, reparto)) {
      throw new Error("No se pudo confirmar la reapertura en el almacenamiento.");
    }
    return reparto;
  },
  // ---------------- Tiendas: alta, edición y activar/desactivar ----------------
  // Las tiendas NUNCA se borran: se desactivan. Así el historial no se rompe.
  _validarNombre(nombre, tiendas, idPropio) {
    const limpio = String(nombre === undefined || nombre === null ? "" : nombre).trim();
    if (limpio === "") throw new Error("Escribe el nombre.");
    if (limpio.length > 40) throw new Error("El nombre es demasiado largo (máximo 40 letras).");
    const repetida = tiendas.some(function (t) {
      return t.id !== idPropio && t.nombre.toLowerCase() === limpio.toLowerCase();
    });
    if (repetida) throw new Error("Ya existe un registro con ese nombre.");
    return limpio;
  },

  _validarPrecio(precio) {
    if (!Logica.esNumero(precio)) throw new Error("El precio debe ser un número (usa punto para decimales).");
    const p = Logica.aNumero(precio);
    if (p <= 0) throw new Error("El precio debe ser mayor que 0.");
    if (p > 1000) throw new Error("El precio parece demasiado alto. Revísalo.");
    return Logica.redondear(p, 2);
  },

  _guardarTiendasOError(tiendas) {
    if (!this._escribir("tiendas", tiendas)) throw new Error("No se pudo guardar el cambio en las tiendas.");
  },

  agregarTienda(nombre, precio, cobroQuincenal) {
    const tiendas = this.obtenerTiendas();
    const limpio = this._validarNombre(nombre, tiendas, null);
    const p = this._validarPrecio(precio);
    const id = tiendas.reduce(function (m, t) { return Math.max(m, t.id); }, 0) + 1;
    const tienda = { id: id, nombre: limpio, precio: p, activa: true, cobroQuincenal: cobroQuincenal === true };
    tiendas.push(tienda);
    this._guardarTiendasOError(tiendas);
    return tienda;
  },

  editarTienda(id, nombre, precio, cobroQuincenal) {
    const tiendas = this.obtenerTiendas();
    const tienda = tiendas.find(function (t) { return t.id === id; });
    if (!tienda) throw new Error("No existe esa tienda.");
    tienda.nombre = this._validarNombre(nombre, tiendas, id);
    tienda.precio = this._validarPrecio(precio);
    if (typeof cobroQuincenal === "boolean") tienda.cobroQuincenal = cobroQuincenal;
    this._guardarTiendasOError(tiendas);
    return tienda;
  },

  establecerActiva(id, activa) {
    const tiendas = this.obtenerTiendas();
    const tienda = tiendas.find(function (t) { return t.id === id; });
    if (!tienda) throw new Error("No existe esa tienda.");
    tienda.activa = !!activa;
    this._guardarTiendasOError(tiendas);
    return tienda;
  },

  // Pone al día un reparto ABIERTO con la lista de tiendas actual.
  //  - Las filas SIN kilos capturados toman el precio y nombre actuales.
  //  - Las filas CON kilos conservan su precio.
  //  - Tiendas nuevas activas se agregan; desactivadas sin kilos se quitan.
  // Un reparto cerrado nunca se toca. Devuelve true si algo cambió.
  sincronizarConTiendas(reparto, tiendas) {
    if (reparto.estado === "cerrado") return false;
    const antes = JSON.stringify(reparto.lineas);
    const tieneDatos = function (l) {
      return !Logica.esVacio(l.entregados) || !Logica.esVacio(l.sobrantes) ||
        !Logica.esVacio(l.extras) || !Logica.esVacio(l.devoluciones);
    };
    const buscar = function (id) { return tiendas.find(function (t) { return t.id === id; }); };

    reparto.lineas = reparto.lineas.filter(function (l) {
      const t = buscar(l.tiendaId);
      return !(t && !t.activa && !tieneDatos(l));
    });
    reparto.lineas.forEach(function (l) {
      const t = buscar(l.tiendaId);
      if (t && !tieneDatos(l)) {
        l.precio = t.precio; l.nombre = t.nombre;
        if (!l.cobrarManual) l.cobrar = !t.cobroQuincenal;   // el check solo se pone al día si nadie lo movió a mano
      }
    });
    tiendas.filter(function (t) { return t.activa; }).forEach(function (t) {
      if (!reparto.lineas.some(function (l) { return l.tiendaId === t.id; })) {
        reparto.lineas.push({
          tiendaId: t.id, nombre: t.nombre, precio: t.precio,
          entregados: "", extras: "", devoluciones: "", sobrantes: "",
          cobrar: !t.cobroQuincenal, cobrarManual: false
        });
      }
    });
    reparto.lineas.sort(function (a, b) { return a.tiendaId - b.tiendaId; });
    return JSON.stringify(reparto.lineas) !== antes;
  },

  // ---------------- Personas (a quienes se fía en el rancho) ----------------
  obtenerPersonas() {
    const p = this._leer("personas");
    return p === null ? [] : p;
  },

  _guardarPersonas(lista) {
    if (!this._escribir("personas", lista)) throw new Error("No se pudo guardar el cambio en las personas.");
  },

  agregarPersona(nombre, precioFria) {
    const personas = this.obtenerPersonas();
    const limpio = this._validarNombre(nombre, personas, null);
    const precio = this._validarPrecio(precioFria);
    const id = personas.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1;
    const persona = { id: id, nombre: limpio, precioFria: precio, activa: true };
    personas.push(persona);
    this._guardarPersonas(personas);
    return persona;
  },

  editarPersona(id, nombre, precioFria) {
    const personas = this.obtenerPersonas();
    const persona = personas.find(function (x) { return x.id === id; });
    if (!persona) throw new Error("No existe esa persona.");
    persona.nombre = this._validarNombre(nombre, personas, id);
    persona.precioFria = this._validarPrecio(precioFria);
    this._guardarPersonas(personas);
    return persona;
  },

  establecerActivaPersona(id, activa) {
    const personas = this.obtenerPersonas();
    const persona = personas.find(function (x) { return x.id === id; });
    if (!persona) throw new Error("No existe esa persona.");
    persona.activa = !!activa;
    this._guardarPersonas(personas);
    return persona;
  },

  // ---------------- Rancho ----------------
  obtenerPreciosRancho() {
    const p = this._leer("preciosRancho");
    return p === null ? LogicaRancho.preciosPorDefecto() : p;
  },

  guardarPreciosRancho(precios) {
    const nuevo = {};
    const self = this;
    ["caliente", "masa", "friaA", "friaB"].forEach(function (k) { nuevo[k] = self._validarPrecio(precios[k]); });
    if (!this._escribir("preciosRancho", nuevo)) throw new Error("No se pudieron guardar los precios del rancho.");
    return nuevo;
  },

  // Rancho nuevo (todavía sin guardar) con los precios actuales como "precios del día"
  nuevoRancho(fecha) {
    const r = LogicaRancho.nuevoRancho(fecha, this.obtenerPreciosRancho());
    r.creadoEn = new Date().toISOString();
    r.cerradoEn = null;
    r.friaDeTiendas = null;
    return r;
  },

  obtenerRancho(fecha) {
    return this._leer("rancho:" + fecha);
  },

  guardarRancho(rancho) {
    const existente = this.obtenerRancho(rancho.fecha);
    if (existente && existente.estado === "cerrado") {
      throw new Error("Este rancho está cerrado. Reábrelo para modificarlo.");
    }
    return this._escribir("rancho:" + rancho.fecha, rancho);
  },

  listarFechasRancho() {
    const bk = this._bk();
    const prefijo = this.PREFIJO + "rancho:";
    const fechas = [];
    for (let i = 0; i < bk.length; i++) {
      const clave = bk.key(i);
      if (clave && clave.indexOf(prefijo) === 0) fechas.push(clave.substring(prefijo.length));
    }
    fechas.sort();
    fechas.reverse();
    return fechas;
  },

  hayDatosRancho(r) {
    const lleno = function (v) { return !Logica.esVacio(v); };
    return r.fiados.length > 0 ||
      lleno(r.caliente.llevados) || lleno(r.caliente.regresan) ||
      lleno(r.masa.llevados) || lleno(r.masa.regresan) ||
      lleno(r.fria.extra) || lleno(r.fria.regresan) || lleno(r.fria.contadoA) || lleno(r.fria.contadoB);
  },

  // Un rancho abierto y SIN datos toma los precios actuales. Con datos conserva los suyos.
  sincronizarRancho(rancho, precios) {
    if (rancho.estado === "cerrado" || this.hayDatosRancho(rancho)) return false;
    if (JSON.stringify(rancho.precios) === JSON.stringify(precios)) return false;
    rancho.precios = JSON.parse(JSON.stringify(precios));
    return true;
  },

  // Fría que se recogió ese día en las tiendas (viene del reparto de la misma fecha).
  // cerrado = true significa que la cifra ya es definitiva (o que no hubo reparto).
  friaDeTiendas(fecha) {
    const reparto = this.obtenerReparto(fecha);
    if (!reparto) return { kg: 0, hayReparto: false, cerrado: true };
    const resumen = this.resumenDe(reparto);
    if (reparto.estado !== "cerrado" && resumen.estado === "Sin datos") return { kg: 0, hayReparto: false, cerrado: true };
    return { kg: resumen.kgFrios, hayReparto: true, cerrado: reparto.estado === "cerrado" };
  },

  // La fría de tiendas que cuenta un rancho: la guardada si está cerrado, la actual si no
  friaUsada(rancho) {
    if (rancho.estado === "cerrado" && typeof rancho.friaDeTiendas === "number") return rancho.friaDeTiendas;
    return this.friaDeTiendas(rancho.fecha).kg;
  },

  resumenRancho(rancho) {
    return LogicaRancho.resumirRancho(rancho, this.friaUsada(rancho));
  },

  cerrarRancho(fecha) {
    const rancho = this.obtenerRancho(fecha);
    if (!rancho) throw new Error("No existe un rancho para esa fecha.");
    if (rancho.estado === "cerrado") return rancho;
    const fria = this.friaDeTiendas(fecha);
    if (!fria.cerrado) {
      throw new Error("Primero cierra el reparto de tiendas de esta fecha: la fría que se recogió ahí forma parte del rancho.");
    }
    const resumen = LogicaRancho.resumirRancho(rancho, fria.kg);
    if (resumen.estado !== "Listo para cerrar") {
      throw new Error("El rancho no está listo para cerrar: " + resumen.estado + ".");
    }
    rancho.estado = "cerrado";
    rancho.friaDeTiendas = fria.kg;
    rancho.cerradoEn = new Date().toISOString();
    if (!this._escribir("rancho:" + fecha, rancho)) {
      throw new Error("No se pudo confirmar el cierre del rancho en el almacenamiento.");
    }
    return rancho;
  },

  reabrirRancho(fecha) {
    const rancho = this.obtenerRancho(fecha);
    if (!rancho) throw new Error("No existe un rancho para esa fecha.");
    rancho.estado = "abierto";
    rancho.cerradoEn = null;
    rancho.friaDeTiendas = null;
    if (!this._escribir("rancho:" + fecha, rancho)) {
      throw new Error("No se pudo confirmar la reapertura del rancho en el almacenamiento.");
    }
    return rancho;
  },

  // Historial de fiados agrupado por persona (suma solo fiados válidos)
  fiadosPorPersona() {
    const self = this;
    const nombres = {};
    this.obtenerPersonas().forEach(function (p) { nombres[p.id] = p.nombre; });
    const mapa = {};
    this.listarFechasRancho().forEach(function (fecha) {
      const r = self.obtenerRancho(fecha);
      if (!r || !Array.isArray(r.fiados)) return;
      r.fiados.forEach(function (f) {
        if (LogicaRancho.validarFiado(f) !== "OK") return;
        const kg = Logica.aNumero(f.kg);
        const precio = Logica.aNumero(f.precio);
        const importe = Logica.redondear(kg * precio, 2);
        if (!mapa[f.personaId]) {
          mapa[f.personaId] = {
            personaId: f.personaId, nombre: nombres[f.personaId] || f.nombre,
            kgPorProducto: { caliente: 0, fria: 0, masa: 0 }, totalValor: 0, lineas: []
          };
        }
        const g = mapa[f.personaId];
        g.kgPorProducto[f.producto] += kg;
        g.totalValor += importe;
        g.lineas.push({ fecha: fecha, producto: f.producto, kg: kg, precio: precio, importe: importe, cerrado: r.estado === "cerrado" });
      });
    });
    const lista = Object.keys(mapa).map(function (k) { return mapa[k]; });
    lista.forEach(function (g) {
      Object.keys(g.kgPorProducto).forEach(function (k) { g.kgPorProducto[k] = Logica.redondear(g.kgPorProducto[k], 4); });
      g.totalValor = Logica.redondear(g.totalValor, 2);
      g.lineas.sort(function (a, b) { return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : 0); });
    });
    lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); });
    return lista;
  },

  // ---------------- Cobros y cuentas por persona ----------------
  _fechaValida(texto) {
    if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
    const p = texto.split("-").map(Number);
    const f = new Date(p[0], p[1] - 1, p[2]);
    return f.getFullYear() === p[0] && f.getMonth() === p[1] - 1 && f.getDate() === p[2];
  },

  obtenerCobros() {
    const c = this._leer("cobros");
    return c === null ? [] : c;
  },

  // Fiados de una persona: los de ranchos CERRADOS cuentan en su saldo;
  // los de ranchos abiertos se muestran aparte ("por confirmar").
  fiadosDePersona(personaId) {
    const self = this;
    const confirmados = [];
    const porConfirmar = [];
    this.listarFechasRancho().slice().reverse().forEach(function (fecha) {
      const r = self.obtenerRancho(fecha);
      if (!r || !Array.isArray(r.fiados)) return;
      r.fiados.forEach(function (f) {
        if (f.personaId !== personaId || LogicaRancho.validarFiado(f) !== "OK") return;
        const linea = { fecha: fecha, producto: f.producto, kg: f.kg, precio: f.precio, id: f.id };
        (r.estado === "cerrado" ? confirmados : porConfirmar).push(linea);
      });
    });
    return { confirmados: confirmados, porConfirmar: porConfirmar };
  },

  // Cuenta de una persona: sus fiados confirmados, sus cobros y el saldo
  cuentaDe(personaId, hoy) {
    const persona = this.obtenerPersonas().find(function (p) { return p.id === personaId; });
    if (!persona) throw new Error("No existe esa persona.");
    const fiados = this.fiadosDePersona(personaId);
    const cobros = this.obtenerCobros().filter(function (c) { return c.personaId === personaId; });
    const cuenta = LogicaCuentas.estadoDeCuenta(fiados.confirmados, cobros, hoy);
    const cobrosOrdenados = cobros.slice().sort(function (a, b) {
      return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : b.id - a.id);
    });
    return { persona: persona, cuenta: cuenta, porConfirmar: fiados.porConfirmar, cobros: cobrosOrdenados };
  },

  // Cuentas de todas las personas que alguna vez tuvieron fiados confirmados o cobros
  cuentasDePersonas(hoy) {
    const self = this;
    const cobros = this.obtenerCobros();
    return this.obtenerPersonas().map(function (p) {
      const f = self.fiadosDePersona(p.id);
      const misCobros = cobros.filter(function (c) { return c.personaId === p.id; });
      return { p: p, f: f, c: misCobros };
    }).filter(function (x) { return x.f.confirmados.length > 0 || x.c.length > 0; }).map(function (x) {
      return {
        personaId: x.p.id, nombre: x.p.nombre, activa: x.p.activa,
        cuenta: LogicaCuentas.estadoDeCuenta(x.f.confirmados, x.c, hoy),
        porConfirmar: x.f.porConfirmar.length
      };
    });
  },

  registrarCobro(personaId, fecha, monto, nota, hoy) {
    const persona = this.obtenerPersonas().find(function (p) { return p.id === personaId; });
    if (!persona) throw new Error("No existe esa persona.");
    if (!this._fechaValida(fecha)) throw new Error("La fecha del cobro no es válida.");
    const notaLimpia = String(nota === undefined || nota === null ? "" : nota).trim();
    if (notaLimpia.length > 80) throw new Error("La nota es demasiado larga (máximo 80 letras).");
    const saldo = this.cuentaDe(personaId, hoy || fecha).cuenta.saldo;
    const estado = LogicaCuentas.validarCobro(monto, saldo);
    if (estado === "El cobro supera el saldo pendiente") {
      throw new Error("El cobro supera el saldo pendiente (" + "$" + saldo.toFixed(2) + ").");
    }
    if (estado !== "OK") throw new Error(estado + ".");
    const cobros = this.obtenerCobros();
    const id = cobros.reduce(function (m, c) { return Math.max(m, c.id); }, 0) + 1;
    const cobro = { id: id, personaId: personaId, fecha: fecha, monto: Logica.redondear(Logica.aNumero(monto), 2), nota: notaLimpia };
    cobros.push(cobro);
    if (!this._escribir("cobros", cobros)) throw new Error("No se pudo guardar el cobro.");
    return cobro;
  },

  quitarCobro(id) {
    const cobros = this.obtenerCobros();
    const idx = cobros.findIndex(function (c) { return c.id === id; });
    if (idx < 0) throw new Error("No existe ese cobro.");
    cobros.splice(idx, 1);
    if (!this._escribir("cobros", cobros)) throw new Error("No se pudo quitar el cobro.");
  },

  // ---------------- Cuentas por cobrar de TIENDAS ----------------
  // Una tienda que ese día NO se cobra (cierra temprano o es de cobro quincenal)
  // va acumulando lo no cobrado, día por día. Su cuenta es un saldo en dinero:
  // lo no cobrado suma y lo que paga resta. Solo cuentan los repartos CERRADOS.
  obtenerCobrosTiendas() {
    const c = this._leer("cobrosTiendas");
    return c === null ? [] : c;
  },

  // Días sin cobrar de una tienda: cada uno con su detalle (mañana, extras, devoluciones, fría)
  cargosDeTienda(tiendaId) {
    const self = this;
    const n = function (v) { return Logica.esVacio(v) ? 0 : Logica.aNumero(v); };
    const confirmados = [];
    const porConfirmar = [];
    this.listarFechas().slice().reverse().forEach(function (fecha) {
      const r = self.obtenerReparto(fecha);
      if (!r || !Array.isArray(r.lineas)) return;
      r.lineas.forEach(function (l) {
        if (l.tiendaId !== tiendaId || l.cobrar !== false) return;
        const c = Logica.calcularLinea(l.precio, l.entregados, l.sobrantes, true, l.extras, l.devoluciones, l.cobrar);
        if (c.estado !== "OK") return;
        const linea = {
          fecha: fecha, producto: "caliente", kg: c.netos, precio: l.precio, id: 0,
          detalle: { manana: n(l.entregados), extras: n(l.extras), devoluciones: n(l.devoluciones), frios: n(l.sobrantes), entregados: c.entregadosTotal }
        };
        (r.estado === "cerrado" ? confirmados : porConfirmar).push(linea);
      });
    });
    return { confirmados: confirmados, porConfirmar: porConfirmar };
  },

  cuentaDeTienda(tiendaId, hoy) {
    const tienda = this.obtenerTiendas().find(function (t) { return t.id === tiendaId; });
    if (!tienda) throw new Error("No existe esa tienda.");
    const cargos = this.cargosDeTienda(tiendaId);
    const cobros = this.obtenerCobrosTiendas().filter(function (c) { return c.tiendaId === tiendaId; });
    const cuenta = LogicaCuentas.estadoDeCuenta(cargos.confirmados, cobros, hoy);
    const cobrosOrdenados = cobros.slice().sort(function (a, b) {
      return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : b.id - a.id);
    });
    return { tienda: tienda, cuenta: cuenta, porConfirmar: cargos.porConfirmar, cobros: cobrosOrdenados };
  },

  // Cuentas de todas las tiendas que alguna vez tuvieron días sin cobrar o pagos
  cuentasDeTiendas(hoy) {
    const self = this;
    const cobros = this.obtenerCobrosTiendas();
    return this.obtenerTiendas().map(function (t) {
      return { t: t, c: self.cargosDeTienda(t.id), p: cobros.filter(function (x) { return x.tiendaId === t.id; }) };
    }).filter(function (x) { return x.c.confirmados.length > 0 || x.p.length > 0; }).map(function (x) {
      return {
        personaId: x.t.id, tiendaId: x.t.id, nombre: x.t.nombre, activa: x.t.activa, cobroQuincenal: !!x.t.cobroQuincenal,
        cuenta: LogicaCuentas.estadoDeCuenta(x.c.confirmados, x.p, hoy),
        porConfirmar: x.c.porConfirmar.length
      };
    });
  },

  registrarCobroTienda(tiendaId, fecha, monto, nota, hoy) {
    const tienda = this.obtenerTiendas().find(function (t) { return t.id === tiendaId; });
    if (!tienda) throw new Error("No existe esa tienda.");
    if (!this._fechaValida(fecha)) throw new Error("La fecha del cobro no es válida.");
    const notaLimpia = String(nota === undefined || nota === null ? "" : nota).trim();
    if (notaLimpia.length > 80) throw new Error("La nota es demasiado larga (máximo 80 letras).");
    const saldo = this.cuentaDeTienda(tiendaId, hoy || fecha).cuenta.saldo;
    const estado = LogicaCuentas.validarCobro(monto, saldo);
    if (estado === "El cobro supera el saldo pendiente") {
      throw new Error("El cobro supera el saldo pendiente ($" + saldo.toFixed(2) + ").");
    }
    if (estado !== "OK") throw new Error(estado + ".");
    const cobros = this.obtenerCobrosTiendas();
    const id = cobros.reduce(function (m, c) { return Math.max(m, c.id); }, 0) + 1;
    const cobro = { id: id, tiendaId: tiendaId, fecha: fecha, monto: Logica.redondear(Logica.aNumero(monto), 2), nota: notaLimpia };
    cobros.push(cobro);
    if (!this._escribir("cobrosTiendas", cobros)) throw new Error("No se pudo guardar el cobro.");
    return cobro;
  },

  quitarCobroTienda(id) {
    const cobros = this.obtenerCobrosTiendas();
    const idx = cobros.findIndex(function (c) { return c.id === id; });
    if (idx < 0) throw new Error("No existe ese cobro.");
    cobros.splice(idx, 1);
    if (!this._escribir("cobrosTiendas", cobros)) throw new Error("No se pudo quitar el cobro.");
  },

  // ---------------- Valores de un día (tiendas y rancho) ----------------
  valoresDelDia(fecha) {
    let tiendas = { existe: false, cerrado: true, total: 0, kgFrios: 0 };
    let rancho = { existe: false, cerrado: true, total: 0, fiado: 0 };
    const rep = this.obtenerReparto(fecha);
    if (rep) {
      const r = this.resumenDe(rep);
      if (rep.estado === "cerrado" || r.estado !== "Sin datos") {
        tiendas = { existe: true, cerrado: rep.estado === "cerrado", total: r.total, kgFrios: r.kgFrios, kgEntregados: r.kgEntregados, noCobrado: r.totalNoCobrado };
      }
    }
    const ran = this.obtenerRancho(fecha);
    if (ran) {
      const r = this.resumenRancho(ran);
      if (ran.estado === "cerrado" || r.estado !== "Sin datos") {
        rancho = { existe: true, cerrado: ran.estado === "cerrado", total: r.dineroRancho, fiado: r.fiadoPorCobrar };
      }
    }
    return { tiendas: tiendas, rancho: rancho };
  },

  // ---------------- Prueba en paralelo con la libreta ----------------
  valoresApp(fecha) {
    const v = this.valoresDelDia(fecha);
    return { tiendas: v.tiendas.total, frios: v.tiendas.kgFrios, rancho: v.rancho.total, fiado: v.rancho.fiado };
  },

  // Guarda lo que dice la libreta de un día. Solo se puede comparar un día ya cerrado.
  guardarParalelo(fecha, libreta, nota) {
    if (!this._fechaValida(fecha)) throw new Error("La fecha no es válida.");
    const v = this.valoresDelDia(fecha);
    if (!v.tiendas.existe && !v.rancho.existe) throw new Error("Ese día no tiene datos en la app para comparar.");
    if (!(v.tiendas.cerrado && v.rancho.cerrado)) {
      throw new Error("Primero cierra el reparto de tiendas y el rancho de esa fecha.");
    }
    const notaLimpia = String(nota === undefined || nota === null ? "" : nota).trim();
    if (notaLimpia.length > 120) throw new Error("La nota es demasiado larga (máximo 120 letras).");
    const cmp = LogicaParalelo.comparar(this.valoresApp(fecha), libreta);
    const malo = cmp.campos.find(function (c) { return c.estado !== "OK" && c.estado !== "Sin dato"; });
    if (malo) throw new Error(malo.etiqueta + ": " + malo.estado + ".");
    const num = function (v2) { return Logica.esVacio(v2) ? null : Logica.aNumero(v2); };
    const registro = {
      fecha: fecha,
      libreta: { tiendas: num(libreta.tiendas), frios: num(libreta.frios), rancho: num(libreta.rancho), fiado: num(libreta.fiado) },
      nota: notaLimpia,
      guardadoEn: new Date().toISOString()
    };
    if (!this._escribir("paralelo:" + fecha, registro)) throw new Error("No se pudo guardar la comparación.");
    return registro;
  },

  obtenerParalelo(fecha) {
    return this._leer("paralelo:" + fecha);
  },

  quitarParalelo(fecha) {
    this._bk().removeItem(this.PREFIJO + "paralelo:" + fecha);
  },

  // Comparaciones guardadas, de la fecha más reciente a la más antigua
  listarParalelo() {
    const bk = this._bk();
    const prefijo = this.PREFIJO + "paralelo:";
    const fechas = [];
    for (let i = 0; i < bk.length; i++) {
      const clave = bk.key(i);
      if (clave && clave.indexOf(prefijo) === 0) fechas.push(clave.substring(prefijo.length));
    }
    fechas.sort();
    fechas.reverse();
    const self = this;
    return fechas.map(function (f) { return self.obtenerParalelo(f); }).filter(function (r) { return r; });
  },

  // Compara lo guardado de la libreta contra lo que calcula la app AHORA
  evaluarParalelo(fecha) {
    const registro = this.obtenerParalelo(fecha);
    if (!registro) return null;
    const v = this.valoresDelDia(fecha);
    const pendiente = !(v.tiendas.cerrado && v.rancho.cerrado) || (!v.tiendas.existe && !v.rancho.existe);
    const comparacion = LogicaParalelo.comparar(this.valoresApp(fecha), registro.libreta);
    return {
      fecha: fecha, registro: registro, comparacion: comparacion,
      estado: pendiente ? "pendiente" : (comparacion.coincide ? "coincide" : "diferencia")
    };
  },

  resumenParalelo() {
    const self = this;
    const evaluaciones = this.listarParalelo().map(function (r) { return self.evaluarParalelo(r.fecha); });
    const resumen = LogicaParalelo.resumir(evaluaciones);
    resumen.evaluaciones = evaluaciones;
    return resumen;
  },

  aCSVParalelo() {
    const self = this;
    const filas = [["fecha", "estado",
      "libreta_tiendas", "app_tiendas", "dif_tiendas",
      "libreta_frios_kg", "app_frios_kg", "dif_frios_kg",
      "libreta_rancho", "app_rancho", "dif_rancho",
      "libreta_fiado", "app_fiado", "dif_fiado", "nota"]];
    this.listarParalelo().slice().reverse().forEach(function (r) {
      const e = self.evaluarParalelo(r.fecha);
      const fila = [r.fecha, e.estado];
      e.comparacion.campos.forEach(function (c) {
        fila.push(c.libreta === null ? "" : c.libreta, c.app, c.diferencia === null ? "" : c.diferencia);
      });
      fila.push(r.nota || "");
      filas.push(fila);
    });
    return "\uFEFF" + filas.map(function (f) { return f.map(function (c) { return self._celdaCSV(c); }).join(","); }).join("\r\n") + "\r\n";
  },

  // Borra el HISTORIAL (repartos, ranchos, cobros, cobros de tiendas y comparaciones con la libreta).
  // Conserva tiendas, personas, precios del rancho y la fecha del último respaldo.
  // Devuelve cuántos registros se borraron.
  borrarHistorial() {
    const bk = this._bk();
    const claves = [];
    for (let i = 0; i < bk.length; i++) {
      const k = bk.key(i);
      if (!k || k.indexOf(this.PREFIJO) !== 0) continue;
      const resto = k.substring(this.PREFIJO.length);
      if (resto.indexOf("reparto:") === 0 || resto.indexOf("rancho:") === 0 || resto.indexOf("paralelo:") === 0 || resto === "cobros" || resto === "cobrosTiendas") {
        claves.push(k);
      }
    }
    claves.forEach(function (k) { bk.removeItem(k); });
    return claves.length;
  },

  // ---------------- Copia para deshacer ----------------
  // Antes de una acción que reemplaza o borra datos (restaurar un respaldo,
  // borrar el historial) se guarda aquí una copia COMPLETA de lo que había,
  // dentro de la propia app. Sirve para poder volver atrás, también en el
  // iPhone, donde descargar un archivo no siempre es posible. Solo se guarda
  // la última copia. No forma parte del respaldo.
  guardarCopiaPrevia(motivo) {
    try {
      const copia = {
        guardadoEn: new Date().toISOString(),
        motivo: String(motivo || ""),
        datos: this.exportarTodo(),
        paralelo: this.listarParalelo()
      };
      return this._escribir("copiaPrevia", copia);
    } catch (e) {
      return false;
    }
  },

  obtenerCopiaPrevia() {
    try { return this._leer("copiaPrevia"); } catch (e) { return null; }
  },

  // Vuelve a como estaban los datos cuando se guardó la copia
  deshacerCopiaPrevia() {
    const copia = this.obtenerCopiaPrevia();
    if (!copia || !copia.datos) throw new Error("No hay ninguna copia para deshacer.");
    // Antes de volver atrás, se toma una copia de lo de ahora (por si hay que volver a deshacer)
    const actual = {
      guardadoEn: new Date().toISOString(), motivo: "antes de deshacer",
      datos: this.exportarTodo(), paralelo: this.listarParalelo()
    };
    this.restaurarTodo(copia.datos);
    // Las comparaciones con la libreta no van en el respaldo: se devuelven aparte
    const bk = this._bk();
    const viejas = [];
    for (let i = 0; i < bk.length; i++) {
      const k = bk.key(i);
      if (k && k.indexOf(this.PREFIJO + "paralelo:") === 0) viejas.push(k);
    }
    viejas.forEach(function (k) { bk.removeItem(k); });
    const self = this;
    (copia.paralelo || []).forEach(function (r) { self._escribir("paralelo:" + r.fecha, r); });
    this._escribir("copiaPrevia", actual);
    return { motivo: copia.motivo, guardadoEn: copia.guardadoEn };
  },

  // ---------------- Respaldo ----------------
  marcarRespaldoHecho() {
    return this._escribir("ultimoRespaldo", new Date().toISOString());
  },

  obtenerUltimoRespaldo() {
    try { return this._leer("ultimoRespaldo"); } catch (e) { return null; }
  },

  // Junta TODO (tiendas, repartos, personas y ranchos) en un solo objeto para guardarlo en un archivo
  exportarTodo() {
    const self = this;
    const repartos = {};
    this.listarFechas().forEach(function (fecha) {
      const r = self.obtenerReparto(fecha);
      if (!r) return;
      if (r.estado !== "cerrado" && self.resumenDe(r).estado === "Sin datos") return;
      repartos[fecha] = r;
    });
    const ranchos = {};
    this.listarFechasRancho().forEach(function (fecha) {
      const r = self.obtenerRancho(fecha);
      if (!r) return;
      if (r.estado !== "cerrado" && !self.hayDatosRancho(r)) return;
      ranchos[fecha] = r;
    });
    return {
      aplicacion: "tortilleria",
      version: 4,
      exportadoEn: new Date().toISOString(),
      tiendas: this.obtenerTiendas(),
      repartos: repartos,
      personas: this.obtenerPersonas(),
      preciosRancho: this.obtenerPreciosRancho(),
      ranchos: ranchos,
      cobros: this.obtenerCobros(),
      cobrosTiendas: this.obtenerCobrosTiendas()
    };
  },

  // Revisa que un respaldo tenga forma correcta ANTES de tocar nada
  validarRespaldo(datos) {
    const malo = function (texto) { throw new Error("Respaldo no válido: " + texto); };
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) malo("el archivo no tiene el formato esperado.");
    if (datos.aplicacion !== "tortilleria") malo("no es un respaldo de esta aplicación.");
    if (datos.version !== 1 && datos.version !== 2 && datos.version !== 3 && datos.version !== 4) malo("la versión del respaldo (" + datos.version + ") no es compatible.");
    if (!Array.isArray(datos.tiendas) || datos.tiendas.length === 0) malo("no trae la lista de tiendas.");
    if (!datos.repartos || typeof datos.repartos !== "object" || Array.isArray(datos.repartos)) malo("no trae los repartos.");

    const ids = {};
    datos.tiendas.forEach(function (t) {
      if (!t || !Number.isInteger(t.id) || t.id <= 0) malo("una tienda tiene un identificador incorrecto.");
      if (ids[t.id]) malo("hay dos tiendas con el mismo identificador (" + t.id + ").");
      ids[t.id] = true;
      if (typeof t.nombre !== "string" || t.nombre.trim() === "") malo("una tienda no tiene nombre.");
      if (typeof t.precio !== "number" || !Number.isFinite(t.precio) || t.precio <= 0) malo("la tienda '" + t.nombre + "' tiene un precio incorrecto.");
      if (typeof t.activa !== "boolean") malo("la tienda '" + t.nombre + "' no indica si está activa.");
      if (t.cobroQuincenal !== undefined && typeof t.cobroQuincenal !== "boolean") malo("la tienda '" + t.nombre + "' tiene un dato de cobro ilegible.");
    });

    const self = this;
    Object.keys(datos.repartos).forEach(function (fecha) {
      const r = datos.repartos[fecha];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) malo("fecha incorrecta '" + fecha + "'.");
      const partes = fecha.split("-").map(Number);
      const f = new Date(partes[0], partes[1] - 1, partes[2]);
      if (f.getFullYear() !== partes[0] || f.getMonth() !== partes[1] - 1 || f.getDate() !== partes[2]) malo("la fecha '" + fecha + "' no existe.");
      if (!r || r.fecha !== fecha) malo("el reparto de '" + fecha + "' no coincide con su fecha.");
      if (r.estado !== "abierto" && r.estado !== "cerrado") malo("el reparto de " + fecha + " tiene un estado desconocido.");
      if (!Array.isArray(r.lineas)) malo("el reparto de " + fecha + " no trae sus filas.");
      r.lineas.forEach(function (l) {
        if (!l || !Number.isInteger(l.tiendaId)) malo("una fila del " + fecha + " no tiene tienda.");
        if (typeof l.nombre !== "string") malo("una fila del " + fecha + " no tiene nombre de tienda.");
        if (typeof l.precio !== "number" || !Number.isFinite(l.precio) || l.precio <= 0) malo("una fila del " + fecha + " tiene precio incorrecto.");
        ["entregados", "sobrantes"].forEach(function (campo) {
          const v = l[campo];
          if (typeof v !== "string" && typeof v !== "number") malo("una fila del " + fecha + " tiene un kilo ilegible.");
        });
        ["extras", "devoluciones"].forEach(function (campo) {
          const v = l[campo];
          if (v !== undefined && typeof v !== "string" && typeof v !== "number") malo("una fila del " + fecha + " tiene un kilo ilegible.");
        });
        ["cobrar", "cobrarManual"].forEach(function (campo) {
          if (l[campo] !== undefined && typeof l[campo] !== "boolean") malo("una fila del " + fecha + " tiene un dato de cobro ilegible.");
        });
      });
      if (r.estado === "cerrado" && self.resumenDe(r).estado !== "Listo para cerrar") {
        malo("el reparto del " + fecha + " figura como cerrado pero tiene datos incorrectos.");
      }
    });
    if (datos.version >= 2) self._validarParteRancho(datos, malo);
  },

  // Revisa personas, precios y ranchos de un respaldo versión 2
  _validarParteRancho(datos, malo) {
    const esKilo = function (v) { return typeof v === "string" || typeof v === "number"; };
    const precioOk = function (v) { return typeof v === "number" && Number.isFinite(v) && v > 0; };

    if (!Array.isArray(datos.personas)) malo("no trae la lista de personas.");
    const idsPersonas = {};
    datos.personas.forEach(function (p) {
      if (!p || !Number.isInteger(p.id) || p.id <= 0) malo("una persona tiene un identificador incorrecto.");
      if (idsPersonas[p.id]) malo("hay dos personas con el mismo identificador (" + p.id + ").");
      idsPersonas[p.id] = true;
      if (typeof p.nombre !== "string" || p.nombre.trim() === "") malo("una persona no tiene nombre.");
      if (!precioOk(p.precioFria)) malo("la persona '" + p.nombre + "' tiene un precio de fría incorrecto.");
      if (typeof p.activa !== "boolean") malo("la persona '" + p.nombre + "' no indica si está activa.");
    });

    const pr = datos.preciosRancho;
    if (!pr || typeof pr !== "object") malo("no trae los precios del rancho.");
    ["caliente", "masa", "friaA", "friaB"].forEach(function (k) {
      if (!precioOk(pr[k])) malo("el precio del rancho '" + k + "' es incorrecto.");
    });

    if (!datos.ranchos || typeof datos.ranchos !== "object" || Array.isArray(datos.ranchos)) malo("no trae los ranchos.");
    Object.keys(datos.ranchos).forEach(function (fecha) {
      const r = datos.ranchos[fecha];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) malo("fecha de rancho incorrecta '" + fecha + "'.");
      const partes = fecha.split("-").map(Number);
      const f = new Date(partes[0], partes[1] - 1, partes[2]);
      if (f.getFullYear() !== partes[0] || f.getMonth() !== partes[1] - 1 || f.getDate() !== partes[2]) malo("la fecha de rancho '" + fecha + "' no existe.");
      if (!r || r.fecha !== fecha) malo("el rancho de '" + fecha + "' no coincide con su fecha.");
      if (r.estado !== "abierto" && r.estado !== "cerrado") malo("el rancho de " + fecha + " tiene un estado desconocido.");
      if (!r.precios || !["caliente", "masa", "friaA", "friaB"].every(function (k) { return precioOk(r.precios[k]); })) malo("el rancho de " + fecha + " tiene precios incorrectos.");
      const bloques = { caliente: ["llevados", "regresan"], masa: ["llevados", "regresan"], fria: ["extra", "regresan", "contadoA", "contadoB"] };
      Object.keys(bloques).forEach(function (b) {
        if (!r[b] || typeof r[b] !== "object") malo("al rancho de " + fecha + " le falta '" + b + "'.");
        bloques[b].forEach(function (c) {
          if (!esKilo(r[b][c])) malo("el rancho de " + fecha + " tiene un kilo ilegible en " + b + ".");
        });
      });
      if (!Array.isArray(r.fiados)) malo("el rancho de " + fecha + " no trae sus fiados.");
      r.fiados.forEach(function (f2) {
        if (!f2 || !Number.isInteger(f2.personaId)) malo("un fiado del " + fecha + " no tiene persona.");
        if (!idsPersonas[f2.personaId]) malo("un fiado del " + fecha + " menciona a una persona que no está en la lista.");
        if (typeof f2.nombre !== "string" || typeof f2.producto !== "string") malo("un fiado del " + fecha + " está incompleto.");
        if (!esKilo(f2.kg) || !esKilo(f2.precio)) malo("un fiado del " + fecha + " tiene kilos o precio ilegibles.");
      });
      if (r.estado === "cerrado") {
        if (typeof r.friaDeTiendas !== "number" || !Number.isFinite(r.friaDeTiendas) || r.friaDeTiendas < 0) malo("el rancho cerrado del " + fecha + " no trae su fría de tiendas.");
        if (LogicaRancho.resumirRancho(r, r.friaDeTiendas).estado !== "Listo para cerrar") {
          malo("el rancho del " + fecha + " figura como cerrado pero tiene datos incorrectos.");
        }
      }
    });

    if (datos.version >= 3) {
      if (!Array.isArray(datos.cobros)) malo("no trae los cobros.");
      const idsCobros = {};
      const self2 = this;
      datos.cobros.forEach(function (c) {
        if (!c || !Number.isInteger(c.id) || c.id <= 0) malo("un cobro tiene un identificador incorrecto.");
        if (idsCobros[c.id]) malo("hay dos cobros con el mismo identificador (" + c.id + ").");
        idsCobros[c.id] = true;
        if (!Number.isInteger(c.personaId) || !idsPersonas[c.personaId]) malo("un cobro menciona a una persona que no está en la lista.");
        if (!self2._fechaValida(c.fecha)) malo("un cobro tiene una fecha incorrecta.");
        if (typeof c.monto !== "number" || !Number.isFinite(c.monto) || c.monto <= 0) malo("un cobro tiene un monto incorrecto.");
        if (c.nota !== undefined && typeof c.nota !== "string") malo("un cobro tiene una nota ilegible.");
      });
    }

    if (datos.version >= 4) {
      if (!Array.isArray(datos.cobrosTiendas)) malo("no trae los cobros de tiendas.");
      const idsTiendas = {};
      datos.tiendas.forEach(function (t) { idsTiendas[t.id] = true; });
      const idsCT = {};
      const self3 = this;
      datos.cobrosTiendas.forEach(function (c) {
        if (!c || !Number.isInteger(c.id) || c.id <= 0) malo("un cobro de tienda tiene un identificador incorrecto.");
        if (idsCT[c.id]) malo("hay dos cobros de tienda con el mismo identificador (" + c.id + ").");
        idsCT[c.id] = true;
        if (!Number.isInteger(c.tiendaId) || !idsTiendas[c.tiendaId]) malo("un cobro de tienda menciona una tienda que no está en la lista.");
        if (!self3._fechaValida(c.fecha)) malo("un cobro de tienda tiene una fecha incorrecta.");
        if (typeof c.monto !== "number" || !Number.isFinite(c.monto) || c.monto <= 0) malo("un cobro de tienda tiene un monto incorrecto.");
        if (c.nota !== undefined && typeof c.nota !== "string") malo("un cobro de tienda tiene una nota ilegible.");
      });
    }
  },

  // Reemplaza TODOS los datos por los del respaldo. Si algo falla a medias,
  // devuelve todo a como estaba. (Un respaldo versión 1 es anterior al rancho:
  // al restaurarlo, el rancho y las personas quedan vacíos.)
  restaurarTodo(datos) {
    this.validarRespaldo(datos);
    const bk = this._bk();
    const self = this;
    const v2 = datos.version >= 2;
    const cobros = datos.version >= 3 ? datos.cobros : [];
    const cobrosTiendas = datos.version >= 4 ? datos.cobrosTiendas : [];
    const personas = v2 ? datos.personas : [];
    const preciosRancho = v2 ? datos.preciosRancho : LogicaRancho.preciosPorDefecto();
    const ranchos = v2 ? datos.ranchos : {};

    // Foto de lo que hay ahora, por si hay que deshacer
    const foto = {};
    const claves = [];
    for (let i = 0; i < bk.length; i++) {
      const k = bk.key(i);
      if (k && k.indexOf(this.PREFIJO) === 0) claves.push(k);
    }
    claves.forEach(function (k) { foto[k] = bk.getItem(k); });

    const deshacer = function () {
      const actuales = [];
      for (let i = 0; i < bk.length; i++) {
        const k = bk.key(i);
        if (k && k.indexOf(self.PREFIJO) === 0) actuales.push(k);
      }
      actuales.forEach(function (k) { bk.removeItem(k); });
      Object.keys(foto).forEach(function (k) { bk.setItem(k, foto[k]); });
    };

    try {
      claves.forEach(function (k) {
        const quitar = k.indexOf(self.PREFIJO + "reparto:") === 0 || k.indexOf(self.PREFIJO + "rancho:") === 0 ||
          k === self.PREFIJO + "personas" || k === self.PREFIJO + "preciosRancho" || k === self.PREFIJO + "cobros" || k === self.PREFIJO + "cobrosTiendas";
        if (quitar) bk.removeItem(k);
      });
      if (!this._escribir("tiendas", datos.tiendas)) throw new Error("no se pudo escribir las tiendas");
      if (!this._escribir("personas", personas)) throw new Error("no se pudo escribir las personas");
      if (!this._escribir("preciosRancho", preciosRancho)) throw new Error("no se pudo escribir los precios del rancho");
      if (!this._escribir("cobros", cobros)) throw new Error("no se pudo escribir los cobros");
      if (!this._escribir("cobrosTiendas", cobrosTiendas)) throw new Error("no se pudo escribir los cobros de tiendas");
      Object.keys(datos.repartos).forEach(function (fecha) {
        if (!self._escribir("reparto:" + fecha, datos.repartos[fecha])) throw new Error("no se pudo escribir el reparto " + fecha);
      });
      Object.keys(ranchos).forEach(function (fecha) {
        if (!self._escribir("rancho:" + fecha, ranchos[fecha])) throw new Error("no se pudo escribir el rancho " + fecha);
      });
    } catch (e) {
      let deshecho = true;
      try { deshacer(); } catch (e2) { deshecho = false; }
      if (deshecho) {
        throw new Error("No se pudo restaurar (" + e.message + "). Tus datos anteriores quedaron intactos.");
      }
      throw new Error("No se pudo restaurar (" + e.message + ") y tampoco se pudo deshacer. Tus datos pueden estar incompletos: vuelve a restaurar con este mismo respaldo.");
    }
    return {
      tiendas: datos.tiendas.length,
      repartos: Object.keys(datos.repartos).length,
      ranchos: Object.keys(ranchos).length,
      personas: personas.length,
      cobros: cobros.length,
      cobrosTiendas: cobrosTiendas.length
    };
  },

  // Historial en CSV (para Excel): solo repartos CERRADOS
  aCSV() {
    const self = this;
    const celda = function (v) {
      if (typeof v === "number") return String(v);
      let t = String(v);
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
      if (/[",\n\r]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
      return t;
    };
    const n = function (v) { return Logica.esVacio(v) ? 0 : Logica.aNumero(v); };
    const filas = [["fecha", "tienda_id", "tienda", "precio_aplicado", "kg_manana", "kg_extras", "kg_entregados", "kg_devoluciones", "kg_frios", "kg_netos", "importe_calculado", "se_cobra", "importe_cobrado", "importe_no_cobrado"]];
    this.listarFechas().slice().reverse().forEach(function (fecha) {
      const r = self.obtenerReparto(fecha);
      if (!r || r.estado !== "cerrado") return;
      r.lineas.forEach(function (l) {
        const c = Logica.calcularLinea(l.precio, l.entregados, l.sobrantes, true, l.extras, l.devoluciones, l.cobrar);
        if (c.estado === "Sin captura") return;
        filas.push([fecha, l.tiendaId, l.nombre, l.precio, n(l.entregados), n(l.extras), c.entregadosTotal, n(l.devoluciones), n(l.sobrantes), c.netos, c.importe, l.cobrar === false ? "no" : "si", c.cobrado, c.noCobrado]);
      });
    });
    return "\uFEFF" + filas.map(function (f) { return f.map(celda).join(","); }).join("\r\n") + "\r\n";
  },

  _celdaCSV(v) {
    if (typeof v === "number") return String(v);
    let t = String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    if (/[",\n\r]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
    return t;
  },

  // Rancho en CSV: una fila por día (solo ranchos CERRADOS)
  aCSVRancho() {
    const self = this;
    const n = function (v) { return Logica.esVacio(v) ? 0 : Logica.aNumero(v); };
    const filas = [[
      "fecha",
      "caliente_llevados", "caliente_regresan", "caliente_fiados", "caliente_vendidos", "caliente_precio", "caliente_dinero",
      "fria_de_tiendas", "fria_extra", "fria_regresan", "fria_fiados", "fria_vendidos_a", "fria_precio_a", "fria_vendidos_b", "fria_precio_b", "fria_dinero",
      "masa_llevados", "masa_regresan", "masa_fiados", "masa_vendidos", "masa_precio", "masa_dinero",
      "dinero_rancho", "fiado_por_cobrar"
    ]];
    this.listarFechasRancho().slice().reverse().forEach(function (fecha) {
      const r = self.obtenerRancho(fecha);
      if (!r || r.estado !== "cerrado") return;
      const s = LogicaRancho.resumirRancho(r, r.friaDeTiendas);
      filas.push([
        fecha,
        n(r.caliente.llevados), n(r.caliente.regresan), s.kgFiados.caliente, s.caliente.vendidos, r.precios.caliente, s.caliente.dinero,
        r.friaDeTiendas, n(r.fria.extra), n(r.fria.regresan), s.kgFiados.fria, n(r.fria.contadoA), r.precios.friaA, n(r.fria.contadoB), r.precios.friaB, s.fria.dinero,
        n(r.masa.llevados), n(r.masa.regresan), s.kgFiados.masa, s.masa.vendidos, r.precios.masa, s.masa.dinero,
        s.dineroRancho, s.fiadoPorCobrar
      ]);
    });
    return "\uFEFF" + filas.map(function (f) { return f.map(function (c) { return self._celdaCSV(c); }).join(","); }).join("\r\n") + "\r\n";
  },

  // Fiados en CSV: una fila por fiado (solo de ranchos CERRADOS)
  aCSVFiados() {
    const self = this;
    const filas = [["fecha", "persona_id", "persona", "producto", "kg", "precio", "importe"]];
    this.listarFechasRancho().slice().reverse().forEach(function (fecha) {
      const r = self.obtenerRancho(fecha);
      if (!r || r.estado !== "cerrado") return;
      r.fiados.forEach(function (f) {
        if (LogicaRancho.validarFiado(f) !== "OK") return;
        const kg = Logica.aNumero(f.kg), precio = Logica.aNumero(f.precio);
        filas.push([fecha, f.personaId, f.nombre, f.producto, kg, precio, Logica.redondear(kg * precio, 2)]);
      });
    });
    return "\uFEFF" + filas.map(function (f) { return f.map(function (c) { return self._celdaCSV(c); }).join(","); }).join("\r\n") + "\r\n";
  },

  // Cobros en CSV: una fila por cobro
  aCSVCobros() {
    const self = this;
    const nombres = {};
    this.obtenerPersonas().forEach(function (p) { nombres[p.id] = p.nombre; });
    const filas = [["fecha", "persona_id", "persona", "monto", "nota"]];
    this.obtenerCobros().slice().sort(function (a, b) {
      return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : a.id - b.id);
    }).forEach(function (c) {
      filas.push([c.fecha, c.personaId, nombres[c.personaId] || "", c.monto, c.nota || ""]);
    });
    return "\uFEFF" + filas.map(function (f) { return f.map(function (x) { return self._celdaCSV(x); }).join(","); }).join("\r\n") + "\r\n";
  },

  // Saldos en CSV: una fila por persona con fiados confirmados o cobros
  aCSVSaldos(hoy) {
    const self = this;
    const filas = [["persona_id", "persona", "activa", "total_fiado", "total_cobrado", "saldo", "dias_antiguedad", "segmento", "fiado_pendiente_mas_antiguo"]];
    this.cuentasDePersonas(hoy).forEach(function (x) {
      const c = x.cuenta;
      filas.push([x.personaId, x.nombre, x.activa ? "si" : "no", c.totalFiado, c.totalCobrado, c.saldo,
        c.diasAntiguedad === null ? "" : c.diasAntiguedad, LogicaCuentas.ETIQUETAS_SEGMENTO[c.segmento], c.fechaMasAntigua || ""]);
    });
    return "\uFEFF" + filas.map(function (f) { return f.map(function (c) { return self._celdaCSV(c); }).join(","); }).join("\r\n") + "\r\n";
  },

  // Cobros de tiendas en CSV: una fila por cobro
  aCSVCobrosTiendas() {
    const self = this;
    const nombres = {};
    this.obtenerTiendas().forEach(function (t) { nombres[t.id] = t.nombre; });
    const filas = [["fecha", "tienda_id", "tienda", "monto", "nota"]];
    this.obtenerCobrosTiendas().slice().sort(function (a, b) {
      return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : a.id - b.id);
    }).forEach(function (c) {
      filas.push([c.fecha, c.tiendaId, nombres[c.tiendaId] || "", c.monto, c.nota || ""]);
    });
    return "\uFEFF" + filas.map(function (f) { return f.map(function (x) { return self._celdaCSV(x); }).join(","); }).join("\r\n") + "\r\n";
  },

  // Saldos de tiendas en CSV: una fila por tienda con días sin cobrar o pagos
  aCSVSaldosTiendas(hoy) {
    const self = this;
    const filas = [["tienda_id", "tienda", "activa", "cobro_quincenal", "total_sin_cobrar", "total_cobrado", "saldo", "dias_antiguedad", "segmento", "sin_cobrar_pendiente_mas_antiguo"]];
    this.cuentasDeTiendas(hoy).forEach(function (x) {
      const c = x.cuenta;
      filas.push([x.tiendaId, x.nombre, x.activa ? "si" : "no", x.cobroQuincenal ? "si" : "no", c.totalFiado, c.totalCobrado, c.saldo,
        c.diasAntiguedad === null ? "" : c.diasAntiguedad, LogicaCuentas.ETIQUETAS_SEGMENTO[c.segmento], c.fechaMasAntigua || ""]);
    });
    return "\uFEFF" + filas.map(function (f) { return f.map(function (c) { return self._celdaCSV(c); }).join(","); }).join("\r\n") + "\r\n";
  }
};
