// Service Worker — COA prueba de terreno
const CACHE = 'coa-v3.3';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/estilos.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo_navbar_app.png',
  './js/firebase-config.js',
  './js/actividades.js',
  './js/logica.js',
  './js/datos.js',
  './js/router.js',
  './js/proyectos.js',
  './js/semana-control.js',
  './js/config-proyecto.js',
  './js/importar.js',
  './js/terminaciones.js',
  './js/interfaz.js',
  './js/vendor/xlsx.full.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ARCHIVOS.filter(f => !f.includes('vendor'))))
      .then(() => self.skipWaiting())  // activar inmediatamente al terminar de cachear
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())  // tomar control de todas las pestañas abiertas
  );
});

// Network-first: siempre intenta descargar la versión más nueva.
// Si no hay internet, usa la caché como respaldo.
// Así las actualizaciones llegan solas sin necesidad de reinstalar.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Guardar respuesta fresca en caché solo si es válida
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clon = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clon));
        }
        return res;
      })
      .catch(() => caches.match(e.request))  // sin internet → caché
  );
});
