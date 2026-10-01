// El service worker corre aquí con cachés y red simuladas: se carga la plantilla de src/pwa/sw.js
// tal como la deja el build (VERSION y PRECACHE reemplazados) y se le disparan eventos.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ORIGEN = 'https://antidotocolombia.com';
const clave = (r: string | { url: string }) => new URL(typeof r === 'string' ? r : r.url, ORIGEN).href;

type Red = (r: string | { url: string }) => Promise<Response>;

class Cache {
  datos = new Map<string, Response>();
  constructor(private red: Red) {}
  async addAll(rutas: string[]) {
    for (const r of rutas) await this.put(r, await this.red(r));
  }
  async match(r: string | { url: string }) {
    return this.datos.get(clave(r))?.clone();
  }
  async put(r: string | { url: string }, res: Response) {
    const k = clave(r);
    this.datos.delete(k);
    this.datos.set(k, res);
  }
  async delete(r: string | { url: string }) {
    return this.datos.delete(clave(r));
  }
  async keys() {
    return [...this.datos.keys()].map((url) => ({ url }));
  }
}

/** Respuesta del mismo origen ("basic"), como las que da fetch en el navegador. */
const resp = (cuerpo: string, status = 200) => {
  const r = new Response(cuerpo, { status });
  Object.defineProperty(r, 'type', { value: 'basic' });
  return r;
};

function montar(precache: Record<string, string> = {}) {
  const almacen = new Map<string, Cache>();
  const caches = {
    async open(n: string) {
      if (!almacen.has(n)) almacen.set(n, new Cache(fetch));
      return almacen.get(n)!;
    },
    async keys() {
      return [...almacen.keys()];
    },
    async delete(n: string) {
      return almacen.delete(n);
    },
    async match(r: string | { url: string }) {
      for (const c of almacen.values()) {
        const m = await c.match(r);
        if (m) return m;
      }
      return undefined;
    },
  };
  // La "red": cada ruta devuelve lo que diga el mapa; sin red, todo falla.
  const red = { enLinea: true, rutas: new Map<string, string>(), pedidas: [] as string[] };
  const fetch = async (r: string | { url: string }) => {
    const url = clave(r);
    red.pedidas.push(new URL(url).pathname + new URL(url).search);
    if (!red.enLinea) throw new TypeError('Failed to fetch');
    const cuerpo = red.rutas.get(new URL(url).pathname) ?? precache[new URL(url).pathname];
    return cuerpo === undefined ? resp('no existe', 404) : resp(cuerpo);
  };
  const oyentes: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { origin: ORIGEN },
    registration: { navigationPreload: null },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (tipo: string, f: (e: unknown) => void) => (oyentes[tipo] = f),
  };
  const plantilla = readFileSync(new URL('../src/pwa/sw.js', import.meta.url), 'utf8')
    .replace("'__VERSION__'", '"prueba"')
    .replace('__PRECACHE__', JSON.stringify(Object.keys(precache)));
  new Function('self', 'caches', 'fetch', plantilla)(self, caches, fetch);

  /** Dispara un evento y espera la respuesta y todo el trabajo diferido. */
  async function evento(tipo: string, extra: Record<string, unknown> = {}) {
    const pendientes: Promise<unknown>[] = [];
    let respuesta: Promise<Response> | undefined;
    oyentes[tipo]!({ ...extra, waitUntil: (p: Promise<unknown>) => pendientes.push(p), respondWith: (p: Promise<Response>) => (respuesta = p) });
    const res = await respuesta;
    // waitUntil puede sumar promesas mientras se resuelven las anteriores.
    for (let i = 0; i < pendientes.length; i++) await pendientes[i];
    return res;
  }
  const pedir = async (ruta: string, extra: Record<string, unknown> = {}) => {
    const res = await evento('fetch', { request: { url: `${ORIGEN}${ruta}`, method: 'GET', mode: 'no-cors', destination: '', ...extra } });
    return res ? res.text() : undefined;
  };
  const navegar = (ruta: string, extra: Record<string, unknown> = {}) => pedir(ruta, { mode: 'navigate', destination: 'document', ...extra });
  return { almacen, red, evento, pedir, navegar, instalar: () => evento('install') };
}

describe('service worker', () => {
  it('fuentes e íconos se actualizan cuando cambian (no quedan fijos para siempre)', async () => {
    const sw = montar();
    sw.red.rutas.set('/favicon.svg', 'v1');
    expect(await sw.pedir('/favicon.svg')).toBe('v1');
    sw.red.rutas.set('/favicon.svg', 'v2');
    // Sale la copia guardada y por detrás se trae la nueva para la próxima vez.
    expect(await sw.pedir('/favicon.svg')).toBe('v1');
    expect(await sw.pedir('/favicon.svg')).toBe('v2');
  });

  it('sin red, una fuente sale del precache', async () => {
    const sw = montar({ '/fonts/cal-sans.woff2': 'fuente', '/offline/': 'sin red', '/en/offline/': 'offline' });
    await sw.instalar();
    sw.red.enLinea = false;
    expect(await sw.pedir('/fonts/cal-sans.woff2')).toBe('fuente');
  });

  it('los /_astro/ salen de caché sin preguntar y la caché tiene tope', async () => {
    const sw = montar();
    for (let i = 0; i < 160; i++) sw.red.rutas.set(`/_astro/a${i}.js`, `js${i}`);
    for (let i = 0; i < 160; i++) await sw.pedir(`/_astro/a${i}.js`);
    expect((await sw.almacen.get('estaticos-v1')!.keys()).length).toBe(150);
    sw.red.pedidas = [];
    expect(await sw.pedir('/_astro/a159.js')).toBe('js159');
    expect(sw.red.pedidas).toEqual([]);
  });

  it('una página con UTM se guarda una vez, sin query, y sirve sin red', async () => {
    const sw = montar({ '/offline/': 'sin red', '/en/offline/': 'offline' });
    await sw.instalar();
    sw.red.rutas.set('/contacto/', 'contacto');
    await sw.navegar('/contacto/?utm_source=instagram');
    await sw.navegar('/contacto/?utm_source=linkedin');
    expect((await sw.almacen.get('paginas-v1')!.keys()).map((k) => k.url)).toEqual([`${ORIGEN}/contacto/`]);
    sw.red.enLinea = false;
    expect(await sw.navegar('/contacto/')).toBe('contacto');
  });

  it('sin red y sin copia muestra la página offline del idioma', async () => {
    const sw = montar({ '/offline/': 'sin red', '/en/offline/': 'offline' });
    await sw.instalar();
    sw.red.enLinea = false;
    expect(await sw.navegar('/nosotros/')).toBe('sin red');
    expect(await sw.navegar('/en/about/')).toBe('offline');
  });

  it('si la precarga de navegación falla, usa la red igual', async () => {
    const sw = montar();
    sw.red.rutas.set('/servicios/', 'servicios');
    const fallida = Promise.reject(new Error('preload'));
    fallida.catch(() => {});
    expect(await sw.navegar('/servicios/', { preloadResponse: fallida })).toBe('servicios');
  });
});
