// ============================================================
// pantalla_rancho.js  -  Las pantallas del RANCHO y las cuentas por cobrar
// ------------------------------------------------------------
// Se carga DESPUÉS de pantalla.js y usa sus utilidades.
//   - Las CUENTAS las hace logica_rancho.js
//   - El GUARDADO lo hace almacenamiento.js
// El rancho se captura y se cierra por separado de las tiendas,
// pero comparte la fecha de arriba y la suma del día.
// ============================================================

let rancho = null;              // el rancho que se está viendo
let ranchoSoloLectura = false;
let subpanel = "dia";
let personaEditando = null;     // número de la persona que se edita, o null si es nueva
let infoFria = { kg: 0, hayReparto: false, cerrado: true };
let ultimaPersonaFiado = null;   // para volver a elegir a la misma persona
let vistaCuenta = null;          // número de la persona cuya cuenta se está viendo
let ordenDeudores = "saldo";
let filtroSegmento = "todos";

const NOMBRES_PRODUCTO = { caliente: "Caliente", fria: "Fría", masa: "Masa" };

function moneda(n) { return formatoMoneda.format(n); }

function entrada(id, etiqueta) {
  return '<label>' + etiqueta + '<input type="text" inputmode="decimal" autocomplete="off" id="' + id + '"></label>';
}

// ---------- Construir la pantalla "Del día" ----------
function construirPanelDia() {
  $("panelDia").innerHTML =
    '<div class="barra-precios"><span id="rPrecios" class="ayuda"></span>' +
      '<button type="button" id="btnPrecios" class="secundario">Precios</button></div>' +

    '<div class="prod" id="card-caliente">' +
      '<div class="encabezado"><span class="nombre">Caliente</span><span class="precio" id="rc-precio"></span></div>' +
      '<div class="campos">' + entrada("rc-llevados", "Llevados (kg)") + entrada("rc-regresan", "Regresan (kg)") + '</div>' +
      '<div class="dato"><span>Fiados (kg)</span><b id="rc-fiados">0</b></div>' +
      '<div class="dato"><span>Vendidos de contado (kg)</span><b id="rc-vendidos">0</b></div>' +
      '<div class="detalle"><span class="importe" id="rc-dinero">$0.00</span><span class="estado" id="rc-estado"></span></div>' +
    '</div>' +

    '<div class="prod" id="card-fria">' +
      '<div class="encabezado"><span class="nombre">Fría</span><span class="precio">dos precios</span></div>' +
      '<div class="dato"><span>De las tiendas hoy (automático, kg)</span><b id="rf-tiendas">0</b></div>' +
      '<div class="campos">' + entrada("rf-extra", "Extra de otras rutas (kg)") + entrada("rf-regresan", "Regresan (kg)") + '</div>' +
      '<div class="dato"><span>Llevados en total (kg)</span><b id="rf-llevados">0</b></div>' +
      '<div class="dato"><span>Fiados (kg)</span><b id="rf-fiados">0</b></div>' +
      '<div class="dato"><span>Contado esperado (kg)</span><b id="rf-esperado">0</b></div>' +
      '<div class="campos">' +
        '<label><span id="rf-lblA">Contado a precio A (kg)</span><input type="text" inputmode="decimal" autocomplete="off" id="rf-contadoA"></label>' +
        '<label><span id="rf-lblB">Contado a precio B (kg)</span><input type="text" inputmode="decimal" autocomplete="off" id="rf-contadoB"></label>' +
      '</div>' +
      '<div class="detalle"><span class="importe" id="rf-dinero">$0.00</span><span class="estado" id="rf-estado"></span></div>' +
    '</div>' +

    '<div class="prod" id="card-masa">' +
      '<div class="encabezado"><span class="nombre">Masa</span><span class="precio" id="rm-precio"></span></div>' +
      '<div class="campos">' + entrada("rm-llevados", "Llevados (kg)") + entrada("rm-regresan", "Regresan (kg)") + '</div>' +
      '<div class="dato"><span>Fiados (kg)</span><b id="rm-fiados">0</b></div>' +
      '<div class="dato"><span>Vendidos de contado (kg)</span><b id="rm-vendidos">0</b></div>' +
      '<div class="detalle"><span class="importe" id="rm-dinero">$0.00</span><span class="estado" id="rm-estado"></span></div>' +
    '</div>' +

    '<div class="prod" id="card-fiados">' +
      '<div class="encabezado"><span class="nombre">Fiados del día</span>' +
        '<button type="button" id="btnAnotarFiado" class="secundario chico">+ Anotar fiado</button></div>' +
      '<ul id="rFiadosLista" class="lista-fiados"></ul>' +
      '<p class="ayuda" id="rFiadosVacio">Todavía no hay fiados anotados.</p>' +
    '</div>';
}

