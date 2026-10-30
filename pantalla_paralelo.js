// ============================================================
// pantalla_paralelo.js  -  Prueba en paralelo con la libreta (Fase 6)
// ------------------------------------------------------------
// Vive dentro de la pestaña "Respaldo". Se carga después de
// pantalla.js y pantalla_rancho.js y usa sus utilidades.
// Las comparaciones las hace logica_paralelo.js y el guardado
// lo hace almacenamiento.js.
// ============================================================

function formatoPar(campo, n) {
  return campo.tipo === "kg" ? formatoKg.format(n) + " kg" : formatoMoneda.format(n);
}

function formatoDifPar(campo, n) {
  return (n > 0 ? "+" : "") + formatoPar(campo, n);
}

function construirFilasParalelo() {
  const cont = $("parFilas");
  cont.innerHTML = "";
  LogicaParalelo.CAMPOS.forEach(function (c) {
    const fila = document.createElement("div");
    fila.className = "par-fila";
    fila.innerHTML =
      '<div class="par-titulo"></div>' +
      '<div class="par-celdas">' +
        '<div><span>App</span><b id="par-app-' + c.clave + '">—</b></div>' +
        '<label><span>Libreta</span><input type="text" inputmode="decimal" autocomplete="off" id="par-in-' + c.clave + '"></label>' +
        '<div><span>Diferencia</span><b id="par-dif-' + c.clave + '">—</b></div>' +
      '</div>';
    fila.querySelector(".par-titulo").textContent = c.etiqueta + (c.opcional ? " (opcional)" : "");
    cont.appendChild(fila);
    fila.querySelector("input").addEventListener("input", actualizarDiferenciasParalelo);
  });
}

function leerLibreta() {
  const libreta = {};
  LogicaParalelo.CAMPOS.forEach(function (c) { libreta[c.clave] = $("par-in-" + c.clave).value; });
  return libreta;
}

function actualizarDiferenciasParalelo() {
  const fecha = $("fecha").value;
  if (!fecha) return;
  const cmp = LogicaParalelo.comparar(Almacen.valoresApp(fecha), leerLibreta());
  cmp.campos.forEach(function (c) {
    const el = $("par-dif-" + c.clave);
    if (c.estado === "OK") {
      el.textContent = c.coincide ? "Coincide" : formatoDifPar(c, c.diferencia);
      el.className = c.coincide ? "par-ok" : "par-mal";
    } else if (c.estado === "No es número" || c.estado === "Negativo") {
      el.textContent = c.estado;
      el.className = "par-mal";
    } else {
      el.textContent = "—";
      el.className = "";
    }
  });
}

function dibujarParalelo() {
  const fecha = $("fecha").value;
  if (!fecha) return;
  const v = Almacen.valoresDelDia(fecha);
  const app = Almacen.valoresApp(fecha);
  const sinDatos = !v.tiendas.existe && !v.rancho.existe;
  const pendiente = !(v.tiendas.cerrado && v.rancho.cerrado);
  $("parFecha").textContent = "Fecha: " + formatoFecha(fecha);

  const aviso = $("parAviso");
  if (sinDatos) {
    aviso.textContent = "Ese día no tiene datos en la app. Cambia la fecha de arriba.";
    aviso.hidden = false;
  } else if (pendiente) {
    aviso.textContent = "Falta cerrar " + (!v.tiendas.cerrado ? "el reparto de tiendas" : "el rancho") + " de este día para poder compararlo.";
    aviso.hidden = false;
  } else {
    aviso.hidden = true;
  }

  const registro = Almacen.obtenerParalelo(fecha);
  LogicaParalelo.CAMPOS.forEach(function (c) {
    $("par-app-" + c.clave).textContent = formatoPar(c, app[c.clave]);
    const entrada = $("par-in-" + c.clave);
    entrada.value = registro && registro.libreta[c.clave] !== null ? String(registro.libreta[c.clave]) : "";
    entrada.disabled = sinDatos || pendiente;
  });
  $("parNota").value = registro ? registro.nota : "";
  $("parNota").disabled = sinDatos || pendiente;
  $("btnGuardarParalelo").disabled = sinDatos || pendiente;
  $("btnQuitarParalelo").hidden = !registro;
  $("parError").hidden = true;
  actualizarDiferenciasParalelo();
  dibujarListaParalelo();
}

