// Nombre de la caché para nuestra aplicación
const CACHE_NAME = 'shopping-list-cache-v1';
// Archivos que queremos cachear para que la app funcione offline
const urlsToCache = [
  '/',
  '/index.html'
];

// Evento 'install': se dispara cuando el Service Worker se instala.
self.addEventListener('install', event => {
  // Esperamos hasta que la promesa dentro de waitUntil se complete.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caché abierta');
        // Agregamos todos los archivos importantes a la caché.
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'fetch': se dispara cada vez que la página pide un recurso (una imagen, un script, etc.).
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si encontramos una respuesta en la caché, la devolvemos.
        if (response) {
          return response;
        }
        // Si no, dejamos que el navegador haga la petición a la red como siempre.
        return fetch(event.request);
      })
  );
});

