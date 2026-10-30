// ============================================================
// pruebas.js  -  Pruebas automáticas de logica.js
// ------------------------------------------------------------
// Cada prueba compara un resultado ESPERADO (calculado a mano,
// igual que en la hoja de validación) contra el que da el código.
// ============================================================

// ---- Datos de ejemplo: 2 días x 15 tiendas (los mismos del Historial de la hoja)
const ENT_DIA1 = [30,25,20,18,22,15,28,12,35,10,24,16,26,14,20];
const SOB_DIA1 = [2,1,0,1.5,0,0,3,0,2,1,0,2.5,1,0,0.5];
const ENT_DIA2 = [28,26,22,17,20,16,30,13,33,11,25,15,27,15,21];
const SOB_DIA2 = [1,2,1,0,2,0,2,1,0,0,1.5,0,2,1,0];

// Precio de ejemplo: tiendas impares $17, pares $18.
// Tienda 3 cambió de $17 (día 1) a $18 (día 2).
function precioDeEjemplo(numeroTienda, dia) {
  if (numeroTienda === 3) return dia === 1 ? 17 : 18;
  return numeroTienda % 2 === 0 ? 18 : 17;
}

function lineasDelDia(entregados, sobrantes, dia) {
  return entregados.map(function (e, i) {
    return { precio: precioDeEjemplo(i + 1, dia), entregados: e, sobrantes: sobrantes[i], activa: true };
  });
}

const DIA1 = Logica.resumirReparto(lineasDelDia(ENT_DIA1, SOB_DIA1, 1));
const DIA2 = Logica.resumirReparto(lineasDelDia(ENT_DIA2, SOB_DIA2, 2));
const T3_DIA1 = Logica.calcularLinea(precioDeEjemplo(3, 1), ENT_DIA1[2], SOB_DIA1[2], true);
const T3_DIA2 = Logica.calcularLinea(precioDeEjemplo(3, 2), ENT_DIA2[2], SOB_DIA2[2], true);

// Cada prueba: id, descripción, esperado (a mano), obtenido (del código)
const PRUEBAS = [];
function prueba(id, descripcion, esperado, obtenido) {
  PRUEBAS.push({ id: id, descripcion: descripcion, esperado: esperado, obtenido: obtenido });
}

// ---- A. Cálculo por tienda (casos C1 a C9 de la hoja) -------------
const casosC = [
  ["C1", "Tienda a $17 con sobrantes", 17, 30, 2, 28, 476],
  ["C2", "Tienda a $18 con sobrantes", 18, 25, 1, 24, 432],
  ["C3", "Tienda a $17 sin sobrantes", 17, 20, 0, 20, 340],
  ["C4", "Tienda a $18 sin sobrantes", 18, 12, 0, 12, 216],
  ["C5", "Decimales a $17", 17, 10.5, 1.5, 9, 153],
  ["C6", "Decimales a $18", 18, 7.25, 0.75, 6.5, 117],
  ["C7", "Día sin ventas (0 entregados)", 17, 0, 0, 0, 0],
  ["C8", "Todo devuelto", 18, 10, 10, 0, 0],
  ["C9", "Decimal con importe decimal", 17, 3.3, 0.1, 3.2, 54.4]
];
casosC.forEach(function (c) {
  const r = Logica.calcularLinea(c[2], c[3], c[4], true);
  prueba(c[0] + " netos", c[1] + ": kg netos", c[5], r.netos);
  prueba(c[0] + " importe", c[1] + ": importe", c[6], r.importe);
});

// ---- B. Validación de datos (casos V1 a V9 de la hoja) ------------
const casosV = [
  ["V1", "Dato válido", 10, 2, true, "OK"],
  ["V2", "Entregados negativo", -5, 0, true, "Negativo"],
  ["V3", "Sobrante negativo", 10, -1, true, "Negativo"],
  ["V4", "Sobrante mayor que entregado", 5, 8, true, "Sobrante mayor que entregado"],
  ["V5", "Falta entregados", "", 2, true, "Falta entregados"],
  ["V6", "Falta sobrante (debe escribirse 0)", 10, "", true, "Falta sobrante (escribe 0)"],
  ["V7", "Texto en lugar de número", "abc", 0, true, "No es número"],
  ["V8", "Fila sin captura", "", "", true, "Sin captura"],
  ["V9", "Tienda desactivada con datos", 5, 0, false, "Tienda desactivada"]
];
casosV.forEach(function (v) {
  prueba(v[0], v[1], v[5], Logica.validarLinea(v[2], v[3], v[4]));
});
// Extras: lo que escribe una persona en un campo llega como texto
prueba("V10", "Número escrito como texto (\"30\") es válido", "OK", Logica.validarLinea("30", "2", true));
prueba("V11", "Decimal con coma (\"1,5\") no es número", "No es número", Logica.validarLinea("10", "1,5", true));

