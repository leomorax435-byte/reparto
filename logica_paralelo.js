// ============================================================
// logica_paralelo.js  -  Comparar la app contra la libreta (Fase 6)
// ------------------------------------------------------------
// SOLO hace cuentas, igual que logica.js. Necesita logica.js antes.
//
// Se compara, por día:
//   - Total de tiendas ($)               (obligatorio)
//   - Kg fríos recogidos en tiendas      (obligatorio)
//   - Total del rancho ($)               (obligatorio; si no hubo, 0)
//   - Fiado del día ($)                  (opcional)
//
// Diferencia = lo que dice la libreta - lo que calcula la app.
// Un día "coincide" si todo lo comparado da diferencia 0.
// Racha = días seguidos (los más recientes) que coinciden.
// ============================================================

const LogicaParalelo = {

  META_DIAS: 10,   // sugerencia: se puede cambiar aquí

  CAMPOS: [
    { clave: "tiendas", etiqueta: "Dinero neto de tiendas ($)", tipo: "dinero", opcional: false },
    { clave: "frios", etiqueta: "Kg fríos recogidos en tiendas", tipo: "kg", opcional: false },
    { clave: "rancho", etiqueta: "Total del rancho ($)", tipo: "dinero", opcional: false },
    { clave: "fiado", etiqueta: "Fiado del día ($)", tipo: "dinero", opcional: true }
  ],

  // Revisa lo que se escribió de la libreta en un campo
  validarCampo(valor, opcional) {
    if (Logica.esVacio(valor)) return opcional ? "Sin dato" : "Falta";
    if (!Logica.esNumero(valor)) return "No es número";
    if (Logica.aNumero(valor) < 0) return "Negativo";
    return "OK";
  },

  // app: { tiendas, frios, rancho, fiado }  (números de la app)
  // libreta: { tiendas, frios, rancho, fiado }  (lo escrito de la libreta)
  comparar(app, libreta) {
    const self = this;
    const campos = this.CAMPOS.map(function (c) {
      const bruto = libreta[c.clave];
      const estado = self.validarCampo(bruto, c.opcional);
      let libretaNum = null, diferencia = null, coincide = false;
      if (estado === "OK") {
        libretaNum = Logica.aNumero(bruto);
        diferencia = Logica.redondear(libretaNum - app[c.clave], 2);
        coincide = Math.abs(diferencia) < 0.005;
      }
      return {
        clave: c.clave, etiqueta: c.etiqueta, tipo: c.tipo, opcional: c.opcional,
        app: app[c.clave], libreta: libretaNum, estado: estado, diferencia: diferencia, coincide: coincide
      };
    });
    const completo = campos.every(function (c) {
      return c.opcional ? (c.estado === "OK" || c.estado === "Sin dato") : c.estado === "OK";
    });
    const coincide = completo && campos.every(function (c) { return c.estado === "Sin dato" || c.coincide; });
    return { campos: campos, completo: completo, coincide: coincide };
  },

  // evaluaciones: lista de { estado } ordenada de la fecha MÁS RECIENTE a la más antigua.
  // estado: "coincide" | "diferencia" | "pendiente"
  resumir(evaluaciones) {
    let racha = 0;
    for (let i = 0; i < evaluaciones.length; i++) {
      if (evaluaciones[i].estado === "coincide") racha += 1; else break;
    }
    const cuenta = function (e) { return evaluaciones.filter(function (x) { return x.estado === e; }).length; };
    return {
      total: evaluaciones.length,
      coinciden: cuenta("coincide"),
      conDiferencia: cuenta("diferencia"),
      pendientes: cuenta("pendiente"),
      racha: racha,
      meta: this.META_DIAS,
      cumplida: racha >= this.META_DIAS
    };
  }
};