// Cada campo de captura: [id en pantalla, bloque, campo]
const CAMPOS_RANCHO = [
  ["rc-llevados", "caliente", "llevados"], ["rc-regresan", "caliente", "regresan"],
  ["rf-extra", "fria", "extra"], ["rf-regresan", "fria", "regresan"],
  ["rf-contadoA", "fria", "contadoA"], ["rf-contadoB", "fria", "contadoB"],
  ["rm-llevados", "masa", "llevados"], ["rm-regresan", "masa", "regresan"]
];

function guardarRanchoActual() {
  try {
    marcarGuardado(Almacen.guardarRancho(rancho));
  } catch (e) {
    marcarGuardado(false);
    mostrarErrorAlmacen(e.message);
  }
}

function conectarPanelDia() {
  CAMPOS_RANCHO.forEach(function (c, i) {
    const el = $(c[0]);
    el.addEventListener("input", function () {
      if (ranchoSoloLectura) return;
      rancho[c[1]][c[2]] = el.value;
      guardarRanchoActual();      // primero se guarda...
      recalcularRancho();         // ...y luego se recalcula con lo guardado
    });
    el.addEventListener("keydown", function (evento) {
      if (evento.key === "Enter" && CAMPOS_RANCHO[i + 1]) {
        evento.preventDefault();
        $(CAMPOS_RANCHO[i + 1][0]).focus();
      }
    });
  });
  $("btnAnotarFiado").addEventListener("click", abrirFormFiado);
  $("btnPrecios").addEventListener("click", abrirFormPrecios);
}

// ---------- Cargar el rancho de una fecha ----------
function cargarRanchoFecha(fecha) {
  if (!fecha) return;
  try {
    const guardado = Almacen.obtenerRancho(fecha);
    rancho = guardado || Almacen.nuevoRancho(fecha);
    if (guardado && Almacen.sincronizarRancho(rancho, Almacen.obtenerPreciosRancho())) {
      Almacen.guardarRancho(rancho);
    }
  } catch (e) {
    mostrarErrorAlmacen(e.message);
    return;
  }
  ranchoSoloLectura = rancho.estado === "cerrado";
  CAMPOS_RANCHO.forEach(function (c) {
    const el = $(c[0]);
    el.value = rancho[c[1]][c[2]];
    el.disabled = ranchoSoloLectura;
  });
  $("btnAnotarFiado").hidden = ranchoSoloLectura;
  $("btnPrecios").hidden = ranchoSoloLectura;
  $("btnCerrarRancho").hidden = ranchoSoloLectura;
  $("btnReabrirRancho").hidden = !ranchoSoloLectura;
  const aviso = $("avisoRancho");
  aviso.textContent = ranchoSoloLectura ? "Rancho cerrado. Para modificarlo, pulsa «Reabrir rancho»." : "";
  aviso.hidden = !ranchoSoloLectura || subpanel !== "dia";
  dibujarFiadosDelDia();
  recalcularRancho();
}

// ---------- Mostrar los resultados ----------
function mostrarProducto(pref, tarjeta, calc, fiadosKg) {
  $(pref + "-fiados").textContent = formatoKg.format(fiadosKg);
  $(pref + "-vendidos").textContent = formatoKg.format(calc.vendidos);
  $(pref + "-dinero").textContent = moneda(calc.dinero);
  $(pref + "-estado").textContent = calc.estado === "Sin captura" ? "" : calc.estado;
  $(tarjeta).className = "prod" + (calc.estado === "OK" ? " ok" : (calc.estado === "Sin captura" ? "" : " error"));
}

function recalcularRancho() {
  infoFria = Almacen.friaDeTiendas(rancho.fecha);
  const friaKg = (ranchoSoloLectura && typeof rancho.friaDeTiendas === "number") ? rancho.friaDeTiendas : infoFria.kg;
  const s = LogicaRancho.resumirRancho(rancho, friaKg);
  const P = rancho.precios;

  $("rPrecios").textContent = "Precios de este día: caliente " + moneda(P.caliente) + " · fría " + moneda(P.friaA) +
    " y " + moneda(P.friaB) + " · masa " + moneda(P.masa);
  $("rc-precio").textContent = moneda(P.caliente) + " / kg";
  $("rm-precio").textContent = moneda(P.masa) + " / kg";
  $("rf-lblA").textContent = "Contado a " + moneda(P.friaA) + " (kg)";
  $("rf-lblB").textContent = "Contado a " + moneda(P.friaB) + " (kg)";

  mostrarProducto("rc", "card-caliente", s.caliente, s.kgFiados.caliente);
  mostrarProducto("rm", "card-masa", s.masa, s.kgFiados.masa);

  $("rf-tiendas").textContent = formatoKg.format(friaKg);
  $("rf-llevados").textContent = formatoKg.format(s.fria.llevados);
  $("rf-fiados").textContent = formatoKg.format(s.kgFiados.fria);
  $("rf-esperado").textContent = formatoKg.format(s.fria.esperadoContado);
  $("rf-dinero").textContent = moneda(s.fria.dinero);
  let textoFria = s.fria.estado === "Sin captura" ? "" : s.fria.estado;
  if (s.fria.estado === "Lo vendido de contado no cuadra") {
    textoFria += " (deben sumar " + formatoKg.format(s.fria.esperadoContado) + " kg)";
  }
  $("rf-estado").textContent = textoFria;
  $("card-fria").className = "prod" + (s.fria.estado === "OK" ? " ok" : (s.fria.estado === "Sin captura" ? "" : " error"));

  // Pie: totales del rancho y del día
  const dia = totalDelDia(rancho.fecha);
  $("rTotal").textContent = moneda(s.dineroRancho);
  $("rFiado").textContent = moneda(s.fiadoPorCobrar);
  $("rTiendas").textContent = moneda(dia.totalTiendas);
  $("rDia").textContent = moneda(dia.totalDia);
  const nota = $("rNota");
  nota.textContent = dia.provisional ? "Dinero neto del día provisional: falta cerrar las tiendas o el rancho." : "";
  nota.hidden = !dia.provisional;

  const listo = s.estado === "Listo para cerrar";
  let texto = s.estado;
  let clase = "estado-dia neutro";
  if (ranchoSoloLectura) { texto = "Rancho cerrado"; clase = "estado-dia bien"; }
  else if (listo && !infoFria.cerrado) { texto = "Falta cerrar el reparto de tiendas"; clase = "estado-dia mal"; }
  else if (listo) clase = "estado-dia bien";
  else if (s.estado !== "Sin datos") clase = "estado-dia mal";
  $("rEstado").textContent = texto;
  $("rEstado").className = clase;
  $("btnCerrarRancho").disabled = ranchoSoloLectura || !listo || !infoFria.cerrado;
  return s;
}

