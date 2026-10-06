// Tipos de contenido que se editan desde el panel y se publican en el sitio. Cada tipo declara
// sus campos comunes (iguales en los dos idiomas) y los de cada idioma. Lo comparten la API
// (validación) y el panel (formularios), y copia las reglas de src/content.config.ts del sitio.
//
// Módulo PURO, sin dependencias.

export const TIPOS_CONTENIDO = ['blog', 'caso', 'vacante', 'faq', 'cliente'] as const;
export type TipoContenido = (typeof TIPOS_CONTENIDO)[number];

export type Campo =
  | { tipo: 'texto'; nombre: string; etiqueta: string; requerido?: boolean; max?: number; ayuda?: string }
  | { tipo: 'parrafo'; nombre: string; etiqueta: string; requerido?: boolean; max?: number; ayuda?: string }
  | { tipo: 'markdown'; nombre: string; etiqueta: string; requerido?: boolean; ayuda?: string }
  | { tipo: 'slug'; nombre: string; etiqueta: string; requerido?: boolean; ayuda?: string }
  | { tipo: 'fecha'; nombre: string; etiqueta: string; requerido?: boolean; ayuda?: string }
  | { tipo: 'opcion'; nombre: string; etiqueta: string; requerido?: boolean; opciones: readonly (readonly [string, string])[]; ayuda?: string }
  | { tipo: 'varias'; nombre: string; etiqueta: string; opciones: readonly (readonly [string, string])[]; ayuda?: string }
  | { tipo: 'si-no'; nombre: string; etiqueta: string; ayuda?: string }
  | { tipo: 'numero'; nombre: string; etiqueta: string; min?: number; max?: number; ayuda?: string }
  | { tipo: 'imagen'; nombre: string; etiqueta: string; requerido?: boolean; ayuda?: string };

export interface Esquema {
  nombre: string;
  plural: string;
  descripcion: string;
  comunes: readonly Campo[];
  /** Vacío: el tipo no se traduce (un cliente se llama igual en los dos idiomas). */
  porIdioma: readonly Campo[];
  /** Campo de cada idioma (o común) que sirve de título en las listas. */
  titulo: string;
}

const LINEAS = [
  ['formaciones', 'Formaciones vivenciales'],
  ['audiovisual', 'Producción audiovisual'],
  ['catering', 'Catering corporativo'],
  ['diseno', 'Diseño de productos'],
  ['ia', 'Capacitación en IA'],
] as const;

const SLUG = { tipo: 'slug', nombre: 'slug', etiqueta: 'Dirección (slug)', requerido: true, ayuda: 'Minúsculas y guiones. Es la última parte de la URL.' } as const;
const TITULO = { tipo: 'texto', nombre: 'title', etiqueta: 'Título', requerido: true, max: 140 } as const;
const LEAD = { tipo: 'parrafo', nombre: 'lead', etiqueta: 'Entradilla', requerido: true, max: 320, ayuda: 'Una o dos frases que resumen. Sale en las tarjetas y en buscadores.' } as const;
const ALT = { tipo: 'texto', nombre: 'alt', etiqueta: 'Descripción de la imagen', requerido: true, max: 200, ayuda: 'Qué se ve en la foto, para quien no la ve.' } as const;

