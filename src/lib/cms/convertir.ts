// Convierte lo que publica el panel (GET /v1/contenido de la API) en las entradas de las
// colecciones del sitio, con los mismos campos que los Markdown de src/content/. Funciones puras,
// con pruebas en tests/cms.test.ts. Las imágenes llegan como ruta relativa al archivo de la
// entrada (src/content/.cms/<tipo>/), donde el cargador las dejó descargadas.

export type TipoCms = 'blog' | 'caso' | 'vacante' | 'faq' | 'cliente';

export interface EntradaApi {
  clave: string;
  datos: Record<string, unknown>;
  textos: Partial<Record<'es' | 'en', Record<string, unknown>>>;
  version: number;
  publicadaEn: number | null;
}

export interface MedioApi {
  url: string;
  mime: string;
  ancho: number;
  alto: number;
}

export interface RespuestaApi {
  tipo: TipoCms;
  entradas: EntradaApi[];
  medios: Record<string, MedioApi>;
}

export interface EntradaColeccion {
  id: string;
  data: Record<string, unknown>;
  body?: string;
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Nombre del archivo local de una imagen del panel. */
export function archivoMedio(id: string, medio: MedioApi): string {
  return `${id}.${EXT[medio.mime] ?? 'img'}`;
}

/** Ruta de la imagen relativa a src/content/.cms/<tipo>/ (donde va cada entrada). */
export const rutaMedio = (id: string, medio: MedioApi) => `../medios/${archivoMedio(id, medio)}`;

const s = (v: unknown) => (typeof v === 'string' ? v : undefined);
const sinVacios = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

/** Hoy en Colombia (AAAA-MM-DD), para no publicar vacantes cerradas. */
export const hoyBogota = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(ms));

/**
 * Entradas de la colección para una entrada del panel: una por idioma en blog, casos y vacantes;
 * una sola en preguntas (con los dos idiomas dentro) y en clientes.
 */
export function convertir(tipo: TipoCms, e: EntradaApi, medios: Record<string, MedioApi>, hoy = hoyBogota()): EntradaColeccion[] {
  const img = (id: unknown) => {
    const m = typeof id === 'string' ? medios[id] : undefined;
    if (!m) throw new Error(`La entrada "${e.clave}" (${tipo}) usa una imagen que la API no devolvió: ${String(id)}`);
    return rutaMedio(id as string, m);
  };
  const d = e.datos;
  if (tipo === 'faq') {
    const par = (i: 'es' | 'en') => [s(e.textos[i]?.pregunta) ?? '', s(e.textos[i]?.respuesta) ?? ''];
    return [{ id: e.clave, data: sinVacios({ clave: e.clave, tema: d.tema, destacada: d.destacada === true, orden: d.orden, es: par('es'), en: par('en') }) }];
  }
  if (tipo === 'cliente') {
    return [{ id: e.clave, data: sinVacios({ clave: e.clave, nombre: d.nombre, sector: d.sector, logo: img(d.logo), color: true, orden: d.orden }) }];
  }
  if (tipo === 'vacante' && typeof d.cierre === 'string' && d.cierre < hoy) return [];
  return (['es', 'en'] as const).map((idioma) => {
    const t = e.textos[idioma] ?? {};
    const comun = { clave: e.clave, idioma, borrador: false, slug: t.slug, title: t.title, lead: t.lead };
    const cuerpo = s(t.cuerpo);
    if (tipo === 'blog')
      return { id: `${e.clave}.${idioma}`, body: cuerpo, data: sinVacios({ ...comun, fecha: d.fecha, categoria: d.categoria, lineas: d.lineas ?? [], autor: d.autor, imagen: img(d.imagen), alt: t.alt }) };
    if (tipo === 'caso')
      return {
        id: `${e.clave}.${idioma}`,
        body: cuerpo,
        data: sinVacios({ ...comun, fecha: d.fecha, linea: d.linea, solucion: d.solucion, cliente: d.cliente, reto: t.reto, solucionTexto: t.solucionTexto, resultado: t.resultado, imagen: img(d.imagen), alt: t.alt }),
      };
    return { id: `${e.clave}.${idioma}`, body: cuerpo, data: sinVacios({ ...comun, modalidad: d.modalidad, ciudad: d.ciudad, vinculo: d.vinculo, cierre: d.cierre }) };
  });
}

/** Claves de las entradas locales que el panel reemplaza (misma clave). */
export function clavesReemplazadas(locales: { data: { clave?: unknown } }[], api: EntradaApi[]): Set<string> {
  const delPanel = new Set(api.map((e) => e.clave));
  return new Set(locales.map((l) => String(l.data.clave)).filter((c) => delPanel.has(c)));
}
