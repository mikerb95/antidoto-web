// Empaqueta lo que publica el sitio sobre los servicios (src/content/servicios/*.md) y los
// nombres de los clientes (src/data/clientes.ts) en un módulo que el asesor lee. Así el asesor
// dice lo mismo que la página: si cambia un Markdown, cambia lo que sabe, sin tocar el prompt.
// Corre antes de dev, deploy, check y test; el archivo generado no se versiona.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('../../', import.meta.url);
const dirServicios = new URL('src/content/servicios/', raiz);

/** Frontmatter simple de los servicios: `clave: valor`, `clave: "texto"` y listas `  - "item"`. */
export function leerFrontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!m) throw new Error('sin frontmatter');
  const datos = {};
  let lista = null;
  for (const linea of m[1].split('\n')) {
    const item = /^\s+-\s+(.*)$/.exec(linea);
    if (item && lista) {
      lista.push(valor(item[1]));
      continue;
    }
    const par = /^([\w]+):\s*(.*)$/.exec(linea);
    if (!par) continue;
    if (par[2] === '') {
      lista = datos[par[1]] = [];
    } else {
      lista = null;
      datos[par[1]] = valor(par[2]);
    }
  }
  return datos;
}

function valor(crudo) {
  const v = crudo.trim();
  if (v.startsWith('"') && v.endsWith('"')) return JSON.parse(v);
  if (v === 'true' || v === 'false') return v === 'true';
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

const entradas = readdirSync(dirServicios)
  .filter((f) => f.endsWith('.md'))
  .map((f) => leerFrontmatter(readFileSync(new URL(f, dirServicios), 'utf8')));

// Igual que el build de producción (src/lib/servicios.ts): un borrador en cualquiera de los dos
// idiomas saca el servicio entero.
const claves = [...new Set(entradas.map((e) => e.clave))];
const servicios = claves
  .map((clave) => {
    const es = entradas.find((e) => e.clave === clave && e.idioma === 'es');
    const en = entradas.find((e) => e.clave === clave && e.idioma === 'en');
    if (!es || !en || es.borrador || en.borrador) return null;
    const texto = (e) => ({ titulo: e.title, slug: e.slug, resumen: e.lead, datos: e.facts ?? [], incluye: e.includes ?? [] });
    return { clave, orden: es.orden ?? 99, es: texto(es), en: texto(en) };
  })
  .filter(Boolean)
  .sort((a, b) => a.orden - b.orden)
  .map(({ orden: _, ...s }) => s);

const fuenteClientes = readFileSync(new URL('src/data/clientes.ts', raiz), 'utf8');
const clientes = [...fuenteClientes.matchAll(/^\s*\['[\w-]+', '([^']+)', '\w+'\],?$/gm)].map((m) => m[1]);
if (!clientes.length) throw new Error('No se encontraron clientes en src/data/clientes.ts');

const salida = `// Generado por scripts/empaquetar-conocimiento.mjs desde src/content/servicios/ y src/data/clientes.ts. No editar.
export const SERVICIOS_PUBLICOS = ${JSON.stringify(servicios, null, 2)} as const;
export const CLIENTES_PUBLICOS: readonly string[] = ${JSON.stringify(clientes)};
`;
writeFileSync(new URL('../src/asesor/publico.gen.ts', import.meta.url), salida);
