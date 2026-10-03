// Colecciones de contenido. Servicios: un Markdown por servicio y por idioma en
// src/content/servicios/<clave>.<idioma>.md, unidos por `clave` (ver src/lib/servicios.ts).
// El cuerpo del Markdown queda libre para el texto largo de cada servicio.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const servicios = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/servicios' }),
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
  loader: glob({ pattern: '**/*.md', base: './src/content/ofertas' }),
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
const casos = defineCollection({
  loader: glob({ pattern: '[!_]*.md', base: './src/content/casos' }),
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
  loader: glob({ pattern: '[!_]*.md', base: './src/content/blog' }),
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

export const collections = { servicios, ofertas, casos, blog };
