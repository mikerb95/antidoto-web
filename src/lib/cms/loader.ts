// Cargador de Astro para el contenido que se publica desde el panel. Envuelve la fuente local de
// cada colección (los Markdown de src/content/ o los datos de src/data/) y, si el build tiene
// PUBLIC_API_URL, le suma lo publicado en GET /v1/contenido: una entrada del panel reemplaza a la
// local con la misma clave.
//
// Las imágenes se descargan a src/content/.cms/medios/ (fuera de git) y cada entrada apunta a
// ellas con una ruta relativa: así image() de astro:assets las optimiza igual que las locales
// (WebP, srcset) y no hace falta abrir la CSP a otro dominio.
//
// Sin PUBLIC_API_URL todo queda como antes. Con ella, si la API falla en CI (de donde salen los
// despliegues), el build falla: es mejor no desplegar que despublicar algo en silencio. En local
// solo avisa y sigue con lo local (la API local suele estar apagada). CMS_ESTRICTO=1 lo fuerza.

/** ¿Un fallo de la API detiene el build? */
export const estricto = () => process.env.CI === 'true' || process.env.VERCEL === '1' || process.env.CMS_ESTRICTO === '1';
import { access, mkdir, writeFile } from 'node:fs/promises';
import type { Loader, LoaderContext } from 'astro/loaders';
import { archivoMedio, clavesReemplazadas, convertir, type EntradaColeccion, type RespuestaApi, type TipoCms } from './convertir';

const CARPETA = 'src/content/.cms/';

function apiUrl(): string {
  return String(import.meta.env.PUBLIC_API_URL || process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
}

/** Fuente local hecha de datos en memoria (preguntas y clientes de src/data/). */
export function desdeDatos(nombre: string, filePath: string, entradas: () => EntradaColeccion[]): Loader {
  return {
    name: nombre,
    load: async ({ store, parseData, generateDigest }) => {
      store.clear();
      for (const e of entradas()) {
        const data = await parseData({ id: e.id, data: e.data, filePath });
        store.set({ id: e.id, data, filePath, digest: generateDigest(e.data) });
      }
    },
  };
}

async function existe(ruta: URL) {
  try {
    await access(ruta);
    return true;
  } catch {
    return false;
  }
}

async function pedir(api: string, tipo: TipoCms): Promise<RespuestaApi> {
  const r = await fetch(`${api}/v1/contenido?tipo=${tipo}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`La API respondió ${r.status} al pedir el contenido "${tipo}"`);
  return (await r.json()) as RespuestaApi;
}

async function bajarMedios(ctx: LoaderContext, r: RespuestaApi) {
  const dir = new URL(`${CARPETA}medios/`, ctx.config.root);
  await mkdir(dir, { recursive: true });
  for (const [id, m] of Object.entries(r.medios)) {
    const destino = new URL(archivoMedio(id, m), dir);
    if (await existe(destino)) continue; // los ids no cambian: una imagen se baja una vez
    const res = await fetch(m.url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`No se pudo bajar la imagen ${id} (${res.status})`);
    await writeFile(destino, new Uint8Array(await res.arrayBuffer()));
  }
}

export function cms({ tipo, local }: { tipo: TipoCms; local?: Loader }): Loader {
  return {
    name: `cms-${tipo}`,
    load: async (ctx) => {
      if (local) await local.load(ctx);
      else ctx.store.clear();
      const api = apiUrl();
      if (!api) return;

      let respuesta: RespuestaApi;
      try {
        respuesta = await pedir(api, tipo);
        await bajarMedios(ctx, respuesta);
      } catch (e) {
        if (estricto()) throw new Error(`[cms] ${(e as Error).message}. El build se detiene para no despublicar contenido sin querer.`);
        ctx.logger.warn(`[cms] Sin contenido del panel para "${tipo}": ${(e as Error).message}. Sigue con el contenido local.`);
        return;
      }

      // Una entrada del panel reemplaza a la local con la misma clave (en todos sus idiomas).
      const reemplazadas = clavesReemplazadas([...ctx.store.values()], respuesta.entradas);
      for (const [id, entrada] of ctx.store.entries()) if (reemplazadas.has(String(entrada.data.clave))) ctx.store.delete(id);

      const dir = new URL(`${CARPETA}${tipo}/`, ctx.config.root);
      await mkdir(dir, { recursive: true });
      for (const e of respuesta.entradas) {
        for (const x of convertir(tipo, e, respuesta.medios)) {
          const filePath = `${CARPETA}${tipo}/${x.id}.json`;
          // El archivo deja ver qué llegó del panel y es la base para resolver las imágenes relativas.
          await writeFile(new URL(`${x.id}.json`, dir), JSON.stringify({ ...x.data, cuerpo: x.body ?? null }, null, 2));
          const data = await ctx.parseData({ id: x.id, data: x.data, filePath });
          ctx.store.set({
            id: x.id,
            data,
            filePath,
            ...(x.body ? { body: x.body, rendered: await ctx.renderMarkdown(x.body) } : {}),
            digest: ctx.generateDigest({ data: x.data, body: x.body ?? '' }),
          });
        }
      }
      ctx.logger.info(`[cms] ${respuesta.entradas.length} entradas de "${tipo}" desde el panel`);
    },
  };
}
