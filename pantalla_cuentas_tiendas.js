// ============================================================
// pantalla_cuentas_tiendas.js  -  Cuentas por cobrar de las TIENDAS
// ------------------------------------------------------------
// Vive dentro de la pestaña "Tiendas", en la subpestaña "Por cobrar".
// Se carga después de pantalla.js y pantalla_rancho.js y usa sus
// utilidades. Las cuentas las calcula logica_cuentas.js y el
// guardado lo hace almacenamiento.js.
//
// Una tienda aparece aquí cuando un día se le deja tortilla y su check
// "Se cobra hoy" está SIN marcar, y ese reparto ya está cerrado.
// La cuenta es un saldo en dinero: lo no cobrado suma, lo que paga resta.
// ============================================================

let subTiendas = "lista";
let vistaCuentaT = null;       // número de la tienda cuya cuenta se está viendo
let ordenT = "saldo";
let filtroT = "todos";

const SUBTIENDAS = {
  lista: { panel: "panelTiendasLista", boton: "subTiendasLista" },
  cobrar: { panel: "panelTiendasCobrar", boton: "subTiendasCobrar" }
};

function ponerSubTiendas(nombre) {
  subTiendas = nombre;
  Object.keys(SUBTIENDAS).forEach(function (k) {
    $(SUBTIENDAS[k].panel).hidden = k !== nombre;
    $(SUBTIENDAS[k].boton).className = k === nombre ? "activa" : "";
  });
  if (nombre === "cobrar") { vistaCuentaT = null; dibujarCuentasTiendas(); }
}

// pantalla.js llama a esta función cada vez que cambias de pestaña
function alMostrarVistaTiendas(nombre) {
  if (nombre === "tiendas") ponerSubTiendas(subTiendas);
}

function dibujarCuentasTiendas() {
  const cont = $("listaCuentasTiendas");
  cont.innerHTML = "";
  if (vistaCuentaT !== null) { dibujarDetalleTienda(cont); return; }

  const cuentas = Almacen.cuentasDeTiendas(hoyTexto());
  if (cuentas.length === 0) {
    cont.appendChild(crear("p", "vacio", "Todavía no hay días sin cobrar. Una tienda aparece aquí cuando se le deja tortilla un día, su check «Se cobra hoy» está sin marcar y ese reparto se cierra."));
    return;
  }
  const rd = LogicaCuentas.resumenDeudores(cuentas, ordenT);

  cont.appendChild(crear("div", "resumen-general",
    "Total por cobrar de tiendas: " + moneda(rd.totalPorCobrar) + " · " + rd.deudores.length + (rd.deudores.length === 1 ? " tienda" : " tiendas")));

  const chips = crear("div", "chips");
  const todos = crear("button", "chip" + (filtroT === "todos" ? " activa" : ""), "Todas (" + rd.deudores.length + ")");
  todos.type = "button";
  todos.addEventListener("click", function () { filtroT = "todos"; dibujarCuentasTiendas(); });
  chips.appendChild(todos);
  LogicaCuentas.ORDEN_SEGMENTOS.forEach(function (seg) {
    const info = rd.porSegmento[seg];
    const chip = crear("button", "chip" + (filtroT === seg ? " activa" : ""),
      LogicaCuentas.ETIQUETAS_SEGMENTO[seg] + " · " + info.cantidad + " · " + moneda(info.monto));
    chip.type = "button";
    chip.addEventListener("click", function () { filtroT = seg; dibujarCuentasTiendas(); });
    chips.appendChild(chip);
  });
  cont.appendChild(chips);

  const orden = crear("label", "orden", "Ordenar por ");
  const sel = document.createElement("select");
  [["saldo", "Mayor saldo"], ["antiguedad", "Deuda más antigua"], ["nombre", "Nombre"]].forEach(function (o) {
    const op = document.createElement("option");
    op.value = o[0]; op.textContent = o[1];
    sel.appendChild(op);
  });
  sel.value = ordenT;
  sel.addEventListener("change", function () { ordenT = sel.value; dibujarCuentasTiendas(); });
  orden.appendChild(sel);
  cont.appendChild(orden);

  const visibles = rd.deudores.filter(function (p) { return filtroT === "todos" || p.cuenta.segmento === filtroT; });
  if (visibles.length === 0) cont.appendChild(crear("p", "vacio", "Ninguna tienda en este segmento."));
  visibles.forEach(function (p) { cont.appendChild(botonTienda(p)); });

  if (filtroT === "todos" && rd.sinSaldo.length > 0) {
    cont.appendChild(crear("p", "subtitulo", "Sin saldo pendiente"));
    rd.sinSaldo.forEach(function (p) { cont.appendChild(botonTienda(p)); });
  }
}