// ---- C. Resumen de varios días (casos H1 a H9 de la hoja) ---------
prueba("H1", "Día 1: kg entregados", 315, DIA1.kgEntregados);
prueba("H2", "Día 1: kg fríos", 14.5, DIA1.kgFrios);
prueba("H3", "Día 1: importe", 5212.5, DIA1.total);
prueba("H4", "Día 2: kg entregados", 319, DIA2.kgEntregados);
prueba("H5", "Día 2: kg fríos", 13.5, DIA2.kgFrios);
prueba("H6", "Día 2: importe", 5323.5, DIA2.total);
prueba("H7", "Tienda 3, día 1 a $17: importe", 340, T3_DIA1.importe);
prueba("H8", "Tienda 3, día 2 a $18: importe", 378, T3_DIA2.importe);
prueba("H9", "Fríos acumulados de los 2 días", 28, Logica.redondear(DIA1.kgFrios + DIA2.kgFrios, 4));

// ---- D. Resumen del día: casos nuevos de esta fase ----------------
const EJEMPLO = Logica.resumirReparto([
  { precio: 17, entregados: 30, sobrantes: 2, activa: true },
  { precio: 18, entregados: 25, sobrantes: 1, activa: true },
  { precio: 17, entregados: "", sobrantes: "", activa: true }
]);
prueba("D1", "Ejemplo de la hoja: total del día", 908, EJEMPLO.total);
prueba("D2", "Ejemplo de la hoja: kg fríos", 3, EJEMPLO.kgFrios);
prueba("D3", "Ejemplo de la hoja: estado", "Listo para cerrar", EJEMPLO.estado);

const CON_ERROR = Logica.resumirReparto([
  { precio: 17, entregados: 30, sobrantes: 2, activa: true },
  { precio: 17, entregados: 5, sobrantes: 8, activa: true }
]);
prueba("D4", "Fila con error no suma al total", 476, CON_ERROR.total);
prueba("D5", "Fila con error pide revisar", "Revisar 1 fila(s)", CON_ERROR.estado);

const SIN_DATOS = Logica.resumirReparto([
  { precio: 17, entregados: "", sobrantes: "", activa: true },
  { precio: 18, entregados: "", sobrantes: "", activa: true }
]);
prueba("D6", "Día sin datos: estado", "Sin datos", SIN_DATOS.estado);
prueba("D7", "Día sin datos: total", 0, SIN_DATOS.total);
prueba("D8", "Control de cuadre del día 1", "Cuadra", DIA1.control);


