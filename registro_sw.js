// ============================================================
// registro_sw.js  -  Activa el modo "sin internet" y avisa de versiones nuevas
// ------------------------------------------------------------
// Solo funciona cuando la app se abre desde una dirección https (por
// ejemplo la que te da GitHub Pages). Abierta con doble clic desde la
// laptop (archivo local) no hace nada, y está bien.
// ============================================================
(function () {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;

  const habiaVersionAnterior = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    // Si ya había una versión corriendo, esto significa que llegó una NUEVA
    if (habiaVersionAnterior) {
      const aviso = document.getElementById("avisoVersion");
      if (aviso) aviso.hidden = false;
    }
  });
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () { /* sin internet o sin permiso: se ignora */ });
  });
})();
