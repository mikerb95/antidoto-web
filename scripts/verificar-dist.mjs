// Verifica el sitio construido en dist/ (correr después de `npm run build`):
// - todo enlace interno (href que empieza por "/") apunta a una página o archivo que existe;
// - cada página tiene un solo <h1>;
// - la nav no enlaza a anclas de la home (el sitio es multipágina: cada entrada es una página);
// - toda página interna indexable trae migas de pan.
// Sale con código 1 y la lista de problemas si algo falla.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
if (!existsSync(DIST)) {
  console.error('No existe dist/: corre `npm run build` primero.');
  process.exit(1);
}

const html = [];
(function recorrer(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (f.endsWith('.html')) html.push(p);
  }
})(DIST);

const existe = (ruta) => {
  const limpia = decodeURIComponent(ruta.split(/[?#]/)[0]);
  if (limpia === '' || limpia === '/') return existsSync(join(DIST, 'index.html'));
  const p = join(DIST, limpia);
  return existsSync(p) && (statSync(p).isFile() || existsSync(join(p, 'index.html')));
};

const problemas = [];
let enlaces = 0;
for (const archivo of html) {
  const ruta = `/${relative(DIST, archivo).replace(/index\.html$/, '')}`;
  const doc = readFileSync(archivo, 'utf8');
  const interna = !ruta.startsWith('/docs/') && !/name="robots" content="noindex/.test(doc);

  for (const [, href] of doc.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    enlaces++;
    if (!existe(href)) problemas.push(`${ruta}: enlace roto a ${href}`);
  }

  const h1 = (doc.match(/<h1\b/g) ?? []).length;
  if (h1 !== 1) problemas.push(`${ruta}: tiene ${h1} h1`);

  const nav = doc.match(/<header class="nav[\s\S]*?<\/header>/)?.[0] ?? '';
  for (const [, href] of nav.matchAll(/href="([^"]*#[^"]*)"/g)) problemas.push(`${ruta}: la nav enlaza a un ancla (${href})`);

  const home = ruta === '/' || ruta === '/en/';
  if (interna && !home && ruta !== '/404.html' && !/<nav class="migas/.test(doc)) problemas.push(`${ruta}: sin migas de pan`);
}

if (problemas.length) {
  console.error(`${problemas.length} problema(s) en ${html.length} páginas:\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}
console.log(`dist/ verificado: ${html.length} páginas, ${enlaces} enlaces internos, sin problemas.`);