// ---------- Fiados del día ----------
function dibujarFiadosDelDia() {
  const ul = $("rFiadosLista");
  ul.innerHTML = "";
  // Se agrupan por persona (en el orden en que aparecen), pero cada renglón conserva su número real
  const grupos = [];
  const porPersona = {};
  rancho.fiados.forEach(function (f, i) {
    const clave = String(f.personaId) + "|" + f.nombre;
    if (!porPersona[clave]) { porPersona[clave] = { nombre: f.nombre, items: [] }; grupos.push(porPersona[clave]); }
    porPersona[clave].items.push({ f: f, i: i });
  });
  grupos.forEach(function (g) {
    let subtotal = 0;
    g.items.forEach(function (it) {
      if (LogicaRancho.validarFiado(it.f) === "OK") subtotal += Logica.aNumero(it.f.kg) * Logica.aNumero(it.f.precio);
    });
    const cab = document.createElement("li");
    cab.className = "grupo";
    const n = document.createElement("span"); n.textContent = g.nombre;
    const t = document.createElement("span"); t.textContent = moneda(Logica.redondear(subtotal, 2));
    cab.appendChild(n); cab.appendChild(t);
    ul.appendChild(cab);
    g.items.forEach(function (it) {
      const f = it.f;
      const li = document.createElement("li");
      li.className = "item";
      const estado = LogicaRancho.validarFiado(f);
      const kg = Logica.esNumero(f.kg) ? Logica.aNumero(f.kg) : 0;
      const precio = Logica.esNumero(f.precio) ? Logica.aNumero(f.precio) : 0;
      const texto = document.createElement("span");
      texto.textContent = (NOMBRES_PRODUCTO[f.producto] || f.producto) + " · " + formatoKg.format(kg) + " kg × " +
        moneda(precio) + " = " + moneda(Logica.redondear(kg * precio, 2)) + (estado === "OK" ? "" : " (" + estado + ")");
      li.appendChild(texto);
      if (estado !== "OK") li.className = "item error";
      if (!ranchoSoloLectura) {
        const quitar = document.createElement("button");
        quitar.type = "button"; quitar.textContent = "Quitar";
        quitar.addEventListener("click", function () { quitarFiado(it.i); });
        li.appendChild(quitar);
      }
      ul.appendChild(li);
    });
  });
  $("rFiadosVacio").hidden = rancho.fiados.length > 0;
}

function quitarFiado(i) {
  const f = rancho.fiados[i];
  if (!window.confirm("¿Quitar el fiado de " + f.nombre + " (" + f.kg + " kg)?")) return;
  rancho.fiados.splice(i, 1);
  guardarRanchoActual();
  dibujarFiadosDelDia();
  recalcularRancho();
}

function personaSeleccionada() {
  const id = Number($("fPersona").value);
  return Almacen.obtenerPersonas().find(function (p) { return p.id === id; });
}

function precioParaFiado(persona, producto) {
  return producto === "fria" ? persona.precioFria : rancho.precios[producto];
}

// Muestra junto a cada producto el precio que se le aplicaría a la persona elegida
function actualizarPreciosFiado() {
  const persona = personaSeleccionada();
  if (!persona) {
    $("fLblCaliente").textContent = "Caliente (kg)";
    $("fLblFria").textContent = "Fría (kg)";
    $("fLblMasa").textContent = "Masa (kg)";
    return;
  }
  $("fLblCaliente").textContent = "Caliente (kg) · " + moneda(precioParaFiado(persona, "caliente")) + " / kg";
  $("fLblFria").textContent = "Fría (kg) · " + moneda(precioParaFiado(persona, "fria")) + " / kg (precio de " + persona.nombre + ")";
  $("fLblMasa").textContent = "Masa (kg) · " + moneda(precioParaFiado(persona, "masa")) + " / kg";
}

