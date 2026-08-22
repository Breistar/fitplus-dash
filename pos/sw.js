const CACHE = 'fitplus-sistema-v2'
const SHELL = ['./', './index.html', './estilos.css', './manifest.webmanifest', './js/app.js', './js/nucleo.js', './js/inicio.js', './js/venta.js', './js/pedidos.js', './js/clientas.js', './js/leads.js', './js/inventario.js', './js/catalogo.js', './js/reportes.js']
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r }).catch(() => caches.match(e.request)))
})