function dibujarListaParalelo() {
  const resumen = Almacen.resumenParalelo();
  const caja = $("parResumen");
  if (resumen.total === 0) {
    caja.hidden = true;
  } else {
    let texto = "Racha actual: " + resumen.racha + " de " + resumen.meta + " días seguidos sin diferencia · Comparados: " +
      resumen.total + " · Con diferencia: " + resumen.conDiferencia;
    if (resumen.pendientes > 0) texto += " · Pendientes: " + resumen.pendientes;
    if (resumen.cumplida) {
      texto += ". Meta alcanzada. Antes de dejar la libreta, comprueba también que restauras un respaldo sin perder nada.";
    }
    caja.textContent = texto;
    caja.hidden = false;
  }
  const lista = $("parLista");
  lista.innerHTML = "";
  resumen.evaluaciones.forEach(function (e) {
    const li = document.createElement("li");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "par-item " + e.estado;
    const t = document.createElement("span"); t.className = "t"; t.textContent = formatoFecha(e.fecha);
    const s = document.createElement("span"); s.className = "s";
    if (e.estado === "coincide") {
      s.textContent = "Coincide";
    } else if (e.estado === "pendiente") {
      s.textContent = "Pendiente: falta cerrar tiendas o rancho";
    } else {
      s.textContent = "Diferencia: " + e.comparacion.campos.filter(function (c) {
        return c.estado === "OK" && !c.coincide;
      }).map(function (c) { return c.etiqueta.replace(" ($)", "") + " " + formatoDifPar(c, c.diferencia); }).join(" · ");
    }
    if (e.registro.nota) s.textContent += " · " + e.registro.nota;
    boton.appendChild(t); boton.appendChild(s);
    boton.addEventListener("click", function () {
      $("fecha").value = e.fecha;
      $("fecha").dispatchEvent(new Event("change", { bubbles: true }));
      dibujarParalelo();
    });
    li.appendChild(boton);
    lista.appendChild(li);
  });
}

function guardarComparacion() {
  try {
    Almacen.guardarParalelo($("fecha").value, leerLibreta(), $("parNota").value);
    marcarGuardado(true);
    dibujarParalelo();
  } catch (e) {
    $("parError").textContent = e.message;
    $("parError").hidden = false;
  }
}

function quitarComparacion() {
  if (!window.confirm("¿Quitar la comparación de este día?")) return;
  Almacen.quitarParalelo($("fecha").value);
  dibujarParalelo();
}

function alExportarCSVParalelo() {
  try {
    descargar("tortilleria-paralelo-" + fechaDeHoy() + ".csv", Almacen.aCSVParalelo(), "text/csv;charset=utf-8");
    mensajeRespaldo("Comparaciones exportadas.", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo exportar: " + e.message, "mal");
  }
}

// ---------- Empezar con datos reales ----------
function borrarHistorialUI() {
  const aviso = "Esto borra TODOS los repartos, ranchos, cobros y comparaciones guardados.\n\nLas tiendas, las personas y los precios se conservan.\nAntes se guardará una copia dentro de la app (podrás deshacer desde Respaldo).\n\n¿Continuar?";
  if (!window.confirm(aviso)) return;
  const palabra = window.prompt("Para confirmar, escribe BORRAR (en mayúsculas):");
  if (palabra !== "BORRAR") { mensajeRespaldo("No se borró nada.", "info"); return; }
  try {
    if (!Almacen.guardarCopiaPrevia("antes de borrar el historial")) {
      throw new Error("No se pudo guardar la copia para deshacer, así que no se borró nada.");
    }
    if (!usaCompartir()) descargarRespaldo("tortilleria-antes-de-borrar");
    const n = Almacen.borrarHistorial();
    cargarFecha($("fecha").value);
    cargarRanchoFecha($("fecha").value);
    actualizarAvisoRespaldo();
    dibujarParalelo();
    dibujarRespaldo();
    mensajeRespaldo("Listo: se borraron " + n + " registros de prueba. Si te equivocaste, usa «Deshacer» más abajo.", "info");
  } catch (e) {
    mensajeRespaldo("No se pudo borrar: " + e.message, "mal");
  }
}

// pantalla.js llama a esta función cada vez que cambias de pestaña
function alMostrarVistaParalelo(nombre) {
  if (nombre === "respaldo") dibujarParalelo();
}

construirFilasParalelo();
$("btnGuardarParalelo").addEventListener("click", guardarComparacion);
$("btnQuitarParalelo").addEventListener("click", quitarComparacion);
$("btnExportarCSVParalelo").addEventListener("click", alExportarCSVParalelo);
$("btnBorrarHistorial").addEventListener("click", borrarHistorialUI);
$("fecha").addEventListener("change", function () {
  if (!$("vistaRespaldo").hidden) dibujarParalelo();
});