function abrirFormFiado() {
  const activas = Almacen.obtenerPersonas().filter(function (p) { return p.activa; });
  const sel = $("fPersona");
  sel.innerHTML = "";
  activas.forEach(function (p) {
    const o = document.createElement("option");
    o.value = String(p.id); o.textContent = p.nombre;
    sel.appendChild(o);
  });
  // Si ya se le fió a alguien hace un momento, esa persona queda elegida
  if (ultimaPersonaFiado !== null && activas.some(function (p) { return p.id === ultimaPersonaFiado; })) {
    sel.value = String(ultimaPersonaFiado);
  }
  $("fKgCaliente").value = "";
  $("fKgFria").value = "";
  $("fKgMasa").value = "";
  const error = $("fError");
  if (activas.length === 0) {
    error.textContent = "Primero agrega personas en la sección «Personas».";
    error.hidden = false;
  } else {
    error.hidden = true;
  }
  actualizarPreciosFiado();
  $("formFiado").hidden = false;
  $("fKgCaliente").focus();
}

function guardarFiado() {
  const persona = personaSeleccionada();
  const error = $("fError");
  const mostrar = function (texto) { error.textContent = texto; error.hidden = false; };
  if (!persona) { mostrar("Elige una persona."); return; }

  const entradas = [["caliente", "fKgCaliente"], ["fria", "fKgFria"], ["masa", "fKgMasa"]];
  let siguiente = rancho.fiados.reduce(function (m, f) { return Math.max(m, f.id || 0); }, 0) + 1;
  const nuevas = [];
  for (let i = 0; i < entradas.length; i++) {
    const producto = entradas[i][0];
    const valor = $(entradas[i][1]).value.trim();
    if (valor === "") continue;
    const linea = {
      id: siguiente, personaId: persona.id, nombre: persona.nombre, producto: producto,
      kg: valor, precio: precioParaFiado(persona, producto)
    };
    const estado = LogicaRancho.validarFiado(linea);
    if (estado !== "OK") {
      mostrar(NOMBRES_PRODUCTO[producto] + ": " +
        (estado === "Kg no válido" ? "escribe los kilos como número (usa punto para decimales)." : estado + "."));
      return;   // no se guarda nada si algo está mal
    }
    siguiente += 1;
    nuevas.push(linea);
  }
  if (nuevas.length === 0) { mostrar("Escribe los kilos de al menos un producto."); return; }

  nuevas.forEach(function (l) { rancho.fiados.push(l); });
  ultimaPersonaFiado = persona.id;
  guardarRanchoActual();
  $("formFiado").hidden = true;
  dibujarFiadosDelDia();
  recalcularRancho();
}

// ---------- Precios del rancho ----------
function abrirFormPrecios() {
  const p = Almacen.obtenerPreciosRancho();
  $("ppCaliente").value = String(p.caliente);
  $("ppFriaA").value = String(p.friaA);
  $("ppFriaB").value = String(p.friaB);
  $("ppMasa").value = String(p.masa);
  $("ppError").hidden = true;
  $("formPrecios").hidden = false;
}

function guardarFormPrecios() {
  try {
    Almacen.guardarPreciosRancho({
      caliente: $("ppCaliente").value, friaA: $("ppFriaA").value,
      friaB: $("ppFriaB").value, masa: $("ppMasa").value
    });
    $("formPrecios").hidden = true;
    marcarGuardado(true);
    cargarRanchoFecha(rancho.fecha);
  } catch (e) {
    $("ppError").textContent = e.message;
    $("ppError").hidden = false;
  }
}

// ---------- Cerrar y reabrir el rancho ----------
function abrirResumenRancho() {
  const s = recalcularRancho();
  const dia = totalDelDia(rancho.fecha);
  $("resumenRanchoFecha").textContent = formatoFecha(rancho.fecha);
  const datos = [
    ["Caliente", moneda(s.caliente.dinero)],
    ["Fría", moneda(s.fria.dinero)],
    ["Masa", moneda(s.masa.dinero)],
    ["Dinero esperado del rancho", moneda(s.dineroRancho)],
    ["Fiado por cobrar (aparte)", moneda(s.fiadoPorCobrar)],
    ["Total de tiendas", moneda(dia.totalTiendas)],
    ["Dinero neto del día (tiendas + rancho)", moneda(dia.totalDia)]
  ];
  const dl = $("resumenRanchoLista");
  dl.innerHTML = "";
  datos.forEach(function (par, i) {
    const div = document.createElement("div");
    if (i === datos.length - 1) div.className = "gran";
    const dt = document.createElement("dt"); dt.textContent = par[0];
    const dd = document.createElement("dd"); dd.textContent = par[1];
    div.appendChild(dt); div.appendChild(dd);
    dl.appendChild(div);
  });
  $("superposicionRancho").hidden = false;
}