// ---- E. Extras de tarde, devoluciones de tarde y check "se cobra hoy" --
// Calculados a mano. Las devoluciones bajan el dinero pero NO los kg entregados.
(function () {
  const L = Logica;
  let r = L.calcularLinea(17, "30", "0", true, "5", "3");
  prueba("N1 entregados", "Tienda A: 30 de mañana + 5 extras = 35 entregados", 35, r.entregadosTotal);
  prueba("N1 netos", "Tienda A: 35 - 3 devueltas = 32 netos", 32, r.netos);
  prueba("N1 importe", "Tienda A: 32 x $17 = $544", 544, r.importe);
  r = L.calcularLinea(18, "25", "1", true, "", "1");
  prueba("N2 entregados", "Tienda B: sin extras, 25 entregados", 25, r.entregadosTotal);
  prueba("N2 netos", "Tienda B: 25 - 1 fría - 1 devuelta = 23 netos", 23, r.netos);
  prueba("N2 importe", "Tienda B: 23 x $18 = $414", 414, r.importe);
  r = L.calcularLinea(17, "0", "0", true, "10", "");
  prueba("N3", "Solo extras de tarde (mañana 0): 10 kg x $17 = $170", 170, r.importe);
  r = L.calcularLinea(17, "10", "0", true, "1.5", "0.5");
  prueba("N4", "Decimales: (10 + 1.5 - 0.5) x $17 = $187", 187, r.importe);
  prueba("N5", "Extras y devoluciones vacíos cuentan como 0 (igual que antes)", 170, L.calcularLinea(17, "10", "0", true, "", "").importe);
  prueba("N6", "Sin enviar extras ni devoluciones (formato anterior): igual", 170, L.calcularLinea(17, "10", "0", true).importe);

  prueba("N7", "Extras con texto: 'No es número'", "No es número", L.validarLinea("10", "0", true, "mucho", ""));
  prueba("N8", "Devoluciones negativas: 'Negativo'", "Negativo", L.validarLinea("10", "0", true, "", "-2"));
  prueba("N9", "Devoluciones + fría mayores que lo entregado", "Devoluciones y sobrantes superan lo entregado", L.validarLinea("10", "6", true, "", "5"));
  prueba("N10", "Devoluciones + fría justo iguales a lo entregado: válido", "OK", L.validarLinea("10", "6", true, "", "4"));
  prueba("N11", "Los extras amplían lo que se puede devolver (5 + 5, fría 8)", "OK", L.validarLinea("5", "8", true, "5", ""));
  prueba("N12", "Fría mayor que mañana + extras", "Sobrante mayor que entregado", L.validarLinea("5", "11", true, "5", ""));
  prueba("N13", "Solo extras sin entregas de mañana: pide escribir 0", "Falta entregados", L.validarLinea("", "0", true, "5", ""));
  prueba("N14", "Todo vacío: sin captura", "Sin captura", L.validarLinea("", "", true, "", ""));
  prueba("N15", "Una devolución sin nada más: pide completar", "Falta entregados", L.validarLinea("", "", true, "", "2"));

  r = L.calcularLinea(18, "25", "0", true, "", "", false);
  prueba("N16 cobrado", "Tienda sin cobro hoy: cobrado $0", 0, r.cobrado);
  prueba("N16 no cobrado", "Tienda sin cobro hoy: $450 quedan como no cobrados", 450, r.noCobrado);
  prueba("N16 importe", "Tienda sin cobro hoy: el importe calculado se conserva ($450)", 450, r.importe);
  prueba("N16 netos", "Tienda sin cobro hoy: los kg netos cuentan (25)", 25, r.netos);
  r = L.calcularLinea(18, "25", "0", true, "", "", true);
  prueba("N17", "Con el check puesto: cobrado $450 y no cobrado $0", "450-0", r.cobrado + "-" + r.noCobrado);

  // Un día completo: A cobra, B es de cobro quincenal, C cobra y tiene fría
  const dia = L.resumirReparto([
    { precio: 17, entregados: "30", sobrantes: "0", activa: true, extras: "5", devoluciones: "3", cobrar: true },
    { precio: 18, entregados: "25", sobrantes: "0", activa: true, extras: "", devoluciones: "", cobrar: false },
    { precio: 17, entregados: "10", sobrantes: "1", activa: true, extras: "", devoluciones: "", cobrar: true },
    { precio: 17, entregados: "", sobrantes: "", activa: true }
  ]);
  prueba("N18", "Día: kg entregados = 35 + 25 + 10 (incluye la tienda que no se cobra)", 70, dia.kgEntregados);
  prueba("N19", "Día: las devoluciones no restan de lo entregado, se suman aparte (3)", 3, dia.kgDevoluciones);
  prueba("N20", "Día: extras de tarde (5)", 5, dia.kgExtras);
  prueba("N21", "Día: kg de mañana (65)", 65, dia.kgManana);
  prueba("N22", "Día: kg fríos (1)", 1, dia.kgFrios);
  prueba("N23", "Día: kg netos 32 + 25 + 9 = 66", 66, dia.kgNetos);
  prueba("N24", "Día: dinero neto = $544 + $153 (sin la tienda quincenal)", 697, dia.total);
  prueba("N25", "Día: no cobrado = $450", 450, dia.totalNoCobrado);
  prueba("N26", "Día: importe calculado total = $1,147", 1147, dia.importeCalculado);
  prueba("N27", "Día: 1 tienda sin cobro", 1, dia.tiendasSinCobro);
  prueba("N28", "Día: control cuadra (70 - 1 - 3 = 66)", "Cuadra", dia.control);
  prueba("N29", "Día: estado listo", "Listo para cerrar", dia.estado);

  const frioQuincenal = L.resumirReparto([
    { precio: 18, entregados: "25", sobrantes: "2", activa: true, cobrar: false },
    { precio: 17, entregados: "10", sobrantes: "1", activa: true }
  ]);
  prueba("N30", "La fría de una tienda sin cobro se suma normal (3 kg)", 3, frioQuincenal.kgFrios);
  prueba("N31", "…y su dinero no entra: solo $153 (9 x $17)", 153, frioQuincenal.total);
  prueba("N32", "…lo no cobrado es 23 x $18 = $414", 414, frioQuincenal.totalNoCobrado);
  const nadaCobra = L.resumirReparto([
    { precio: 18, entregados: "25", sobrantes: "0", activa: true, cobrar: false },
    { precio: 17, entregados: "10", sobrantes: "0", activa: true, cobrar: false }
  ]);
  prueba("N33", "Si ninguna tienda se cobra: dinero neto $0", 0, nadaCobra.total);
  prueba("N34", "…pero los 35 kg cuentan como entregados", 35, nadaCobra.kgEntregados);
  prueba("N35", "…y el estado sigue siendo 'Listo para cerrar'", "Listo para cerrar", nadaCobra.estado);
  const conError = L.resumirReparto([
    { precio: 17, entregados: "10", sobrantes: "6", activa: true, extras: "", devoluciones: "5", cobrar: false },
    { precio: 17, entregados: "10", sobrantes: "0", activa: true }
  ]);
  prueba("N36", "Fila con error no suma kg ni dinero (solo la otra: 10 kg)", 10, conError.kgEntregados);
  prueba("N37", "Fila con error pide revisar", "Revisar 1 fila(s)", conError.estado);
})();

// ---- Ejecutor: compara esperado contra obtenido -------------------
function ejecutarPruebas() {
  return PRUEBAS.map(function (p) {
    let ok;
    if (typeof p.esperado === "number") {
      ok = typeof p.obtenido === "number" && Math.abs(p.esperado - p.obtenido) < 0.005;
    } else {
      ok = p.esperado === p.obtenido;
    }
    return { id: p.id, descripcion: p.descripcion, esperado: p.esperado, obtenido: p.obtenido, ok: ok };
  });
}
