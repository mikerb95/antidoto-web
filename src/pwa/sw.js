// Service worker de antidotocolombia.com. Plantilla: integraciones/service-worker.mjs la copia
// a dist/sw.js en cada build y reemplaza VERSION y PRECACHE.
//
// Estrategias (solo GET del mismo origen; la API, WhatsApp y todo lo externo pasan de largo):
//   páginas     red primero (con navigation preload); sin red, la copia guardada o /offline/
//   /_astro/    caché primero: llevan hash en el nombre y no cambian nunca (con tope de entradas)
//   fuentes, íconos y manifest  caché y revalidación: tienen nombre fijo y pueden cambiar
//   imágenes    caché y revalidación en segundo plano, con tope de entradas
// Para retirar el service worker: reemplaza este archivo por uno que llame a
// self.registration.unregister() y borre las cachés.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;

const NUCLEO = `nucleo-${VERSION}`;
const PAGINAS = 'paginas-v1';
const ESTATICOS = 'estaticos-v1';
const IMAGENES = 'imagenes-v1';
const VIGENTES = [NUCLEO, PAGINAS, ESTATICOS, IMAGENES];

const MAX_PAGINAS = 40;
const MAX_IMAGENES = 80;
// Cada despliegue trae /_astro/ nuevos con otro hash: sin tope, la caché crece para siempre.
const MAX_ESTATICOS = 150;
// Si la red tarda más que esto en una página ya guardada, se muestra la copia (conexiones lentas).
const ESPERA_RED_MS = 3500;

const offline = (ruta) => (ruta === '/en' || ruta.startsWith('/en/') ? '/en/offline/' : '/offline/');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(NUCLEO)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => !VIGENTES.includes(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

/** Deja como mucho `max` entradas, borrando las más viejas. */
async function recortar(nombre, max) {
  const cache = await caches.open(nombre);
  const claves = await cache.keys();
  await Promise.all(claves.slice(0, Math.max(0, claves.length - max)).map((k) => cache.delete(k)));
}

const guardable = (res) => res && res.ok && res.type === 'basic';

/** Guarda una copia sin frenar la respuesta y recorta la caché. */
function guardar(event, nombre, clave, res, max) {
  const copia = res.clone();
  event.waitUntil(
    caches
      .open(nombre)
      .then((c) => c.put(clave, copia))
      .then(() => recortar(nombre, max))
      .catch(() => {}),
  );
}

/** Una página se guarda sin query: los UTM de cada visita no crean copias aparte. */
const sinQuery = (request) => {
  const u = new URL(request.url);
  u.search = '';
  u.hash = '';
  return u.href;
};

async function pagina(event) {
  const { request } = event;
  const clave = sinQuery(request);
  const guardada = await (await caches.open(PAGINAS)).match(clave);

  const red = (async () => {
    // Si la precarga falla (o el navegador no la tiene) se intenta con un fetch normal.
    const res = (await Promise.resolve(event.preloadResponse).catch(() => null)) || (await fetch(request));
    if (guardable(res)) guardar(event, PAGINAS, clave, res, MAX_PAGINAS);
    return res;
  })();

  try {
    if (!guardada) return await red;
    // Con copia guardada: gana la red si responde a tiempo; si no, la copia (y la red la actualiza).
    const lenta = new Promise((resolver) => setTimeout(() => resolver(guardada), ESPERA_RED_MS));
    event.waitUntil(red.catch(() => {}));
    return await Promise.race([red, lenta]);
  } catch {
    return guardada || (await caches.match(offline(new URL(request.url).pathname))) || Response.error();
  }
}

/** Archivos con hash en el nombre: si están guardados, no hace falta preguntar. */
async function inmutable(event) {
  const { request } = event;
  const guardada = await caches.match(request);
  if (guardada) return guardada;
  const res = await fetch(request);
  if (guardable(res)) guardar(event, ESTATICOS, request, res, MAX_ESTATICOS);
  return res;
}

/**
 * Caché y revalidación: sale la copia guardada (la de esta caché o la del precache) y la red la
 * actualiza para la próxima vez. Sin copia, espera a la red.
 */
async function revalidar(event, nombre, max) {
  const { request } = event;
  const guardada = (await (await caches.open(nombre)).match(request)) || (await caches.match(request));
  const red = fetch(request).then((res) => {
    if (guardable(res)) guardar(event, nombre, request, res, max);
    return res;
  });
  if (guardada) {
    event.waitUntil(red.catch(() => {}));
    return guardada;
  }
  return red;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') return event.respondWith(pagina(event));
  if (url.pathname.startsWith('/_astro/') && request.destination !== 'image') return event.respondWith(inmutable(event));
  if (url.pathname.startsWith('/fonts/') || /\.(ico|svg|webmanifest)$/.test(url.pathname) || /^\/(icon|apple-touch)/.test(url.pathname)) {
    return event.respondWith(revalidar(event, ESTATICOS, MAX_ESTATICOS));
  }
  if (request.destination === 'image') return event.respondWith(revalidar(event, IMAGENES, MAX_IMAGENES));
});
