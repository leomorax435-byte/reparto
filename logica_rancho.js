// ============================================================
// logica_rancho.js  -  Reglas de cálculo del RANCHO
// ------------------------------------------------------------
// Igual que logica.js: SOLO hace cuentas. No dibuja pantallas ni
// guarda datos. Necesita que logica.js esté cargado antes.
//
// Productos: caliente, fría y masa.
//
// Regla general (por producto):
//   kg vendidos de contado = kg llevados - kg fiados - kg que regresan
//   dinero esperado        = kg vendidos x precio
//
// Fría (tiene dos precios, por eso se capturan dos cantidades):
//   kg llevados = fría recogida hoy en las tiendas (automática)
//                 + fría extra de otras rutas (manual)
//   kg de contado a precio A + kg de contado a precio B
//       deben ser IGUALES a (llevados - fiados - regresan)
//
// Fiados: lo fiado NO entra al dinero esperado. Se muestra aparte
// como "fiado por cobrar" (no es dinero recibido).
//
// Total del día = total de tiendas + dinero esperado del rancho.
// ============================================================

const LogicaRancho = {

  PRODUCTOS: ["caliente", "fria", "masa"],

  preciosPorDefecto() {
    return { caliente: 20, masa: 13, friaA: 12, friaB: 13 };
  },

  // Un rancho del día en blanco
  nuevoRancho(fecha, precios) {
    return {
      fecha: fecha,
      estado: "abierto",
      precios: precios || this.preciosPorDefecto(),
      caliente: { llevados: "", regresan: "" },
      fria: { extra: "", regresan: "", contadoA: "", contadoB: "" },
      masa: { llevados: "", regresan: "" },
      fiados: []
    };
  },

  // ---------- Fiados ----------
  // Una línea de fiado: { personaId, nombre, producto, kg, precio }
  validarFiado(f) {
    if (!f || Logica.esVacio(f.personaId) || Logica.esVacio(f.nombre)) return "Falta persona";
    if (this.PRODUCTOS.indexOf(f.producto) < 0) return "Producto desconocido";
    if (!Logica.esNumero(f.kg)) return "Kg no válido";
    if (Logica.aNumero(f.kg) <= 0) return "Kg debe ser mayor que 0";
    if (!Logica.esNumero(f.precio) || Logica.aNumero(f.precio) <= 0) return "Precio no válido";
    return "OK";
  },

  // ---------- Caliente y masa (un solo precio) ----------
  // fiadosKg: kilos fiados de ese producto (ya sumados, solo líneas válidas)
  validarProducto(llevados, regresan, fiadosKg) {
    const vacioL = Logica.esVacio(llevados);
    const vacioR = Logica.esVacio(regresan);
    if (vacioL && vacioR && fiadosKg === 0) return "Sin captura";
    if ((!vacioL && !Logica.esNumero(llevados)) || (!vacioR && !Logica.esNumero(regresan))) return "No es número";
    if (vacioL) return "Falta llevados";
    if (vacioR) return "Falta regresan (escribe 0)";
    const l = Logica.aNumero(llevados), r = Logica.aNumero(regresan);
    if (l < 0 || r < 0) return "Negativo";
    if (fiadosKg + r > l + 0.0001) return "Fiados y regresan superan lo llevado";
    return "OK";
  },

  calcularProducto(precio, llevados, regresan, fiadosKg) {
    const estado = this.validarProducto(llevados, regresan, fiadosKg);
    if (estado !== "OK") return { estado: estado, vendidos: 0, dinero: 0 };
    const vendidos = Logica.redondear(Logica.aNumero(llevados) - fiadosKg - Logica.aNumero(regresan), 4);
    return { estado: estado, vendidos: vendidos, dinero: Logica.redondear(vendidos * precio, 2) };
  },

  // ---------- Fría (dos precios) ----------
  // f: { extra, regresan, contadoA, contadoB }   deTiendas: número (automático)
  validarFria(f, deTiendas, fiadosKg) {
    const campos = [f.extra, f.regresan, f.contadoA, f.contadoB];
    const todosVacios = campos.every(function (c) { return Logica.esVacio(c); });
    if (todosVacios && deTiendas === 0 && fiadosKg === 0) return "Sin captura";
    const hayTexto = campos.some(function (c) { return !Logica.esVacio(c) && !Logica.esNumero(c); });
    if (hayTexto) return "No es número";
    if (Logica.esVacio(f.regresan)) return "Falta regresan (escribe 0)";
    if (Logica.esVacio(f.contadoA) || Logica.esVacio(f.contadoB)) return "Falta kilos de contado (escribe 0)";
    const n = function (v) { return Logica.esVacio(v) ? 0 : Logica.aNumero(v); };
    if (n(f.extra) < 0 || n(f.regresan) < 0 || n(f.contadoA) < 0 || n(f.contadoB) < 0) return "Negativo";
    const llevados = deTiendas + n(f.extra);
    if (fiadosKg + n(f.regresan) > llevados + 0.0001) return "Fiados y regresan superan lo llevado";
    const esperado = llevados - fiadosKg - n(f.regresan);
    if (Math.abs(n(f.contadoA) + n(f.contadoB) - esperado) > 0.0001) return "Lo vendido de contado no cuadra";
    return "OK";
  },

  calcularFria(precios, f, deTiendas, fiadosKg) {
    const estado = this.validarFria(f, deTiendas, fiadosKg);
    const n = function (v) { return Logica.esVacio(v) ? 0 : Logica.aNumero(v); };
    const llevados = Logica.redondear(deTiendas + n(f.extra), 4);
    const esperadoContado = Logica.redondear(llevados - fiadosKg - n(f.regresan), 4);
    if (estado !== "OK") return { estado: estado, llevados: llevados, esperadoContado: esperadoContado, vendidos: 0, dinero: 0 };
    const vendidos = Logica.redondear(n(f.contadoA) + n(f.contadoB), 4);
    const dinero = Logica.redondear(n(f.contadoA) * precios.friaA + n(f.contadoB) * precios.friaB, 2);
    return { estado: estado, llevados: llevados, esperadoContado: esperadoContado, vendidos: vendidos, dinero: dinero };
  },

  // ---------- Resumen del rancho ----------
  // friaDeTiendas: kg fríos recogidos hoy en las tiendas (viene del reparto)
  resumirRancho(r, friaDeTiendas) {
    const self = this;
    const kgFiados = { caliente: 0, fria: 0, masa: 0 };
    let fiadoPorCobrar = 0, fiadosConError = 0, fiadosValidos = 0;

    r.fiados.forEach(function (f) {
      if (self.validarFiado(f) === "OK") {
        fiadosValidos += 1;
        kgFiados[f.producto] += Logica.aNumero(f.kg);
        fiadoPorCobrar += Logica.aNumero(f.kg) * Logica.aNumero(f.precio);
      } else {
        fiadosConError += 1;
      }
    });
    Object.keys(kgFiados).forEach(function (k) { kgFiados[k] = Logica.redondear(kgFiados[k], 4); });
    fiadoPorCobrar = Logica.redondear(fiadoPorCobrar, 2);

    const caliente = this.calcularProducto(r.precios.caliente, r.caliente.llevados, r.caliente.regresan, kgFiados.caliente);
    const masa = this.calcularProducto(r.precios.masa, r.masa.llevados, r.masa.regresan, kgFiados.masa);
    const fria = this.calcularFria(r.precios, r.fria, friaDeTiendas, kgFiados.fria);

    const productos = [caliente, fria, masa];
    const productosConError = productos.filter(function (p) { return p.estado !== "OK" && p.estado !== "Sin captura"; }).length;
    const filasConError = fiadosConError + productosConError;
    const todoVacio = productos.every(function (p) { return p.estado === "Sin captura"; }) && r.fiados.length === 0;

    let estado = "Listo para cerrar";
    if (filasConError > 0) estado = "Revisar " + filasConError + " fila(s)";
    else if (todoVacio) estado = "Sin datos";

    const dineroRancho = Logica.redondear(
      (caliente.estado === "OK" ? caliente.dinero : 0) +
      (fria.estado === "OK" ? fria.dinero : 0) +
      (masa.estado === "OK" ? masa.dinero : 0), 2);

    return {
      caliente: caliente, fria: fria, masa: masa,
      kgFiados: kgFiados,
      fiadosValidos: fiadosValidos,
      fiadoPorCobrar: fiadoPorCobrar,
      dineroRancho: dineroRancho,
      filasConError: filasConError,
      estado: estado
    };
  },

  // ---------- Total del día: tiendas + rancho ----------
  // tiendas y rancho: { total: número, cerrado: true/false }
  // Si alguna de las dos partes no está cerrada, el total es PROVISIONAL.
  resumirDia(tiendas, rancho) {
    return {
      totalTiendas: tiendas.total,
      totalRancho: rancho.total,
      totalDia: Logica.redondear(tiendas.total + rancho.total, 2),
      provisional: !(tiendas.cerrado && rancho.cerrado)
    };
  }
};