function botonTienda(p) {
  const c = p.cuenta;
  const b = crear("button", "deudor " + c.segmento);
  b.type = "button";
  b.appendChild(crear("span", "nombre", p.nombre + (p.activa ? "" : " (desactivada)") + (p.cobroQuincenal ? " · quincenal" : "")));
  b.appendChild(crear("span", "saldo", c.saldo > 0 ? moneda(c.saldo) : (c.saldo < 0 ? "A favor " + moneda(c.aFavor) : "Pagado")));
  let sub = c.saldo > 0
    ? "Sin cobrar desde " + formatoFecha(c.fechaMasAntigua) + " (" + c.diasAntiguedad + (c.diasAntiguedad === 1 ? " día" : " días") + ") · " + LogicaCuentas.ETIQUETAS_SEGMENTO[c.segmento]
    : "Sin cobrar en total " + moneda(c.totalFiado) + " · cobrado " + moneda(c.totalCobrado);
  if (p.porConfirmar > 0) sub += " · tiene días en repartos abiertos";
  b.appendChild(crear("span", "sub", sub));
  b.addEventListener("click", function () { vistaCuentaT = p.tiendaId; dibujarCuentasTiendas(); });
  return b;
}

function textoDetalleDia(m) {
  const d = m.detalle;
  const kg = formatoKg;
  if (!d) return kg.format(m.kg) + " kg × " + moneda(m.precio);
  return "Mañana " + kg.format(d.manana) + " + extras " + kg.format(d.extras) + " - devoluciones " + kg.format(d.devoluciones) +
    " - fría " + kg.format(d.frios) + " = " + kg.format(m.kg) + " kg × " + moneda(m.precio);
}

function dibujarDetalleTienda(cont) {
  let datos;
  try { datos = Almacen.cuentaDeTienda(vistaCuentaT, hoyTexto()); } catch (e) { vistaCuentaT = null; dibujarCuentasTiendas(); return; }
  const c = datos.cuenta;

  const volver = crear("button", "volver", "← Todas las tiendas");
  volver.type = "button";
  volver.addEventListener("click", function () { vistaCuentaT = null; dibujarCuentasTiendas(); });
  cont.appendChild(volver);

  const cab = crear("div", "cuenta-cabecera");
  cab.appendChild(crear("h3", "", datos.tienda.nombre + (datos.tienda.activa ? "" : " (desactivada)") + (datos.tienda.cobroQuincenal ? " · cobro quincenal" : "")));
  cont.appendChild(cab);

  const cajas = crear("div", "cajas3");
  [["Sin cobrar en total", moneda(c.totalFiado)], ["Cobrado", moneda(c.totalCobrado)],
   [c.saldo < 0 ? "A su favor" : "Saldo", moneda(c.saldo < 0 ? c.aFavor : c.saldo)]].forEach(function (par) {
    const d = document.createElement("div");
    d.appendChild(crear("span", "", par[0]));
    d.appendChild(crear("b", "", par[1]));
    cajas.appendChild(d);
  });
  cont.appendChild(cajas);
  cont.appendChild(crear("p", "ayuda", c.saldo > 0
    ? "Sin cobrar desde " + formatoFecha(c.fechaMasAntigua) + " (" + c.diasAntiguedad + (c.diasAntiguedad === 1 ? " día" : " días") + ") · " + LogicaCuentas.ETIQUETAS_SEGMENTO[c.segmento]
    : "Sin saldo pendiente."));
  if (c.saldo > 0) cont.appendChild(crear("p", "ayuda", "El saldo es lo no cobrado menos lo pagado. La antigüedad supone que lo pagado cubre primero lo más antiguo."));

  const botones = crear("div", "cuenta-botones");
  const bCobro = crear("button", "principal", "Registrar cobro");
  bCobro.type = "button"; bCobro.id = "btnRegistrarCobroT"; bCobro.disabled = c.saldo <= 0;
  bCobro.addEventListener("click", function () { abrirFormCobroT(datos); });
  const bEstado = crear("button", "", "Estado de cuenta");
  bEstado.type = "button"; bEstado.id = "btnVerEstadoT";
  bEstado.addEventListener("click", function () { abrirEstadoT(datos); });
  botones.appendChild(bCobro); botones.appendChild(bEstado);
  cont.appendChild(botones);

  cont.appendChild(crear("p", "subtitulo", "Registro día por día (lo no cobrado suma, lo pagado resta)"));
  if (c.movimientos.length === 0) cont.appendChild(crear("p", "vacio", "Sin movimientos confirmados."));
  c.movimientos.forEach(function (m) {
    const r = crear("div", "renglon " + m.tipo);
    const l1 = crear("div", "linea1");
    if (m.tipo === "fiado") {
      l1.appendChild(crear("span", "", formatoFecha(m.fecha) + " · Entrega sin cobrar"));
      l1.appendChild(crear("b", "", "+" + moneda(m.monto)));
    } else {
      l1.appendChild(crear("span", "", formatoFecha(m.fecha) + " · Pago" + (m.nota ? " · " + m.nota : "")));
      l1.appendChild(crear("b", "", "-" + moneda(m.monto)));
    }
    r.appendChild(l1);
    const l2 = crear("div", "linea2" + (m.tipo === "cobro" ? " con-boton" : ""));
    l2.appendChild(crear("span", "", (m.tipo === "fiado" ? textoDetalleDia(m) + " · " : "") + "Saldo después: " + moneda(m.saldoDespues)));
    if (m.tipo === "cobro") {
      const q = crear("button", "", "Quitar");
      q.type = "button";
      q.addEventListener("click", function () { quitarCobroT({ id: m.id, monto: m.monto, fecha: m.fecha }); });
      l2.appendChild(q);
    }
    r.appendChild(l2);
    cont.appendChild(r);
  });

  if (datos.porConfirmar.length > 0) {
    cont.appendChild(crear("p", "subtitulo", "En repartos abiertos (no cuentan hasta cerrarlos)"));
    datos.porConfirmar.forEach(function (l) {
      const r = crear("div", "renglon confirmar");
      r.appendChild(crear("div", "linea1", formatoFecha(l.fecha) + " · " + textoDetalleDia(l)));
      cont.appendChild(r);
    });
  }
}