function confirmarCierreRancho() {
  try {
    if (!Almacen.guardarRancho(rancho)) throw new Error("No se pudo guardar antes de cerrar.");
    Almacen.cerrarRancho(rancho.fecha);
    $("superposicionRancho").hidden = true;
    marcarGuardado(true);
    cargarRanchoFecha(rancho.fecha);
    actualizarAvisoRespaldo();
  } catch (e) {
    $("superposicionRancho").hidden = true;
    marcarGuardado(false);
    mostrarErrorAlmacen(e.message);
  }
}

function reabrirRanchoUI() {
  if (!window.confirm("¿Reabrir este rancho para modificarlo?")) return;
  try {
    Almacen.reabrirRancho(rancho.fecha);
    cargarRanchoFecha(rancho.fecha);
  } catch (e) {
    mostrarErrorAlmacen(e.message);
  }
}

// ---------- Personas ----------
function dibujarPersonas() {
  const lista = $("listaPersonas");
  lista.innerHTML = "";
  Almacen.obtenerPersonas().forEach(function (p) {
    const li = document.createElement("li");
    li.className = "tienda" + (p.activa ? "" : " inactiva");
    const nombre = document.createElement("span"); nombre.className = "nombre"; nombre.textContent = p.nombre;
    const precio = document.createElement("span"); precio.className = "precio"; precio.textContent = "Fría " + moneda(p.precioFria) + " / kg";
    const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = p.activa ? "Activa" : "Desactivada";
    const acciones = document.createElement("div"); acciones.className = "acciones";
    const editar = document.createElement("button"); editar.type = "button"; editar.textContent = "Editar";
    editar.addEventListener("click", function () { abrirFormPersona(p.id); });
    const activa = document.createElement("button"); activa.type = "button"; activa.textContent = p.activa ? "Desactivar" : "Activar";
    activa.addEventListener("click", function () { cambiarActivaPersona(p); });
    acciones.appendChild(editar); acciones.appendChild(activa);
    li.appendChild(nombre); li.appendChild(precio); li.appendChild(sub); li.appendChild(acciones);
    lista.appendChild(li);
  });
  if (lista.children.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "Todavía no hay personas. Agrega la primera para poder anotar fiados.";
    lista.appendChild(vacio);
  }
}

function abrirFormPersona(id) {
  personaEditando = id;
  const p = id === null ? null : Almacen.obtenerPersonas().find(function (x) { return x.id === id; });
  $("formPersonaTitulo").textContent = p ? "Editar persona" : "Agregar persona";
  $("pNombre").value = p ? p.nombre : "";
  $("pPrecio").value = p ? String(p.precioFria) : "";
  $("pError").hidden = true;
  $("formPersona").hidden = false;
  $("pNombre").focus();
}

function guardarFormPersona() {
  try {
    if (personaEditando === null) Almacen.agregarPersona($("pNombre").value, $("pPrecio").value);
    else Almacen.editarPersona(personaEditando, $("pNombre").value, $("pPrecio").value);
    $("formPersona").hidden = true;
    dibujarPersonas();
    marcarGuardado(true);
  } catch (e) {
    $("pError").textContent = e.message;
    $("pError").hidden = false;
  }
}

function cambiarActivaPersona(p) {
  const pregunta = p.activa
    ? "¿Desactivar a «" + p.nombre + "»? Ya no aparecerá para anotar fiados nuevos. Su historial se conserva."
    : "¿Activar a «" + p.nombre + "»?";
  if (!window.confirm(pregunta)) return;
  try {
    Almacen.establecerActivaPersona(p.id, !p.activa);
    dibujarPersonas();
    marcarGuardado(true);
  } catch (e) {
    mostrarErrorAlmacen(e.message);
  }
}

