// Genera dist/sw.js desde src/pwa/sw.js al terminar el build:
//  - VERSION: hash del contenido de dist, así cada despliegue con cambios instala un sw nuevo.
//  - PRECACHE: las páginas offline, todo lo que ellas cargan de /_astro/, las fuentes y los íconos.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const OFFLINE = ['/offline/', '/en/offline/'];
const FIJOS = ['/favicon.svg', '/favicon.ico', '/icon-192.png', '/site.webmanifest'];

const archivos = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });

/** Rutas /_astro/ que referencia un HTML (CSS, JS y módulos), sin imágenes. */
export function assetsDe(html) {
  const rutas = new Set();
  for (const m of html.matchAll(/(?:href|src)="(\/_astro\/[^"?#]+)"/g)) rutas.add(m[1]);
  for (const m of html.matchAll(/import\(?["'](\/_astro\/[^"']+)["']/g)) rutas.add(m[1]);
  return [...rutas].filter((r) => /\.(css|js|mjs)$/.test(r));
}

/** Sigue los imports estáticos entre chunks de /_astro/ para guardar el grafo completo. */
export function conImports(entradas, leer) {
  const vistos = new Set();
  const pendientes = [...entradas];
  while (pendientes.length) {
    const ruta = pendientes.pop();
    if (vistos.has(ruta)) continue;
    vistos.add(ruta);
    if (!/\.m?js$/.test(ruta)) continue;
    for (const m of leer(ruta).matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+\.m?js)["']/g)) {
      const destino = m[1].startsWith('/') ? m[1] : posix.join(posix.dirname(ruta), m[1]);
      if (destino.startsWith('/_astro/')) pendientes.push(destino);
    }
  }
  return [...vistos];
}

export default function serviceWorker() {
  return {
    name: 'antidoto-service-worker',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        const todos = archivos(raiz).filter((f) => !f.endsWith(`${sep}sw.js`));

        const hash = createHash('sha256');
        for (const f of todos.sort()) hash.update(relative(raiz, f)).update(readFileSync(f));
        const version = hash.digest('hex').slice(0, 12);

        const fuentes = todos.filter((f) => f.includes(`${sep}fonts${sep}`)).map((f) => `/${relative(raiz, f).split(sep).join('/')}`);
        const entradas = OFFLINE.flatMap((p) => assetsDe(readFileSync(join(raiz, p, 'index.html'), 'utf8')));
        const assets = conImports(entradas, (r) => readFileSync(join(raiz, r), 'utf8'));
        const precache = [...new Set([...OFFLINE, ...FIJOS, ...fuentes, ...assets])].sort();

        const plantilla = readFileSync(new URL('../src/pwa/sw.js', import.meta.url), 'utf8');
        const sw = plantilla.replace("'__VERSION__'", JSON.stringify(version)).replace('__PRECACHE__', JSON.stringify(precache, null, 2));
        writeFileSync(join(raiz, 'sw.js'), sw);
        logger.info(`sw.js ${version}: ${precache.length} archivos en precache`);
      },
    },
  };
}
