// Contenido de las colecciones además de los servicios: ofertas de cada línea, casos del
// portafolio y artículos del blog. Como obtenerServicios(), cada función guarda su promesa y
// en `npm run dev` incluye los borradores.
import { getCollection, type CollectionEntry } from 'astro:content';
import { obtenerServicios } from './servicios';
import { emparejarOfertas, type Oferta } from '../lib/ofertas';
import { emparejarPublicaciones, type Publicacion } from '../lib/publicaciones';
import type { TemaFaq } from './faq';
import type { Locale } from '../i18n/ui';
import { REGALO_NOVEDADES, VIDEO_HERO } from './site';
import { estricto } from '../lib/cms/loader';

export { ofertaPath, type Oferta } from '../lib/ofertas';
export { casoPath, articuloPath, casosBase, blogBase } from '../lib/publicaciones';

const borradores = import.meta.env.DEV;

let ofertas: Promise<Oferta[]> | undefined;

/** Ofertas publicables, en el orden de su línea. Con `linea`, solo las de esa línea. */
export async function obtenerOfertas(linea?: string): Promise<Oferta[]> {
  ofertas ??= Promise.all([getCollection('ofertas'), getCollection('servicios'), obtenerServicios()]).then(([entradas, todas, servicios]) =>
    emparejarOfertas(
      entradas.map((e) => ({ ...e.data, entrada: e.id })),
      { borradores, servicios, lineasConocidas: [...new Set(todas.map((s) => s.data.clave))] },
    ),
  );
  const lista = await ofertas;
  return linea ? lista.filter((o) => o.linea === linea) : lista;
}

type DatosCaso = CollectionEntry<'casos'>['data'] & { entrada?: string };
type DatosArticulo = CollectionEntry<'blog'>['data'] & { entrada?: string };
export type Caso = Publicacion<DatosCaso>;
export type Articulo = Publicacion<DatosArticulo>;

let casos: Promise<Caso[]> | undefined;
let articulos: Promise<Articulo[]> | undefined;

/** Casos publicables (validados por el cliente), del más reciente al más antiguo. */
export function obtenerCasos(): Promise<Caso[]> {
  casos ??= Promise.all([getCollection('casos'), obtenerServicios()]).then(([entradas, servicios]) =>
    emparejarPublicaciones(
      entradas.map((e) => ({ ...e.data, imagen: e.data.imagen, entrada: e.id })),
      { borradores, nombre: (c) => `El caso "${c}"` },
    ).filter((c) => servicios.some((s) => s.id === c.es.linea)),
  );
  return casos;
}

/** Artículos publicables, del más reciente al más antiguo. */
export function obtenerArticulos(): Promise<Articulo[]> {
  articulos ??= getCollection('blog').then((entradas) =>
    emparejarPublicaciones(
      entradas.map((e) => ({ ...e.data, entrada: e.id })),
      { borradores, nombre: (c) => `El artículo "${c}"` },
    ),
  );
  return articulos;
}

// Preguntas, clientes y vacantes: lo local más lo publicado en el panel (src/lib/cms/).

export interface PreguntaFaq {
  clave: string;
  tema: TemaFaq;
  pregunta: string;
  respuesta: string;
}

let faq: Promise<CollectionEntry<'faq'>['data'][]> | undefined;

/** Preguntas frecuentes en un idioma, por tema o solo las destacadas, en su orden. */
export async function obtenerPreguntas(locale: Locale, filtro: { tema?: TemaFaq; destacadas?: boolean } = {}): Promise<PreguntaFaq[]> {
  faq ??= getCollection('faq').then((e) => e.map((x) => x.data).sort((a, b) => a.orden - b.orden));
  return (await faq)
    .filter((p) => (!filtro.tema || p.tema === filtro.tema) && (!filtro.destacadas || p.destacada))
    .map((p) => ({ clave: p.clave, tema: p.tema, pregunta: p[locale][0], respuesta: p[locale][1] }));
}

export type Cliente = Pick<CollectionEntry<'clientes'>['data'], 'nombre' | 'sector' | 'logo' | 'color'>;
let clientes: Promise<Cliente[]> | undefined;

/** Clientes con logo, en su orden (los locales primero, salvo que el panel diga otro orden). */
export function obtenerClientes(): Promise<Cliente[]> {
  clientes ??= getCollection('clientes').then((e) =>
    e
      .map((x) => x.data)
      .sort((a, b) => a.orden - b.orden)
      .map(({ nombre, sector, logo, color }) => ({ nombre, sector, logo, color })),
  );
  return clientes;
}

export type Vacante = CollectionEntry<'vacantes'>;
let vacantes: Promise<Vacante[]> | undefined;

/** Vacantes abiertas de un idioma (las cerradas ya no llegan del cargador). */
export async function obtenerVacantes(locale: Locale): Promise<Vacante[]> {
  vacantes ??= getCollection('vacantes');
  return (await vacantes).filter((v) => v.data.idioma === locale && (borradores || !v.data.borrador));
}

export interface AjustesSitio {
  regaloNovedades: { es: string; en: string } | null;
  videoHero: { mp4: string; webm?: string } | null;
}
let ajustes: Promise<AjustesSitio> | undefined;

/**
 * Regalo de bienvenida y video del hero: lo fijado en el panel (Ajustes) y, si no hay, lo de
 * src/data/site.ts. Igual que el contenido, un build en CI con PUBLIC_API_URL falla si la API no
 * responde.
 */
export function obtenerAjustes(): Promise<AjustesSitio> {
  ajustes ??= (async () => {
    const base: AjustesSitio = { regaloNovedades: REGALO_NOVEDADES, videoHero: VIDEO_HERO };
    const api = String(import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
    if (!api) return base;
    try {
      const r = await fetch(`${api}/v1/ajustes`, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`la API respondió ${r.status}`);
      const d = (await r.json()) as Partial<AjustesSitio>;
      return { regaloNovedades: d.regaloNovedades ?? base.regaloNovedades, videoHero: d.videoHero ?? base.videoHero };
    } catch (e) {
      if (estricto()) throw new Error(`[cms] No se pudieron leer los ajustes del sitio: ${(e as Error).message}`);
      return base;
    }
  })();
  return ajustes;
}
