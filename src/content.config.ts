// Colecciones de contenido. Servicios: un Markdown por servicio y por idioma en
// src/content/servicios/<clave>.<idioma>.md, unidos por `clave` (ver src/lib/servicios.ts).
// El cuerpo del Markdown queda libre para el texto largo de cada servicio.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { cms, desdeDatos } from './lib/cms/loader';
import { FAQ, TEMAS_FAQ } from './data/faq';
import { CLIENTES_LOCALES, SECTORES } from './data/clientes';

// El id sale de la ruta del archivo y no del campo `slug`, que el loader usa por defecto: un
// slug igual en los dos idiomas ("inclusion") haría que una entrada pisara a la otra.
const idPorArchivo = ({ entry }: { entry: string }) => entry.replace(/\.md$/, '');

const servicios = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/servicios', generateId: idPorArchivo }),
  schema: ({ image }) =>
    z.object({
      clave: z.string().regex(/^[a-z][a-z0-9-]*$/, 'La clave va en minúsculas, sin espacios ni puntos'),
      idioma: z.enum(['es', 'en']),
      orden: z.number().int().positive(),
      imagen: image(),
      provisional: z.boolean().optional(),
      /** En producción un borrador no genera página ni aparece en enlaces, sitemap ni JSON-LD. */
      borrador: z.boolean().default(false),
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'El slug va en minúsculas y con guiones'),
      title: z.string().min(1),
      lead: z.string().min(1),
      facts: z.array(z.string().min(1)),
      includes: z.array(z.string().min(1)),
      /** Herramientas con las que trabaja el servicio (la capacitación en IA, por ejemplo). */
      herramientas: z.array(z.object({ nombre: z.string().min(1), texto: z.string().min(1) })).optional(),
      /** Aliado que presta el servicio a nombre de Antídoto. */
      aliado: z.object({ nombre: z.string().min(1), url: z.url(), texto: z.string().min(1) }).optional(),
      alt: z.string().min(1),
    }),
});

// Ofertas: subpáginas de cada línea, en src/content/ofertas/<linea>/<clave>.<idioma>.md.
const ofertas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ofertas', generateId: idPorArchivo }),
  schema: z.object({
    clave: z.string().regex(/^[a-z][a-z0-9-]*$/, 'La clave va en minúsculas, sin espacios ni puntos'),
    idioma: z.enum(['es', 'en']),
    linea: z.string().min(1),
    orden: z.number().int().positive(),
    borrador: z.boolean().default(false),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'El slug va en minúsculas y con guiones'),
    title: z.string().min(1),
    lead: z.string().min(1),
    para: z.array(z.string().min(1)).default([]),
    incluye: z.array(z.string().min(1)).default([]),
  }),
});

// Casos del portafolio y artículos del blog: un Markdown por idioma. Los archivos que empiezan
// por "_" son plantillas y no se cargan. Nada se publica sin validación del cliente.
// También se publican desde el panel (src/lib/cms/): con PUBLIC_API_URL, el build suma lo publicado
// allá y una entrada del panel reemplaza a la local con la misma clave.
const casos = defineCollection({
  loader: cms({ tipo: 'caso', local: glob({ pattern: '[!_]*.md', base: './src/content/casos', generateId: idPorArchivo }) }),
  schema: ({ image }) =>
    z.object({
      clave: z.string().regex(/^[a-z][a-z0-9-]*$/),
      idioma: z.enum(['es', 'en']),
      borrador: z.boolean().default(true),
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      title: z.string().min(1),
      lead: z.string().min(1),
      fecha: z.coerce.date(),
      /** Clave del servicio principal del caso. */
      linea: z.string().min(1),
      /** Clave de la solución por área (src/data/soluciones.ts), si aplica. */
      solucion: z.string().optional(),
      /** Nombre del cliente: solo con su autorización escrita. */
      cliente: z.string().optional(),
      reto: z.string().min(1),
      solucionTexto: z.string().min(1),
      resultado: z.string().min(1),
      imagen: image(),
      alt: z.string().min(1),
    }),
});

const blog = defineCollection({
  loader: cms({ tipo: 'blog', local: glob({ pattern: '[!_]*.md', base: './src/content/blog', generateId: idPorArchivo }) }),
  schema: ({ image }) =>
    z.object({
      clave: z.string().regex(/^[a-z][a-z0-9-]*$/),
      idioma: z.enum(['es', 'en']),
      borrador: z.boolean().default(true),
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      title: z.string().min(1),
      lead: z.string().min(1),
      fecha: z.coerce.date(),
      categoria: z.enum(['sst', 'formacion', 'audiovisual', 'eventos', 'cultura']),
      lineas: z.array(z.string()).default([]),
      autor: z.string().min(1),
      imagen: image(),
      alt: z.string().min(1),
    }),
});

// Vacantes de Trabaja con nosotros: solo desde el panel (no hay fuente local).
const vacantes = defineCollection({
  loader: cms({ tipo: 'vacante' }),
  schema: z.object({
    clave: z.string().regex(/^[a-z][a-z0-9-]*$/),
    idioma: z.enum(['es', 'en']),
    borrador: z.boolean().default(false),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    title: z.string().min(1),
    lead: z.string().min(1),
    modalidad: z.enum(['presencial', 'hibrida', 'remota']),
    ciudad: z.string().optional(),
    vinculo: z.enum(['completo', 'medio', 'proyecto']),
    cierre: z.string().optional(),
  }),
});

// Preguntas frecuentes: las de src/data/faq.ts más las publicadas en el panel. Una entrada por
// pregunta, con los dos idiomas dentro.
const faq = defineCollection({
  loader: cms({
    tipo: 'faq',
    local: desdeDatos('faq-local', 'src/data/faq.ts', () =>
      FAQ.map((p, i) => ({ id: p.clave, data: { clave: p.clave, tema: p.tema, destacada: !!p.destacada, orden: i, es: p.es, en: p.en } })),
    ),
  }),
  schema: z.object({
    clave: z.string().min(1),
    tema: z.enum(TEMAS_FAQ),
    destacada: z.boolean().default(false),
    orden: z.number().int().default(999),
    es: z.tuple([z.string().min(1), z.string().min(1)]),
    en: z.tuple([z.string().min(1), z.string().min(1)]),
  }),
});

// Clientes con logo: los de src/data/clientes.ts (logos en blanco) más los publicados en el panel
// (logos a color). En los dos casos el CSS los pasa a tinta sobre fondo claro.
const clientes = defineCollection({
  loader: cms({
    tipo: 'cliente',
    local: desdeDatos('clientes-local', 'src/data/clientes.ts', () =>
      CLIENTES_LOCALES.map(([archivo, nombre, sector], i) => ({ id: archivo, data: { clave: archivo, nombre, sector, logo: `../assets/clientes/${archivo}.png`, orden: i } })),
    ),
  }),
  schema: ({ image }) =>
    z.object({
      clave: z.string().min(1),
      nombre: z.string().min(1),
      sector: z.enum(SECTORES),
      logo: image(),
      /** Logo a color (los del panel); los locales son blancos. */
      color: z.boolean().default(false),
      orden: z.number().int().default(999),
    }),
});

export const collections = { servicios, ofertas, casos, blog, vacantes, faq, clientes };