export const ESQUEMAS: Record<TipoContenido, Esquema> = {
  blog: {
    nombre: 'Artículo',
    plural: 'Blog',
    descripcion: 'Artículos del blog, con su página y su lugar en el RSS.',
    comunes: [
      { tipo: 'fecha', nombre: 'fecha', etiqueta: 'Fecha de publicación', requerido: true },
      {
        tipo: 'opcion',
        nombre: 'categoria',
        etiqueta: 'Categoría',
        requerido: true,
        opciones: [
          ['sst', 'Seguridad y salud en el trabajo'],
          ['formacion', 'Formación'],
          ['audiovisual', 'Audiovisual'],
          ['eventos', 'Eventos'],
          ['cultura', 'Cultura organizacional'],
        ],
      },
      { tipo: 'varias', nombre: 'lineas', etiqueta: 'Líneas de servicio relacionadas', opciones: LINEAS },
      { tipo: 'texto', nombre: 'autor', etiqueta: 'Autor', requerido: true, max: 80 },
      { tipo: 'imagen', nombre: 'imagen', etiqueta: 'Imagen principal', requerido: true },
    ],
    porIdioma: [TITULO, SLUG, LEAD, ALT, { tipo: 'markdown', nombre: 'cuerpo', etiqueta: 'Texto del artículo', requerido: true }],
    titulo: 'title',
  },
  caso: {
    nombre: 'Caso',
    plural: 'Portafolio',
    descripcion: 'Casos del portafolio. El nombre del cliente solo con su autorización escrita.',
    comunes: [
      { tipo: 'fecha', nombre: 'fecha', etiqueta: 'Fecha del proyecto', requerido: true },
      { tipo: 'opcion', nombre: 'linea', etiqueta: 'Línea de servicio', requerido: true, opciones: LINEAS },
      {
        tipo: 'opcion',
        nombre: 'solucion',
        etiqueta: 'Solución por área',
        // Claves de src/data/soluciones.ts del sitio.
        opciones: [
          ['sst', 'SST y HSEQ'],
          ['talento', 'Talento humano y bienestar'],
          ['comunicaciones', 'Comunicaciones internas'],
          ['educacion', 'Colegios y universidades'],
        ],
      },
      { tipo: 'texto', nombre: 'cliente', etiqueta: 'Cliente', max: 120, ayuda: 'Déjalo vacío si el cliente no autorizó por escrito que se nombre.' },
      { tipo: 'imagen', nombre: 'imagen', etiqueta: 'Imagen principal', requerido: true },
    ],
    porIdioma: [
      TITULO,
      SLUG,
      LEAD,
      { tipo: 'parrafo', nombre: 'reto', etiqueta: 'El reto', requerido: true, max: 1200 },
      { tipo: 'parrafo', nombre: 'solucionTexto', etiqueta: 'Qué hicimos', requerido: true, max: 1200 },
      { tipo: 'parrafo', nombre: 'resultado', etiqueta: 'El resultado', requerido: true, max: 1200 },
      ALT,
      { tipo: 'markdown', nombre: 'cuerpo', etiqueta: 'Texto adicional', ayuda: 'Opcional.' },
    ],
    titulo: 'title',
  },
  vacante: {
    nombre: 'Vacante',
    plural: 'Vacantes',
    descripcion: 'Ofertas de trabajo que salen en Trabaja con nosotros.',
    comunes: [
      {
        tipo: 'opcion',
        nombre: 'modalidad',
        etiqueta: 'Modalidad',
        requerido: true,
        opciones: [
          ['presencial', 'Presencial'],
          ['hibrida', 'Híbrida'],
          ['remota', 'Remota'],
        ],
      },
      { tipo: 'texto', nombre: 'ciudad', etiqueta: 'Ciudad', max: 80 },
      {
        tipo: 'opcion',
        nombre: 'vinculo',
        etiqueta: 'Tipo de vinculación',
        requerido: true,
        opciones: [
          ['completo', 'Tiempo completo'],
          ['medio', 'Medio tiempo'],
          ['proyecto', 'Por proyecto'],
        ],
      },
      { tipo: 'fecha', nombre: 'cierre', etiqueta: 'Recibimos hojas de vida hasta', ayuda: 'Opcional. Pasada la fecha, la vacante deja de salir en el próximo despliegue.' },
    ],
    porIdioma: [TITULO, SLUG, LEAD, { tipo: 'markdown', nombre: 'cuerpo', etiqueta: 'Descripción del cargo', requerido: true, ayuda: 'Responsabilidades, perfil y cómo postularse.' }],
    titulo: 'title',
  },
  faq: {
    nombre: 'Pregunta',
    plural: 'Preguntas frecuentes',
    descripcion: 'Preguntas de /preguntas-frecuentes/, de cada línea y de la home. El chat con IA también las usa.',
    comunes: [
      {
        tipo: 'opcion',
        nombre: 'tema',
        etiqueta: 'Tema',
        requerido: true,
        opciones: [['general', 'General'], ...LINEAS, ['cotizacion', 'Cotización']],
      },
      { tipo: 'si-no', nombre: 'destacada', etiqueta: 'Destacada en la home' },
      { tipo: 'numero', nombre: 'orden', etiqueta: 'Orden', min: 0, max: 999, ayuda: 'Las de menor número van primero dentro de su tema.' },
    ],
    porIdioma: [
      { tipo: 'texto', nombre: 'pregunta', etiqueta: 'Pregunta', requerido: true, max: 200 },
      { tipo: 'parrafo', nombre: 'respuesta', etiqueta: 'Respuesta', requerido: true, max: 1500, ayuda: 'Lo que falte del cliente va entre corchetes: [ASÍ]. El sitio lo marca como pendiente.' },
    ],
    titulo: 'pregunta',
  },
  cliente: {
    nombre: 'Cliente',
    plural: 'Clientes',
    descripcion: 'Logos de clientes del sitio. Solo con autorización para mostrar la marca.',
    comunes: [
      { tipo: 'texto', nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 80 },
      {
        tipo: 'opcion',
        nombre: 'sector',
        etiqueta: 'Sector',
        requerido: true,
        opciones: [
          ['ingenieria', 'Ingeniería'],
          ['sst', 'Seguridad y salud en el trabajo'],
          ['seguros', 'Seguros'],
          ['transporte', 'Transporte'],
          ['otros', 'Otros'],
        ],
      },
      { tipo: 'imagen', nombre: 'logo', etiqueta: 'Logo a color', requerido: true, ayuda: 'PNG o WebP con fondo transparente. El sitio lo pasa a tinta donde hace falta.' },
      { tipo: 'numero', nombre: 'orden', etiqueta: 'Orden', min: 0, max: 999, ayuda: 'Los de menor número van primero.' },
    ],
    porIdioma: [],
    titulo: 'nombre',
  },
};

