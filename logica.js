// ============================================================
// logica.js  -  Reglas de cálculo de la tortillería
// ------------------------------------------------------------
// Este archivo SOLO hace cuentas. No dibuja pantallas ni guarda
// datos. Por eso lo podemos probar solo y reutilizar después en
// el iPhone sin cambiarle nada.
//
// Reglas:
//   kg entregados = entregas de la mañana + extras de la tarde
//   kg netos      = kg entregados - kg sobrantes (fría recogida)
//                   - devoluciones de la tarde
//   importe       = kg netos x precio por kg
//   Las DEVOLUCIONES de la tarde bajan el dinero pero NO se restan
//   de los kg entregados (son tortilla caliente que regresa sin cobrarse).
//   Cada tienda tiene un check "se cobra hoy". Si NO se cobra, sus kg
//   cuentan completos (entregados, netos, fría), pero su dinero no entra
//   al dinero neto del día: se muestra aparte como "no cobrado".
//   dinero neto del día = suma de los importes de las tiendas que se cobran
//   kg fríos      = suma de los sobrantes de TODAS las tiendas (solo
//                   informativo, NUNCA se restan otra vez)
// ============================================================

const Logica = {

  // Redondea un número a cierta cantidad de decimales.
  // Sirve para evitar errores típicos de computadora como
  // 0.1 + 0.2 = 0.30000000000000004
  redondear(valor, decimales) {
    const factor = Math.pow(10, decimales);
    return Math.round((valor + Number.EPSILON) * factor) / factor;
  },

  // ¿El campo está vacío? (nada escrito, o solo espacios)
  esVacio(valor) {
    return valor === null || valor === undefined ||
           (typeof valor === "string" && valor.trim() === "");
  },

  // ¿Lo escrito es un número válido? ("30" y 30 sí; "abc" no)
  // Ojo: el decimal va con punto (1.5). Con coma (1,5) NO es número.
  esNumero(valor) {
    if (typeof valor === "number") return Number.isFinite(valor);
    if (typeof valor === "string" && valor.trim() !== "") {
      return Number.isFinite(Number(valor));
    }
    return false;
  },

  // Convierte lo escrito a número. Solo usar después de validar.
  aNumero(valor) {
    return Number(valor);
  },

  // Revisa UNA fila (una tienda) y devuelve su estado en texto.
  // entregados = entregas de la mañana. extras y devoluciones son opcionales
  // (vacío cuenta como 0). Es el mismo orden de la columna "Estado" de la hoja.
  validarLinea(entregados, sobrantes, activa, extras, devoluciones) {
    if (activa === undefined) activa = true;
    const vacioE = this.esVacio(entregados);
    const vacioS = this.esVacio(sobrantes);
    const vacioX = this.esVacio(extras);
    const vacioD = this.esVacio(devoluciones);

    if (vacioE && vacioS && vacioX && vacioD) return "Sin captura";
    if (activa === false) return "Tienda desactivada";

    if ((!vacioE && !this.esNumero(entregados)) || (!vacioS && !this.esNumero(sobrantes)) ||
        (!vacioX && !this.esNumero(extras)) || (!vacioD && !this.esNumero(devoluciones))) return "No es número";

    if (vacioE) return "Falta entregados";
    if (vacioS) return "Falta sobrante (escribe 0)";

    const e = this.aNumero(entregados);
    const s = this.aNumero(sobrantes);
    const x = vacioX ? 0 : this.aNumero(extras);
    const d = vacioD ? 0 : this.aNumero(devoluciones);
    if (e < 0 || s < 0 || x < 0 || d < 0) return "Negativo";
    const total = e + x;
    if (s > total + 0.0001) return "Sobrante mayor que entregado";
    if (s + d > total + 0.0001) return "Devoluciones y sobrantes superan lo entregado";
    return "OK";
  },

  // Calcula UNA fila. Si la fila tiene error, no suma nada.
  // cobrar: false = la tienda no se cobra ese día (por defecto sí se cobra).
  // Devuelve: { estado, entregadosTotal, netos, importe, cobrado, noCobrado }
  //   importe   = lo que vale lo vendido (siempre se calcula)
  //   cobrado   = el importe si se cobra hoy, si no 0
  //   noCobrado = el importe si NO se cobra hoy, si no 0
  calcularLinea(precio, entregados, sobrantes, activa, extras, devoluciones, cobrar) {
    const estado = this.validarLinea(entregados, sobrantes, activa, extras, devoluciones);
    if (estado !== "OK") return { estado: estado, entregadosTotal: 0, netos: 0, importe: 0, cobrado: 0, noCobrado: 0 };
    const x = this.esVacio(extras) ? 0 : this.aNumero(extras);
    const d = this.esVacio(devoluciones) ? 0 : this.aNumero(devoluciones);
    const entregadosTotal = this.redondear(this.aNumero(entregados) + x, 4);
    const netos = this.redondear(entregadosTotal - this.aNumero(sobrantes) - d, 4);
    const importe = this.redondear(netos * precio, 2);
    const cobra = cobrar !== false;
    return {
      estado: estado, entregadosTotal: entregadosTotal, netos: netos, importe: importe,
      cobrado: cobra ? importe : 0, noCobrado: cobra ? 0 : importe
    };
  },

  // Resume TODO el reparto del día.
  // "lineas" es una lista; cada elemento tiene:
  //   { precio, entregados, sobrantes, activa, extras?, devoluciones?, cobrar? }
  resumirReparto(lineas) {
    let tiendasConCaptura = 0, filasConError = 0, tiendasSinCobro = 0;
    let kgManana = 0, kgExtras = 0, kgDevoluciones = 0, kgEntregados = 0, kgFrios = 0, kgNetos = 0;
    let total = 0, totalNoCobrado = 0;

    for (const l of lineas) {
      const r = this.calcularLinea(l.precio, l.entregados, l.sobrantes, l.activa, l.extras, l.devoluciones, l.cobrar);
      if (r.estado === "OK") {
        tiendasConCaptura += 1;
        if (l.cobrar === false) tiendasSinCobro += 1;
        kgManana += this.aNumero(l.entregados);
        kgExtras += this.esVacio(l.extras) ? 0 : this.aNumero(l.extras);
        kgDevoluciones += this.esVacio(l.devoluciones) ? 0 : this.aNumero(l.devoluciones);
        kgEntregados += r.entregadosTotal;
        kgFrios += this.aNumero(l.sobrantes);
        kgNetos += r.netos;
        total += r.cobrado;
        totalNoCobrado += r.noCobrado;
      } else if (r.estado !== "Sin captura") {
        filasConError += 1;
      }
    }

    kgManana = this.redondear(kgManana, 4);
    kgExtras = this.redondear(kgExtras, 4);
    kgDevoluciones = this.redondear(kgDevoluciones, 4);
    kgEntregados = this.redondear(kgEntregados, 4);
    kgFrios = this.redondear(kgFrios, 4);
    kgNetos = this.redondear(kgNetos, 4);
    total = this.redondear(total, 2);
    totalNoCobrado = this.redondear(totalNoCobrado, 2);

    let estado = "Listo para cerrar";
    if (filasConError > 0) estado = "Revisar " + filasConError + " fila(s)";
    else if (tiendasConCaptura === 0) estado = "Sin datos";

    // Control de cuadre: entregados - fríos - devoluciones debe ser igual a netos
    const cuadra = Math.abs(kgEntregados - kgFrios - kgDevoluciones - kgNetos) < 0.0001;

    return {
      tiendasConCaptura: tiendasConCaptura,
      tiendasSinCobro: tiendasSinCobro,
      kgManana: kgManana,
      kgExtras: kgExtras,
      kgDevoluciones: kgDevoluciones,
      kgEntregados: kgEntregados,
      kgFrios: kgFrios,
      kgNetos: kgNetos,
      total: total,                                   // dinero neto del día (solo tiendas que se cobran)
      totalNoCobrado: totalNoCobrado,                 // tiendas que hoy no se cobran
      importeCalculado: this.redondear(total + totalNoCobrado, 2),
      filasConError: filasConError,
      estado: estado,
      control: cuadra ? "Cuadra" : "NO CUADRA"
    };
  }
};