// ---------- Cuentas por cobrar ----------
function hoyTexto() { return fechaDeHoy(); }

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function dibujarCuentas() {
  const cont = $("listaFiados");
  cont.innerHTML = "";
  if (vistaCuenta !== null) { dibujarDetalleCuenta(cont); return; }

  const cuentas = Almacen.cuentasDePersonas(hoyTexto());
  if (cuentas.length === 0) {
    cont.appendChild(crear("p", "vacio", "Todavía no hay fiados confirmados. Un fiado cuenta cuando se cierra el rancho de ese día."));
    return;
  }
  const rd = LogicaCuentas.resumenDeudores(cuentas, ordenDeudores);

  cont.appendChild(crear("div", "resumen-general",
    "Total por cobrar: " + moneda(rd.totalPorCobrar) + " · " + rd.deudores.length + (rd.deudores.length === 1 ? " persona" : " personas")));

  // Segmentos por antigüedad
  const chips = crear("div", "chips");
  const todos = crear("button", "chip" + (filtroSegmento === "todos" ? " activa" : ""), "Todos (" + rd.deudores.length + ")");
  todos.type = "button";
  todos.addEventListener("click", function () { filtroSegmento = "todos"; dibujarCuentas(); });
  chips.appendChild(todos);
  LogicaCuentas.ORDEN_SEGMENTOS.forEach(function (seg) {
    const info = rd.porSegmento[seg];
    const chip = crear("button", "chip" + (filtroSegmento === seg ? " activa" : ""),
      LogicaCuentas.ETIQUETAS_SEGMENTO[seg] + " · " + info.cantidad + " · " + moneda(info.monto));
    chip.type = "button";
    chip.addEventListener("click", function () { filtroSegmento = seg; dibujarCuentas(); });
    chips.appendChild(chip);
  });
  cont.appendChild(chips);

  // Orden
  const orden = crear("label", "orden", "Ordenar por ");
  const sel = document.createElement("select");
  [["saldo", "Mayor saldo"], ["antiguedad", "Deuda más antigua"], ["nombre", "Nombre"]].forEach(function (o) {
    const op = document.createElement("option");
    op.value = o[0]; op.textContent = o[1];
    sel.appendChild(op);
  });
  sel.value = ordenDeudores;
  sel.addEventListener("change", function () { ordenDeudores = sel.value; dibujarCuentas(); });
  orden.appendChild(sel);
  cont.appendChild(orden);

  const visibles = rd.deudores.filter(function (p) { return filtroSegmento === "todos" || p.cuenta.segmento === filtroSegmento; });
  if (visibles.length === 0) cont.appendChild(crear("p", "vacio", "Nadie en este segmento."));
  visibles.forEach(function (p) { cont.appendChild(botonDeudor(p)); });

  if (filtroSegmento === "todos" && rd.sinSaldo.length > 0) {
    cont.appendChild(crear("p", "subtitulo", "Sin saldo pendiente"));
    rd.sinSaldo.forEach(function (p) { cont.appendChild(botonDeudor(p)); });
  }
}

function botonDeudor(p) {
  const c = p.cuenta;
  const b = crear("button", "deudor " + c.segmento);
  b.type = "button";
  b.appendChild(crear("span", "nombre", p.nombre + (p.activa ? "" : " (desactivada)")));
  b.appendChild(crear("span", "saldo", c.saldo > 0 ? moneda(c.saldo) : (c.saldo < 0 ? "A favor " + moneda(c.aFavor) : "Pagado")));
  let sub = c.saldo > 0
    ? "Debe desde " + formatoFecha(c.fechaMasAntigua) + " (" + c.diasAntiguedad + (c.diasAntiguedad === 1 ? " día" : " días") + ") · " + LogicaCuentas.ETIQUETAS_SEGMENTO[c.segmento]
    : "Fiado total " + moneda(c.totalFiado) + " · cobrado " + moneda(c.totalCobrado);
  if (p.porConfirmar > 0) sub += " · tiene fiados en ranchos abiertos";
  b.appendChild(crear("span", "sub", sub));
  b.addEventListener("click", function () { vistaCuenta = p.personaId; dibujarCuentas(); });
  return b;
}

