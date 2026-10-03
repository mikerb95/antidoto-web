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
      alt: z.string().min(1),
    }),
});

export const collections = { servicios };