// ---------- Registrar y quitar cobros ----------
function abrirFormCobroT(datos) {
  $("formCobroTTitulo").textContent = "Registrar cobro · " + datos.tienda.nombre;
  $("cTSaldo").textContent = "Saldo pendiente: " + moneda(datos.cuenta.saldo);
  $("cTMonto").value = "";
  $("cTFecha").value = hoyTexto();
  $("cTNota").value = "";
  $("cTError").hidden = true;
  $("formCobroT").dataset.saldo = String(datos.cuenta.saldo);
  $("formCobroT").hidden = false;
  $("cTMonto").focus();
}

function guardarCobroT() {
  try {
    Almacen.registrarCobroTienda(vistaCuentaT, $("cTFecha").value, $("cTMonto").value.trim(), $("cTNota").value, hoyTexto());
    $("formCobroT").hidden = true;
    marcarGuardado(true);
    dibujarCuentasTiendas();
    actualizarAvisoRespaldo();
  } catch (e) {
    $("cTError").textContent = e.message;
    $("cTError").hidden = false;
  }
}

function quitarCobroT(cb) {
  if (!window.confirm("¿Quitar el cobro de " + moneda(cb.monto) + " del " + formatoFecha(cb.fecha) + "? El saldo de la tienda volverá a subir.")) return;
  try {
    Almacen.quitarCobroTienda(cb.id);
    marcarGuardado(true);
    dibujarCuentasTiendas();
  } catch (e) {
    mostrarErrorAlmacen(e.message);
  }
}

// ---------- Estado de cuenta en texto ----------
function abrirEstadoT(datos) {
  $("eTTexto").value = LogicaCuentas.textoEstadoDeCuenta(datos.tienda.nombre, datos.cuenta, hoyTexto(), { tienda: true });
  $("eTMensaje").hidden = true;
  $("formEstadoT").hidden = false;
}

function copiarEstadoT() {
  const area = $("eTTexto");
  const aviso = $("eTMensaje");
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

// ---------- Exportaciones ----------
function alExportarCSVCobrosTiendas() {
  try {
    descargar("tortilleria-cobros-tiendas-" + fechaDeHoy() + ".csv", Almacen.aCSVCobrosTiendas(), "text/csv;charset=utf-8");
    mensajeRespaldo("Cobros de tiendas exportados.", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo exportar: " + e.message, "mal");
  }
}

function alExportarCSVSaldosTiendas() {
  try {
    descargar("tortilleria-saldos-tiendas-" + fechaDeHoy() + ".csv", Almacen.aCSVSaldosTiendas(fechaDeHoy()), "text/csv;charset=utf-8");
    mensajeRespaldo("Saldos de tiendas exportados.", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo exportar: " + e.message, "mal");
  }
}

// ---------- Arranque ----------
$("subTiendasLista").addEventListener("click", function () { ponerSubTiendas("lista"); });
$("subTiendasCobrar").addEventListener("click", function () { ponerSubTiendas("cobrar"); });
$("btnGuardarCobroT").addEventListener("click", guardarCobroT);
$("btnCancelarCobroT").addEventListener("click", function () { $("formCobroT").hidden = true; });
$("btnCobrarTodoT").addEventListener("click", function () {
  $("cTMonto").value = String(Logica.redondear(Number($("formCobroT").dataset.saldo), 2));
});
$("btnCerrarEstadoT").addEventListener("click", function () { $("formEstadoT").hidden = true; });
$("btnCopiarEstadoT").addEventListener("click", copiarEstadoT);
$("btnExportarCSVCobrosTiendas").addEventListener("click", alExportarCSVCobrosTiendas);
$("btnExportarCSVSaldosTiendas").addEventListener("click", alExportarCSVSaldosTiendas);