export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

export interface DatosContenido {
  clave: string;
  datos: Record<string, unknown>;
  textos: Partial<Record<Idioma, Record<string, unknown>>>;
}

export const RE_CLAVE = /^[a-z][a-z0-9-]{0,59}$/;
export const RE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MARKDOWN = 40_000;

/** Errores por campo: "datos.fecha", "es.title"... Vacío si está bien. */
export type Errores = Record<string, string>;

function validarCampo(c: Campo, v: unknown, publicar: boolean): { valor: unknown; error?: string } {
  const vacio = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  const requerido = 'requerido' in c && c.requerido;
  if (vacio) return { valor: c.tipo === 'varias' ? [] : c.tipo === 'si-no' ? false : null, ...(publicar && requerido ? { error: 'Falta este dato' } : {}) };
  switch (c.tipo) {
    case 'texto':
    case 'parrafo': {
      if (typeof v !== 'string') return { valor: null, error: 'Debe ser texto' };
      const t = v.trim();
      return t.length > (c.max ?? 5000) ? { valor: t, error: `Máximo ${c.max} caracteres` } : { valor: t };
    }
    case 'markdown':
      if (typeof v !== 'string') return { valor: null, error: 'Debe ser texto' };
      return v.length > MAX_MARKDOWN ? { valor: v, error: 'El texto es demasiado largo' } : { valor: v.replace(/\r\n/g, '\n').trim() };
    case 'slug':
      return typeof v === 'string' && RE_SLUG.test(v) && v.length <= 80 ? { valor: v } : { valor: v, error: 'Solo minúsculas, números y guiones' };
    case 'fecha':
      return typeof v === 'string' && RE_FECHA.test(v) && !Number.isNaN(Date.parse(v)) ? { valor: v } : { valor: v, error: 'Fecha inválida' };
    case 'opcion':
      return c.opciones.some(([k]) => k === v) ? { valor: v } : { valor: null, error: 'Opción inválida' };
    case 'varias':
      return Array.isArray(v) && v.every((x) => c.opciones.some(([k]) => k === x)) ? { valor: [...new Set(v)] } : { valor: [], error: 'Opción inválida' };
    case 'si-no':
      return typeof v === 'boolean' ? { valor: v } : { valor: false, error: 'Debe ser sí o no' };
    case 'numero': {
      const n = typeof v === 'string' ? Number(v) : v;
      return typeof n === 'number' && Number.isInteger(n) && n >= (c.min ?? -1e9) && n <= (c.max ?? 1e9) ? { valor: n } : { valor: null, error: 'Número inválido' };
    }
    case 'imagen':
      return typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v) ? { valor: v } : { valor: null, error: 'Imagen inválida' };
  }
}