function dibujarDetalleCuenta(cont) {
  let datos;
  try { datos = Almacen.cuentaDe(vistaCuenta, hoyTexto()); } catch (e) { vistaCuenta = null; dibujarCuentas(); return; }
  const c = datos.cuenta;

  const volver = crear("button", "volver", "← Todas las cuentas");
  volver.type = "button";
  volver.addEventListener("click", function () { vistaCuenta = null; dibujarCuentas(); });
  cont.appendChild(volver);

  const cab = crear("div", "cuenta-cabecera");
  cab.appendChild(crear("h3", "", datos.persona.nombre + (datos.persona.activa ? "" : " (desactivada)")));
  cont.appendChild(cab);

  const cajas = crear("div", "cajas3");
  [["Fiado total", moneda(c.totalFiado)], ["Cobrado", moneda(c.totalCobrado)],
   [c.saldo < 0 ? "A su favor" : "Saldo", moneda(c.saldo < 0 ? c.aFavor : c.saldo)]].forEach(function (par) {
    const d = document.createElement("div");
    d.appendChild(crear("span", "", par[0]));
    d.appendChild(crear("b", "", par[1]));
    cajas.appendChild(d);
  });
  cont.appendChild(cajas);
  cont.appendChild(crear("p", "ayuda", c.saldo > 0
    ? "Debe desde " + formatoFecha(c.fechaMasAntigua) + " (" + c.diasAntiguedad + (c.diasAntiguedad === 1 ? " día" : " días") + ") · " + LogicaCuentas.ETIQUETAS_SEGMENTO[c.segmento]
    : "Sin saldo pendiente."));
  if (c.saldo > 0) cont.appendChild(crear("p", "ayuda", "El saldo es el total fiado menos el total pagado. La antigüedad supone que lo pagado cubre primero lo más antiguo."));

  const botones = crear("div", "cuenta-botones");
  const bCobro = crear("button", "principal", "Registrar cobro");
  bCobro.type = "button"; bCobro.id = "btnRegistrarCobro"; bCobro.disabled = c.saldo <= 0;
  bCobro.addEventListener("click", function () { abrirFormCobro(datos); });
  const bEstado = crear("button", "", "Estado de cuenta");
  bEstado.type = "button"; bEstado.id = "btnVerEstado";
  bEstado.addEventListener("click", function () { abrirEstadoDeCuenta(datos); });
  botones.appendChild(bCobro); botones.appendChild(bEstado);
  cont.appendChild(botones);

  cont.appendChild(crear("p", "subtitulo", "Movimientos de la cuenta (lo fiado suma, lo pagado resta)"));
  if (c.movimientos.length === 0) cont.appendChild(crear("p", "vacio", "Sin movimientos confirmados."));
  c.movimientos.forEach(function (m) {
    const r = crear("div", "renglon " + m.tipo);
    const l1 = crear("div", "linea1");
    if (m.tipo === "fiado") {
      l1.appendChild(crear("span", "", formatoFecha(m.fecha) + " · Fió " + NOMBRES_PRODUCTO[m.producto]));
      l1.appendChild(crear("b", "", "+" + moneda(m.monto)));
    } else {
      l1.appendChild(crear("span", "", formatoFecha(m.fecha) + " · Pago" + (m.nota ? " · " + m.nota : "")));
      l1.appendChild(crear("b", "", "-" + moneda(m.monto)));
    }
    r.appendChild(l1);
    const l2 = crear("div", "linea2" + (m.tipo === "cobro" ? " con-boton" : ""));
    l2.appendChild(crear("span", "", (m.tipo === "fiado" ? formatoKg.format(m.kg) + " kg × " + moneda(m.precio) + " · " : "") +
      "Saldo después: " + moneda(m.saldoDespues)));
    if (m.tipo === "cobro") {
      const q = crear("button", "", "Quitar");
      q.type = "button";
      q.addEventListener("click", function () { quitarCobroUI({ id: m.id, monto: m.monto, fecha: m.fecha }); });
      l2.appendChild(q);
    }
    r.appendChild(l2);
    cont.appendChild(r);
  });

  if (datos.porConfirmar.length > 0) {
    cont.appendChild(crear("p", "subtitulo", "En ranchos abiertos (no cuentan hasta cerrarlos)"));
    datos.porConfirmar.forEach(function (l) {
      const r = crear("div", "renglon confirmar");
      const kg = Logica.aNumero(l.kg), precio = Logica.aNumero(l.precio);
      r.appendChild(crear("div", "linea1", formatoFecha(l.fecha) + " · " + NOMBRES_PRODUCTO[l.producto] + " · " + formatoKg.format(kg) + " kg × " + moneda(precio)));
      cont.appendChild(r);
    });
  }
}

// ---------- Registrar y quitar cobros ----------
function abrirFormCobro(datos) {
  $("formCobroTitulo").textContent = "Registrar cobro · " + datos.persona.nombre;
  $("cSaldo").textContent = "Saldo pendiente: " + moneda(datos.cuenta.saldo);
  $("cMonto").value = "";
  $("cFecha").value = hoyTexto();
  $("cNota").value = "";
  $("cError").hidden = true;
  $("formCobro").dataset.saldo = String(datos.cuenta.saldo);
  $("formCobro").hidden = false;
  $("cMonto").focus();
}

function guardarCobro() {
  try {
    Almacen.registrarCobro(vistaCuenta, $("cFecha").value, $("cMonto").value.trim(), $("cNota").value, hoyTexto());
    $("formCobro").hidden = true;
    marcarGuardado(true);
    dibujarCuentas();
    actualizarAvisoRespaldo();
  } catch (e) {
    $("cError").textContent = e.message;
    $("cError").hidden = false;
  }
}

function quitarCobroUI(cb) {
  if (!window.confirm("¿Quitar el cobro de " + moneda(cb.monto) + " del " + formatoFecha(cb.fecha) + "? El saldo de la persona volverá a subir.")) return;
  try {
    Almacen.quitarCobro(cb.id);
    marcarGuardado(true);
    dibujarCuentas();
  } catch (e) {
    mostrarErrorAlmacen(e.message);
  }
}

// ---------- Estado de cuenta en texto ----------
function abrirEstadoDeCuenta(datos) {
  $("eTexto").value = LogicaCuentas.textoEstadoDeCuenta(datos.persona.nombre, datos.cuenta, hoyTexto());
  $("eMensaje").hidden = true;
  $("formEstado").hidden = false;
}

function copiarEstado() {
  const area = $("eTexto");
  const aviso = $("eMensaje");
  const listo = function () { aviso.textContent = "Texto copiado."; aviso.hidden = false; };
  const manual = function () {
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    aviso.textContent = ok ? "Texto copiado." : "Selecciona el texto y cópialo (Ctrl + C).";
    aviso.hidden = false;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(area.value).then(listo, manual);
  } else {
    manual();
  }
}

