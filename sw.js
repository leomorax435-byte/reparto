// ============================================================
// sw.js  -  Hace que la app funcione SIN internet
// ------------------------------------------------------------
// La primera vez que abres la app con internet, guarda una copia de
// todos sus archivos en el teléfono. Después los abre desde ahí.
//
// CADA VEZ que publiques una versión nueva de la app, SUBE el número
// de VERSION (por ejemplo "2", "3"...). Así el teléfono se entera de
// que hay archivos nuevos y los descarga.
//
// Tus datos (repartos, cuentas, etc.) NO están aquí: están en el
// almacenamiento de la app y no se tocan al actualizar.
// ============================================================

const VERSION = "1";
const CACHE = "tortilleria-v" + VERSION;

const ARCHIVOS = [
  "./",
  "./index.html",
  "./estilos.css",
  "./manifest.webmanifest",
  "./icono-180.png",
  "./icono-192.png",
  "./icono-512.png",
  "./logica.js",
  "./logica_rancho.js",
  "./logica_cuentas.js",
  "./logica_paralelo.js",
  "./almacenamiento.js",
  "./pantalla.js",
  "./pantalla_rancho.js",
  "./pantalla_paralelo.js",
  "./pantalla_cuentas_tiendas.js",
  "./registro_sw.js"
];

// Instalación: guardar todos los archivos
self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ARCHIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Activación: borrar copias de versiones anteriores
self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (nombres) {
        return Promise.all(nombres
          .filter(function (n) { return n.indexOf("tortilleria-v") === 0 && n !== CACHE; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Cada vez que la app pide un archivo: primero se busca en la copia guardada
self.addEventListener("fetch", function (evento) {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then(function (guardado) {
      if (guardado) return guardado;
      return fetch(evento.request).catch(function () {
        if (evento.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
