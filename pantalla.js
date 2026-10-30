// ============================================================
// pantalla.js  -  Las pantallas de la app (Fase 5B)
// ------------------------------------------------------------
// Dibuja las pantallas y reacciona a lo que haces.
//   - Las CUENTAS las hace logica.js
//   - El GUARDADO lo hace almacenamiento.js
// Cada vez que escribes un kilo, el reparto se guarda solo.
// ============================================================

const formatoMoneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const formatoKg = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

let tiendas = [];       // lista maestra de tiendas
let reparto = null;     // el reparto que se está viendo
let filas = [];         // elementos de pantalla de cada tienda
let soloLectura = false;

function $(id) { return document.getElementById(id); }

// ---------- Utilidades ----------
function fechaDeHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return hoy.getFullYear() + "-" + mes + "-" + dia;
}

// "2026-10-20" -> "mar, 20 oct 2026" (sin problemas de zona horaria)
function formatoFecha(texto) {
  const partes = texto.split("-");
  const f = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  return f.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function marcarGuardado(ok) {
  const el = $("guardado");
  if (ok) {
    el.textContent = "Guardado " + new Date().toLocaleTimeString("es-MX");
    el.className = "guardado";
  } else {
    el.textContent = "NO SE PUDO GUARDAR";
    el.className = "guardado mal";
  }
}

// ---------- Total del día: tiendas + rancho (cada uno se lleva por separado) ----------
function totalDelDia(fecha) {
  const v = Almacen.valoresDelDia(fecha);
  const d = LogicaRancho.resumirDia(v.tiendas, v.rancho);
  return { totalTiendas: d.totalTiendas, totalRancho: d.totalRancho, totalDia: d.totalDia, provisional: d.provisional, tiendas: v.tiendas, rancho: v.rancho };
}

// Línea bajo el total de tiendas: solo aparece si ese día hay rancho
function actualizarTotalDiaReparto() {
  const el = $("totalDiaReparto");
  try {
    const d = totalDelDia(reparto.fecha);
    if (!d.rancho.existe) { el.hidden = true; return; }
    el.textContent = "Dinero neto del día (tiendas + rancho): " + formatoMoneda.format(d.totalDia) + (d.provisional ? " · provisional" : "");
    el.hidden = false;
  } catch (e) {
    el.hidden = true;
  }
}

function mostrarErrorAlmacen(mensaje) {
  const aviso = $("avisoAlmacen");
  aviso.textContent = mensaje;
  aviso.hidden = false;
}

// ---------- Dibujar el reparto ----------
function dibujarFilas() {
  const lista = $("lista");
  lista.innerHTML = "";
  filas = [];
  reparto.lineas.forEach(function (linea, i) {
    const li = document.createElement("li");
    li.className = "fila";
    li.innerHTML =
      '<div class="encabezado"><span class="nombre"></span><span class="precio"></span></div>' +
      '<label class="cobro-check"><input type="checkbox" class="cobrar"> Se cobra hoy</label>' +
      '<div class="campos tres">' +
        '<label>Entregas de mañana (kg)<input type="text" inputmode="decimal" autocomplete="off" class="entregados"></label>' +
        '<label>Extras de tarde (kg)<input type="text" inputmode="decimal" autocomplete="off" class="extras"></label>' +
        '<label>Devoluciones de tarde (kg)<input type="text" inputmode="decimal" autocomplete="off" class="devoluciones"></label>' +
      '</div>' +
      '<div class="campos">' +
        '<label>Fría recogida (kg)<input type="text" inputmode="decimal" autocomplete="off" class="sobrantes"></label>' +
        '<div class="total-kg">Entregados en total<b class="entregadosTotal">0</b></div>' +
      '</div>' +
      '<div class="detalle"><span class="importe">$0.00</span><span class="estado"></span></div>';
    li.querySelector(".nombre").textContent = linea.nombre;
    li.querySelector(".precio").textContent = formatoMoneda.format(linea.precio) + " / kg";
    const entregados = li.querySelector(".entregados");
    const extras = li.querySelector(".extras");
    const devoluciones = li.querySelector(".devoluciones");
    const sobrantes = li.querySelector(".sobrantes");
    const cobrar = li.querySelector(".cobrar");
    entregados.value = linea.entregados;
    extras.value = linea.extras === undefined ? "" : linea.extras;
    devoluciones.value = linea.devoluciones === undefined ? "" : linea.devoluciones;
    sobrantes.value = linea.sobrantes;
    cobrar.checked = linea.cobrar !== false;
    [entregados, extras, devoluciones, sobrantes, cobrar].forEach(function (el) { el.disabled = soloLectura; });
    [entregados, extras, devoluciones, sobrantes].forEach(function (el) {
      el.addEventListener("input", function () { alEscribir(i); });
    });
    cobrar.addEventListener("change", function () { alCambiarCobro(i); });
    lista.appendChild(li);
    filas.push({
      li: li, entregados: entregados, extras: extras, devoluciones: devoluciones, sobrantes: sobrantes, cobrar: cobrar,
      importe: li.querySelector(".importe"), estado: li.querySelector(".estado"),
      entregadosTotal: li.querySelector(".entregadosTotal")
    });
  });
  activarEnter();
}

function activarEnter() {
  const campos = [];
  filas.forEach(function (f) { campos.push(f.entregados, f.extras, f.devoluciones, f.sobrantes); });
  campos.forEach(function (campo, i) {
    campo.addEventListener("keydown", function (evento) {
      if (evento.key === "Enter" && campos[i + 1]) {
        evento.preventDefault();
        campos[i + 1].focus();
      }
    });
  });
}

function lineasParaCalculo() {
  return reparto.lineas.map(function (l) {
    return {
      precio: l.precio, entregados: l.entregados, sobrantes: l.sobrantes, activa: true,
      extras: l.extras, devoluciones: l.devoluciones, cobrar: l.cobrar
    };
  });
}

function recalcular() {
  const lineas = lineasParaCalculo();
  lineas.forEach(function (l, i) {
    const r = Logica.calcularLinea(l.precio, l.entregados, l.sobrantes, l.activa, l.extras, l.devoluciones, l.cobrar);
    const fila = filas[i];
    const sinCobro = l.cobrar === false;
    fila.importe.textContent = (sinCobro && r.estado === "OK" ? "No se cobra hoy · " : "") + formatoMoneda.format(r.importe);
    fila.entregadosTotal.textContent = formatoKg.format(r.entregadosTotal) + " kg";
    fila.estado.textContent = r.estado === "Sin captura" ? "" : r.estado;
    fila.li.className = "fila" + (r.estado === "OK" ? " ok" : (r.estado === "Sin captura" ? "" : " error")) + (sinCobro ? " sin-cobro" : "");
  });

  const resumen = Logica.resumirReparto(lineas);
  $("total").textContent = formatoMoneda.format(resumen.total);
  $("kgEntregados").textContent = formatoKg.format(resumen.kgEntregados);
  $("kgDevoluciones").textContent = formatoKg.format(resumen.kgDevoluciones);
  $("kgFrios").textContent = formatoKg.format(resumen.kgFrios);
  $("kgNetos").textContent = formatoKg.format(resumen.kgNetos);

  const noCobrado = $("noCobradoDia");
  if (resumen.tiendasSinCobro > 0) {
    noCobrado.textContent = "No entra al dinero del día (" + resumen.tiendasSinCobro + (resumen.tiendasSinCobro === 1 ? " tienda" : " tiendas") +
      " sin cobro hoy): " + formatoMoneda.format(resumen.totalNoCobrado);
    noCobrado.hidden = false;
  } else {
    noCobrado.hidden = true;
  }

  const estado = $("estado");
  estado.textContent = resumen.estado;
  if (resumen.estado === "Listo para cerrar") estado.className = "estado-dia bien";
  else if (resumen.estado === "Sin datos") estado.className = "estado-dia neutro";
  else estado.className = "estado-dia mal";

  $("btnCerrar").disabled = soloLectura || resumen.estado !== "Listo para cerrar";
  return resumen;
}

// Cada vez que escribes: actualizar, recalcular y guardar
function alEscribir(i) {
  if (soloLectura) return;
  const l = reparto.lineas[i];
  l.entregados = filas[i].entregados.value;
  l.extras = filas[i].extras.value;
  l.devoluciones = filas[i].devoluciones.value;
  l.sobrantes = filas[i].sobrantes.value;
  recalcular();
  guardarBorrador();
}

// El check "Se cobra hoy": se marca a mano, y esa decisión se respeta
function alCambiarCobro(i) {
  if (soloLectura) return;
  reparto.lineas[i].cobrar = filas[i].cobrar.checked;
  reparto.lineas[i].cobrarManual = true;
  recalcular();
  guardarBorrador();
}

function guardarBorrador() {
  try {
    marcarGuardado(Almacen.guardarReparto(reparto));
  } catch (e) {
    marcarGuardado(false);
    mostrarErrorAlmacen(e.message);
  }
  actualizarTotalDiaReparto();
}

// ---------- Cargar una fecha ----------
function cargarFecha(fecha) {
  try {
    const guardadoAntes = Almacen.obtenerReparto(fecha);
    reparto = guardadoAntes || Almacen.nuevoReparto(fecha, tiendas);
    if (guardadoAntes && Almacen.sincronizarConTiendas(reparto, tiendas)) {
      Almacen.guardarReparto(reparto);
    }
  } catch (e) {
    mostrarErrorAlmacen(e.message);
    return;
  }
  soloLectura = reparto.estado === "cerrado";
  dibujarFilas();

  const avisoReparto = $("avisoReparto");
  if (soloLectura) {
    avisoReparto.textContent = "Reparto cerrado. Para modificarlo, pulsa «Reabrir reparto».";
    avisoReparto.hidden = false;
  } else {
    avisoReparto.hidden = true;
  }
  $("btnCerrar").hidden = soloLectura;
  $("btnReabrir").hidden = !soloLectura;
  $("botonesPrueba").hidden = soloLectura;
  recalcular();
  actualizarTotalDiaReparto();
}

// ---------- Cerrar y reabrir ----------
function abrirResumenDeCierre() {
  const r = recalcular();
  $("resumenFecha").textContent = formatoFecha(reparto.fecha);
  const datos = [
    ["Tiendas con reparto", String(r.tiendasConCaptura)],
    ["Kg entregados", formatoKg.format(r.kgEntregados)],
    ["Kg fríos recogidos", formatoKg.format(r.kgFrios)],
    ["Kg netos vendidos", formatoKg.format(r.kgNetos)],
    ["Dinero neto del día", formatoMoneda.format(r.total)]
  ];
  const dl = $("resumenCierre");
  dl.innerHTML = "";
  datos.forEach(function (par, i) {
    const div = document.createElement("div");
    if (i === datos.length - 1) div.className = "gran";
    const dt = document.createElement("dt"); dt.textContent = par[0];
    const dd = document.createElement("dd"); dd.textContent = par[1];
    div.appendChild(dt); div.appendChild(dd);
    dl.appendChild(div);
  });
  $("superposicion").hidden = false;
}

function confirmarCierre() {
  try {
    if (!Almacen.guardarReparto(reparto)) throw new Error("No se pudo guardar antes de cerrar.");
    Almacen.cerrarReparto(reparto.fecha);
    $("superposicion").hidden = true;
    marcarGuardado(true);
    cargarFecha(reparto.fecha);
    actualizarAvisoRespaldo();
  } catch (e) {
    $("superposicion").hidden = true;
    marcarGuardado(false);
    mostrarErrorAlmacen(e.message);
  }
}

function reabrir() {
  if (!window.confirm("¿Reabrir este reparto para modificarlo?")) return;
  try {
    Almacen.reabrirReparto(reparto.fecha);
    cargarFecha(reparto.fecha);
  } catch (e) {
    mostrarErrorAlmacen(e.message);
  }
}

// ---------- Botones de prueba ----------
function vaciarLinea(i) {
  const l = reparto.lineas[i];
  l.entregados = ""; l.extras = ""; l.devoluciones = ""; l.sobrantes = "";
  filas[i].entregados.value = ""; filas[i].extras.value = "";
  filas[i].devoluciones.value = ""; filas[i].sobrantes.value = "";
}

function limpiarTodo() {
  if (!window.confirm("¿Borrar todos los kilos escritos de esta fecha?")) return;
  reparto.lineas.forEach(function (l, i) { vaciarLinea(i); });
  recalcular();
  guardarBorrador();
}

function cargarEjemplo() {
  const hayDatos = reparto.lineas.some(function (l) {
    return l.entregados !== "" || l.sobrantes !== "" || (l.extras || "") !== "" || (l.devoluciones || "") !== "";
  });
  if (hayDatos && !window.confirm("Esto reemplaza los kilos escritos. ¿Continuar?")) return;
  reparto.lineas.forEach(function (l, i) { vaciarLinea(i); });
  const ejemplo = [["30", "2"], ["25", "1"]];
  ejemplo.forEach(function (par, i) {
    if (!reparto.lineas[i]) return;
    reparto.lineas[i].entregados = par[0]; reparto.lineas[i].sobrantes = par[1];
    filas[i].entregados.value = par[0]; filas[i].sobrantes.value = par[1];
  });
  recalcular();
  guardarBorrador();
}

// ---------- Repartos anteriores ----------
const VISTAS = {
  reparto: { vista: "vistaReparto", pestana: "tabReparto" },
  rancho: { vista: "vistaRancho", pestana: "tabRancho" },
  anteriores: { vista: "vistaAnteriores", pestana: "tabAnteriores" },
  tiendas: { vista: "vistaTiendas", pestana: "tabTiendas" },
  respaldo: { vista: "vistaRespaldo", pestana: "tabRespaldo" }
};

function mostrarVista(nombre) {
  Object.keys(VISTAS).forEach(function (k) {
    $(VISTAS[k].vista).hidden = k !== nombre;
    $(VISTAS[k].pestana).className = k === nombre ? "activa" : "";
  });
  $("pieReparto").hidden = nombre !== "reparto";
  $("avisoReparto").hidden = nombre !== "reparto" || !soloLectura;
  $("avisoRespaldo").hidden = nombre === "respaldo" || $("avisoRespaldo").textContent === "";
  if (nombre === "reparto" && $("fecha").value) cargarFecha($("fecha").value);
  if (nombre === "anteriores") dibujarAnteriores();
  if (nombre === "tiendas") dibujarTiendas();
  if (nombre === "respaldo") dibujarRespaldo();
  if (typeof alMostrarVistaRancho === "function") alMostrarVistaRancho(nombre);
  if (typeof alMostrarVistaParalelo === "function") alMostrarVistaParalelo(nombre);
  if (typeof alMostrarVistaTiendas === "function") alMostrarVistaTiendas(nombre);
}

function unionFechas() {
  const mapa = {};
  Almacen.listarFechas().forEach(function (f) { mapa[f] = true; });
  Almacen.listarFechasRancho().forEach(function (f) { mapa[f] = true; });
  return Object.keys(mapa).sort().reverse();
}

function textoEstadoParte(parte) {
  if (!parte.existe) return "—";
  return parte.cerrado ? "Cerrado" : "Abierto";
}

function dibujarAnteriores() {
  const lista = $("listaAnteriores");
  lista.innerHTML = "";
  let cuantos = 0;
  unionFechas().forEach(function (fecha) {
    let d;
    try { d = totalDelDia(fecha); } catch (e) { return; }
    if (!d.tiendas.existe && !d.rancho.existe) return;
    cuantos += 1;
    const li = document.createElement("li");
    li.className = "item-anterior";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "anterior" + (d.provisional ? " abierto" : "");
    const dia = document.createElement("span"); dia.className = "dia"; dia.textContent = formatoFecha(fecha);
    const monto = document.createElement("span"); monto.className = "monto"; monto.textContent = formatoMoneda.format(d.totalDia);
    const sub1 = document.createElement("span"); sub1.className = "sub";
    sub1.textContent = "Tiendas " + formatoMoneda.format(d.totalTiendas) +
      (d.tiendas.existe ? " (" + formatoKg.format(d.tiendas.kgFrios) + " kg fríos)" : "") +
      " · Rancho " + formatoMoneda.format(d.totalRancho);
    const sub2 = document.createElement("span"); sub2.className = "sub der";
    sub2.textContent = "Tiendas: " + textoEstadoParte(d.tiendas) + " · Rancho: " + textoEstadoParte(d.rancho) +
      (d.provisional ? " · Provisional" : "");
    boton.appendChild(dia); boton.appendChild(monto); boton.appendChild(sub1); boton.appendChild(sub2);
    boton.addEventListener("click", function () {
      $("fecha").value = fecha;
      if (d.tiendas.existe) { cargarFecha(fecha); mostrarVista("reparto"); }
      else { mostrarVista("rancho"); }
    });
    li.appendChild(boton);
    if (d.rancho.existe && d.tiendas.existe) {
      const ver = document.createElement("button");
      ver.type = "button"; ver.className = "ver-rancho"; ver.textContent = "Ver el rancho de este día";
      ver.addEventListener("click", function () { $("fecha").value = fecha; mostrarVista("rancho"); });
      li.appendChild(ver);
    }
    lista.appendChild(li);
  });
  $("sinAnteriores").hidden = cuantos > 0;
}

// ---------- Tiendas ----------
let tiendaEditando = null;   // número de la tienda que se edita, o null si es nueva

function dibujarTiendas() {
  const lista = $("listaTiendas");
  lista.innerHTML = "";
  tiendas.forEach(function (t) {
    const li = document.createElement("li");
    li.className = "tienda" + (t.activa ? "" : " inactiva");
    const nombre = document.createElement("span"); nombre.className = "nombre"; nombre.textContent = t.nombre;
    const precio = document.createElement("span"); precio.className = "precio"; precio.textContent = formatoMoneda.format(t.precio) + " / kg";
    const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = (t.activa ? "Activa" : "Desactivada") + (t.cobroQuincenal ? " · Cobro quincenal" : "");
    const acciones = document.createElement("div"); acciones.className = "acciones";
    const btnEditar = document.createElement("button"); btnEditar.type = "button"; btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", function () { abrirFormTienda(t.id); });
    const btnActiva = document.createElement("button"); btnActiva.type = "button";
    btnActiva.textContent = t.activa ? "Desactivar" : "Activar";
    btnActiva.addEventListener("click", function () { cambiarActiva(t); });
    acciones.appendChild(btnEditar); acciones.appendChild(btnActiva);
    li.appendChild(nombre); li.appendChild(precio); li.appendChild(sub); li.appendChild(acciones);
    lista.appendChild(li);
  });
}

function abrirFormTienda(id) {
  tiendaEditando = id;
  const t = id === null ? null : tiendas.find(function (x) { return x.id === id; });
  $("formTiendaTitulo").textContent = t ? "Editar tienda" : "Agregar tienda";
  $("tNombre").value = t ? t.nombre : "";
  $("tPrecio").value = t ? String(t.precio) : "";
  $("tCobroQuincenal").checked = !!(t && t.cobroQuincenal);
  $("tError").hidden = true;
  $("formTienda").hidden = false;
  $("tNombre").focus();
}

function guardarFormTienda() {
  try {
    const quincenal = $("tCobroQuincenal").checked;
    if (tiendaEditando === null) Almacen.agregarTienda($("tNombre").value, $("tPrecio").value, quincenal);
    else Almacen.editarTienda(tiendaEditando, $("tNombre").value, $("tPrecio").value, quincenal);
    tiendas = Almacen.obtenerTiendas();
    $("formTienda").hidden = true;
    dibujarTiendas();
    marcarGuardado(true);
  } catch (e) {
    $("tError").textContent = e.message;
    $("tError").hidden = false;
  }
}

function cambiarActiva(t) {
  const pregunta = t.activa
    ? "¿Desactivar «" + t.nombre + "»? Dejará de aparecer en los repartos nuevos. Su historial se conserva."
    : "¿Activar «" + t.nombre + "»?";
  if (!window.confirm(pregunta)) return;
  try {
    Almacen.establecerActiva(t.id, !t.activa);
    tiendas = Almacen.obtenerTiendas();
    dibujarTiendas();
    marcarGuardado(true);
  } catch (e) {
    mostrarErrorAlmacen(e.message);
  }
}

// ---------- Respaldo ----------
// ¿Es un iPhone o iPad? (también reconoce el iPad que se presenta como Mac)
function esIOS() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// En iPhone/iPad descargar un archivo desde una app instalada suele fallar:
// ahí se usa el menú de compartir ("Guardar en Archivos", AirDrop, correo...).
function usaCompartir() {
  return esIOS() && typeof File === "function" && !!navigator.share && !!navigator.canShare;
}

function anclaDescarga(nombre, texto, tipo) {
  const blob = new Blob([texto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// Descarga un archivo (laptop) o abre el menú de compartir (iPhone/iPad).
// Devuelve "descarga" o "compartir". alTerminar(ok) se llama al final;
// ok = false solo si la persona cerró el menú de compartir sin guardar.
function descargar(nombre, texto, tipo, alTerminar) {
  const terminar = function (ok) { if (typeof alTerminar === "function") alTerminar(ok); };
  if (usaCompartir()) {
    const archivo = new File([texto], nombre, { type: tipo });
    let puede = false;
    try { puede = navigator.canShare({ files: [archivo] }); } catch (e) { puede = false; }
    if (puede) {
      navigator.share({ files: [archivo] }).then(function () { terminar(true); }, function (e) {
        if (e && e.name === "AbortError") { terminar(false); return; }
        anclaDescarga(nombre, texto, tipo);
        terminar(true);
      });
      return "compartir";
    }
  }
  anclaDescarga(nombre, texto, tipo);
  terminar(true);
  return "descarga";
}

function mensajeRespaldo(texto, tipo) {
  const el = $("mensajeRespaldo");
  el.textContent = texto;
  el.className = "aviso " + tipo;
  el.hidden = false;
}

function dibujarRespaldo() {
  const ultimo = Almacen.obtenerUltimoRespaldo();
  $("ultimoRespaldo").textContent = ultimo
    ? "Último respaldo guardado: " + new Date(ultimo).toLocaleString("es-MX")
    : "Todavía no has guardado ningún respaldo.";
  $("mensajeRespaldo").hidden = true;
  const copia = Almacen.obtenerCopiaPrevia();
  const bloque = $("bloqueDeshacer");
  if (copia) {
    $("textoDeshacer").textContent = "Hay una copia guardada el " + new Date(copia.guardadoEn).toLocaleString("es-MX") +
      " (" + copia.motivo + "). Si algo salió mal, puedes volver a como estaban los datos en ese momento. Lo que hayas capturado después se perdería.";
    bloque.hidden = false;
  } else {
    bloque.hidden = true;
  }
}

// Devuelve { datos, modo }; modo es "descarga" o "compartir"
function descargarRespaldo(prefijoNombre, alTerminar) {
  const datos = Almacen.exportarTodo();
  const nombre = (prefijoNombre || "tortilleria-respaldo") + "-" + fechaDeHoy() + ".json";
  const modo = descargar(nombre, JSON.stringify(datos, null, 2), "application/json", alTerminar);
  return { datos: datos, modo: modo };
}

function alDescargarRespaldo() {
  try {
    const r = descargarRespaldo(null, function (ok) {
      if (ok) {
        Almacen.marcarRespaldoHecho();
        dibujarRespaldo();
        actualizarAvisoRespaldo();
      } else {
        mensajeRespaldo("No se guardó el respaldo porque cerraste el menú. Vuelve a intentarlo.", "mal");
      }
    });
    const d = r.datos;
    const resumen = d.tiendas.length + " tiendas, " + Object.keys(d.repartos).length + " repartos, " + Object.keys(d.ranchos).length + " ranchos, " + d.personas.length + " personas y " + d.cobros.length + " cobros (más " + d.cobrosTiendas.length + " cobros de tiendas)";
    if (r.modo === "compartir") {
      mensajeRespaldo("Se abrió el menú para guardar el respaldo (" + resumen + "). Elige «Guardar en Archivos» (o iCloud Drive, AirDrop o correo). Hasta que lo guardes, no tienes copia.", "info");
    } else {
      mensajeRespaldo("Respaldo descargado: " + resumen + ". Revisa que el archivo esté en tu carpeta de Descargas y guárdalo en un lugar seguro.", "info");
    }
  } catch (e) {
    mensajeRespaldo("No se pudo crear el respaldo: " + e.message, "mal");
  }
}

// Vuelve a como estaban los datos antes de la última restauración o borrado
function deshacerUltimaAccionUI() {
  const copia = Almacen.obtenerCopiaPrevia();
  if (!copia) return;
  const cuando = new Date(copia.guardadoEn).toLocaleString("es-MX");
  if (!window.confirm("Vas a volver a como estaban los datos el " + cuando + " (" + copia.motivo + ").\n\nLo que hayas capturado después se perderá, aunque quedará una copia para volver a deshacer.\n\n¿Continuar?")) return;
  try {
    Almacen.deshacerCopiaPrevia();
    tiendas = Almacen.obtenerTiendas();
    cargarFecha($("fecha").value);
    if (typeof cargarRanchoFecha === "function") cargarRanchoFecha($("fecha").value);
    if (typeof dibujarParalelo === "function") dibujarParalelo();
    actualizarAvisoRespaldo();
    dibujarRespaldo();
    mensajeRespaldo("Listo: los datos volvieron a como estaban.", "info");
  } catch (e) {
    mensajeRespaldo(e.message, "mal");
  }
}

function alExportarCSV() {
  try {
    const csv = Almacen.aCSV();
    descargar("tortilleria-tiendas-" + fechaDeHoy() + ".csv", csv, "text/csv;charset=utf-8");
    mensajeRespaldo("Historial de tiendas exportado (solo repartos cerrados).", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo exportar: " + e.message, "mal");
  }
}

function alElegirArchivo(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = function () {
    let datos;
    try {
      datos = JSON.parse(lector.result);
      Almacen.validarRespaldo(datos);
    } catch (e) {
      const texto = e instanceof SyntaxError ? "Respaldo no válido: el archivo está dañado o no es un respaldo." : e.message;
      mensajeRespaldo(texto + " No se cambió nada.", "mal");
      evento.target.value = "";
      return;
    }
    const cuando = datos.exportadoEn ? new Date(datos.exportadoEn).toLocaleString("es-MX") : "fecha desconocida";
    const nRanchos = datos.version >= 2 ? Object.keys(datos.ranchos).length : 0;
    const nPersonas = datos.version >= 2 ? datos.personas.length : 0;
    const nCobros = datos.version >= 3 ? datos.cobros.length : 0;
    const nCobrosT = datos.version >= 4 ? datos.cobrosTiendas.length : 0;
    let viejo = "";
    if (datos.version === 1) viejo = "\n\nOJO: este respaldo es anterior al módulo Rancho. Al restaurarlo, el rancho, las personas y los cobros quedarán VACÍOS.";
    else if (datos.version === 2) viejo = "\n\nOJO: este respaldo es anterior al registro de cobros. Al restaurarlo, los cobros quedarán VACÍOS.";
    else if (datos.version === 3) viejo = "\n\nOJO: este respaldo es anterior a las cuentas de tiendas. Al restaurarlo, los cobros de tiendas quedarán VACÍOS.";
    const pregunta = "Este respaldo es del " + cuando + " y trae " + datos.tiendas.length + " tiendas, " +
      Object.keys(datos.repartos).length + " repartos, " + nRanchos + " ranchos, " + nPersonas + " personas, " + nCobros + " cobros y " + nCobrosT + " cobros de tiendas." + viejo +
      "\n\nVa a REEMPLAZAR todo lo que hay ahora. Antes se guardará una copia de lo actual para que puedas deshacer.\n\n¿Continuar?";
    if (!window.confirm(pregunta)) { evento.target.value = ""; return; }
    try {
      if (!Almacen.guardarCopiaPrevia("antes de restaurar un respaldo")) {
        throw new Error("No se pudo guardar la copia para deshacer, así que no se restauró nada.");
      }
      if (!usaCompartir()) descargarRespaldo("tortilleria-antes-de-restaurar");
      const r = Almacen.restaurarTodo(datos);
      tiendas = Almacen.obtenerTiendas();
      cargarFecha($("fecha").value);
      if (typeof cargarRanchoFecha === "function") cargarRanchoFecha($("fecha").value);
      actualizarAvisoRespaldo();
      dibujarRespaldo();
      mensajeRespaldo("Restauración completa: " + r.tiendas + " tiendas, " + r.repartos + " repartos, " + r.ranchos + " ranchos, " + r.personas + " personas y " + r.cobros + " cobros, más " + r.cobrosTiendas + " cobros de tiendas.", "info");
    } catch (e) {
      mensajeRespaldo(e.message, "mal");
    }
    evento.target.value = "";
  };
  lector.onerror = function () { mensajeRespaldo("No se pudo leer el archivo.", "mal"); };
  lector.readAsText(archivo);
}

// Recordatorio (el plazo de 7 días es una sugerencia nuestra, se puede cambiar)
const DIAS_RECORDATORIO = 7;
function actualizarAvisoRespaldo() {
  const aviso = $("avisoRespaldo");
  let cerrados = 0;
  Almacen.listarFechas().forEach(function (f) {
    try { const r = Almacen.obtenerReparto(f); if (r && r.estado === "cerrado") cerrados += 1; } catch (e) { /* se ignora aquí */ }
  });
  Almacen.listarFechasRancho().forEach(function (f) {
    try { const r = Almacen.obtenerRancho(f); if (r && r.estado === "cerrado") cerrados += 1; } catch (e) { /* se ignora aquí */ }
  });
  cerrados += Almacen.obtenerCobros().length + Almacen.obtenerCobrosTiendas().length;
  const ultimo = Almacen.obtenerUltimoRespaldo();
  let texto = "";
  if (cerrados > 0 && !ultimo) {
    texto = "Todavía no has descargado ningún respaldo. Hazlo en la pestaña «Respaldo».";
  } else if (cerrados > 0 && ultimo) {
    const dias = Math.floor((Date.now() - Date.parse(ultimo)) / 86400000);
    if (dias >= DIAS_RECORDATORIO) texto = "Hace " + dias + " días que no descargas un respaldo. Hazlo en la pestaña «Respaldo».";
  }
  aviso.textContent = texto;
  aviso.hidden = texto === "" || !$("vistaRespaldo").hidden;
}

// ---------- Arranque ----------
function iniciar() {
  if (!Almacen.disponible()) {
    mostrarErrorAlmacen("Este navegador no está guardando datos. Lo que escribas se perderá al cerrar. Prueba con Chrome o Edge y sin modo privado.");
    marcarGuardado(false);
  }
  try {
    tiendas = Almacen.obtenerTiendas();
  } catch (e) {
    mostrarErrorAlmacen(e.message);
    return;
  }
  $("fecha").value = fechaDeHoy();
  cargarFecha($("fecha").value);
  actualizarAvisoRespaldo();
}

$("fecha").addEventListener("change", function () {
  if ($("fecha").value) cargarFecha($("fecha").value);
});
$("btnCerrar").addEventListener("click", abrirResumenDeCierre);
$("btnVolver").addEventListener("click", function () { $("superposicion").hidden = true; });
$("btnConfirmar").addEventListener("click", confirmarCierre);
$("btnReabrir").addEventListener("click", reabrir);
$("btnEjemplo").addEventListener("click", cargarEjemplo);
$("btnLimpiar").addEventListener("click", limpiarTodo);
$("tabReparto").addEventListener("click", function () { mostrarVista("reparto"); });
$("tabAnteriores").addEventListener("click", function () { mostrarVista("anteriores"); });
$("tabTiendas").addEventListener("click", function () { mostrarVista("tiendas"); });
$("tabRespaldo").addEventListener("click", function () { mostrarVista("respaldo"); });
$("btnNuevaTienda").addEventListener("click", function () { abrirFormTienda(null); });
$("btnGuardarTienda").addEventListener("click", guardarFormTienda);
$("btnCancelarTienda").addEventListener("click", function () { $("formTienda").hidden = true; });
$("btnDescargarRespaldo").addEventListener("click", alDescargarRespaldo);
$("btnExportarCSV").addEventListener("click", alExportarCSV);
$("archivoRespaldo").addEventListener("change", alElegirArchivo);
$("btnDeshacer").addEventListener("click", deshacerUltimaAccionUI);

iniciar();