// ---------- Subpestañas y vista ----------
const SUBPANELES = {
  dia: { panel: "panelDia", boton: "subDia" },
  personas: { panel: "panelPersonas", boton: "subPersonas" },
  fiados: { panel: "panelFiados", boton: "subFiados" }
};

function ponerSubpanel(nombre) {
  subpanel = nombre;
  Object.keys(SUBPANELES).forEach(function (k) {
    $(SUBPANELES[k].panel).hidden = k !== nombre;
    $(SUBPANELES[k].boton).className = k === nombre ? "activa" : "";
  });
  $("pieRancho").hidden = nombre !== "dia" || $("vistaRancho").hidden;
  $("avisoRancho").hidden = nombre !== "dia" || !ranchoSoloLectura;
  if (nombre === "personas") dibujarPersonas();
  if (nombre === "fiados") { vistaCuenta = null; dibujarCuentas(); }
}

// pantalla.js llama a esta función cada vez que cambias de pestaña
function alMostrarVistaRancho(nombre) {
  if (nombre === "rancho") {
    cargarRanchoFecha($("fecha").value);
    ponerSubpanel(subpanel);
  } else {
    $("pieRancho").hidden = true;
  }
}

// ---------- Exportaciones del rancho ----------
function alExportarCSVRancho() {
  try {
    descargar("tortilleria-rancho-" + fechaDeHoy() + ".csv", Almacen.aCSVRancho(), "text/csv;charset=utf-8");
    mensajeRespaldo("Rancho exportado (solo ranchos cerrados).", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo exportar: " + e.message, "mal");
  }
}

function alExportarCSVFiados() {
  try {
    descargar("tortilleria-fiados-" + fechaDeHoy() + ".csv", Almacen.aCSVFiados(), "text/csv;charset=utf-8");
    mensajeRespaldo("Fiados exportados (solo de ranchos cerrados).", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo exportar: " + e.message, "mal");
  }
}

function alExportarCSVCobros() {
  try {
    descargar("tortilleria-cobros-" + fechaDeHoy() + ".csv", Almacen.aCSVCobros(), "text/csv;charset=utf-8");
    mensajeRespaldo("Cobros exportados.", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo exportar: " + e.message, "mal");
  }
}

function alExportarCSVSaldos() {
  try {
    descargar("tortilleria-saldos-" + fechaDeHoy() + ".csv", Almacen.aCSVSaldos(fechaDeHoy()), "text/csv;charset=utf-8");
    mensajeRespaldo("Saldos por persona exportados.", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo exportar: " + e.message, "mal");
  }
}

// ---------- Arranque del rancho ----------
construirPanelDia();
conectarPanelDia();
$("tabRancho").addEventListener("click", function () { mostrarVista("rancho"); });
$("subDia").addEventListener("click", function () { ponerSubpanel("dia"); });
$("subPersonas").addEventListener("click", function () { ponerSubpanel("personas"); });
$("subFiados").addEventListener("click", function () { ponerSubpanel("fiados"); });
$("btnCerrarRancho").addEventListener("click", abrirResumenRancho);
$("btnVolverRancho").addEventListener("click", function () { $("superposicionRancho").hidden = true; });
$("btnConfirmarRancho").addEventListener("click", confirmarCierreRancho);
$("btnReabrirRancho").addEventListener("click", reabrirRanchoUI);
$("btnNuevaPersona").addEventListener("click", function () { abrirFormPersona(null); });
$("btnGuardarPersona").addEventListener("click", guardarFormPersona);
$("btnCancelarPersona").addEventListener("click", function () { $("formPersona").hidden = true; });
$("btnGuardarFiado").addEventListener("click", guardarFiado);
$("btnCancelarFiado").addEventListener("click", function () { $("formFiado").hidden = true; });
$("fPersona").addEventListener("change", actualizarPreciosFiado);
$("btnGuardarCobro").addEventListener("click", guardarCobro);
$("btnCancelarCobro").addEventListener("click", function () { $("formCobro").hidden = true; });
$("btnCobrarTodo").addEventListener("click", function () {
  $("cMonto").value = String(Logica.redondear(Number($("formCobro").dataset.saldo), 2));
});
$("btnCerrarEstado").addEventListener("click", function () { $("formEstado").hidden = true; });
$("btnCopiarEstado").addEventListener("click", copiarEstado);
$("btnExportarCSVCobros").addEventListener("click", alExportarCSVCobros);
$("btnExportarCSVSaldos").addEventListener("click", alExportarCSVSaldos);
$("btnGuardarPrecios").addEventListener("click", guardarFormPrecios);
$("btnCancelarPrecios").addEventListener("click", function () { $("formPrecios").hidden = true; });
$("btnExportarCSVRancho").addEventListener("click", alExportarCSVRancho);
$("btnExportarCSVFiados").addEventListener("click", alExportarCSVFiados);
$("fecha").addEventListener("change", function () {
  if ($("fecha").value) cargarRanchoFecha($("fecha").value);
});
cargarRanchoFecha($("fecha").value);