/**
 * Limpia y valida una entrada. Un borrador puede estar incompleto (solo se revisa el formato);
 * para publicar, todos los campos requeridos, en los dos idiomas si el tipo se traduce.
 */
export function validarContenido(tipo: TipoContenido, d: unknown, publicar = false): { ok: true; limpio: DatosContenido } | { ok: false; errores: Errores } {
  const e = ESQUEMAS[tipo];
  const errores: Errores = {};
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, errores: { cuerpo: 'Formato inválido' } };
  const o = d as Record<string, unknown>;
  const clave = typeof o.clave === 'string' ? o.clave.trim() : '';
  if (!RE_CLAVE.test(clave)) errores.clave = 'Minúsculas, números y guiones, empezando por letra';
  const entrada = (o.datos && typeof o.datos === 'object' ? o.datos : {}) as Record<string, unknown>;
  const datos: Record<string, unknown> = {};
  for (const c of e.comunes) {
    const r = validarCampo(c, entrada[c.nombre], publicar);
    datos[c.nombre] = r.valor;
    if (r.error) errores[`datos.${c.nombre}`] = r.error;
  }
  const textos: DatosContenido['textos'] = {};
  if (e.porIdioma.length) {
    const t = (o.textos && typeof o.textos === 'object' ? o.textos : {}) as Record<string, Record<string, unknown> | undefined>;
    for (const idioma of IDIOMAS) {
      const fuente = t[idioma] && typeof t[idioma] === 'object' ? t[idioma]! : {};
      const limpio: Record<string, unknown> = {};
      for (const c of e.porIdioma) {
        const r = validarCampo(c, fuente[c.nombre], publicar);
        limpio[c.nombre] = r.valor;
        if (r.error) errores[`${idioma}.${c.nombre}`] = r.error;
      }
      textos[idioma] = limpio;
    }
  }
  return Object.keys(errores).length ? { ok: false, errores } : { ok: true, limpio: { clave, datos, textos } };
}

/** Ids de medios (imágenes) que usa una entrada. */
export function mediosDe(tipo: TipoContenido, d: Pick<DatosContenido, 'datos'>): string[] {
  return ESQUEMAS[tipo].comunes.filter((c) => c.tipo === 'imagen').map((c) => d.datos[c.nombre]).filter((v): v is string => typeof v === 'string');
}

/** Título para listas: el del idioma español si el tipo se traduce. */
export function tituloDe(tipo: TipoContenido, d: Pick<DatosContenido, 'datos' | 'textos'>): string {
  const campo = ESQUEMAS[tipo].titulo;
  const v = ESQUEMAS[tipo].porIdioma.length ? (d.textos.es?.[campo] ?? d.textos.en?.[campo]) : d.datos[campo];
  return typeof v === 'string' && v ? v : 'Sin título';
}
