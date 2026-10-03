// Casos del portafolio y artículos del blog: un Markdown por idioma, unidos por `clave`.
// Se ordenan del más reciente al más antiguo. Sin imports de Astro en tiempo de ejecución
// para poder probarlos en tests/contenido.test.ts.
import type { ImageMetadata } from 'astro';
import type { Locale } from '../i18n/ui';
import { emparejarPorClave, type EntradaBase } from './contenido';

export interface EntradaPublicacion extends EntradaBase {
  title: string;
  lead: string;
  fecha: Date;
  imagen: ImageMetadata;
  alt: string;
  entrada?: string;
}

export interface Publicacion<E extends EntradaPublicacion> {
  id: string;
  fecha: Date;
  image: ImageMetadata;
  borrador: boolean;
  es: E;
  en: E;
}

/** Une por clave, exige la misma fecha e imagen en los dos idiomas y ordena por fecha. */
export function emparejarPublicaciones<E extends EntradaPublicacion>(
  entradas: E[],
  { borradores, nombre }: { borradores: boolean; nombre: (clave: string) => string },
): Publicacion<E>[] {
  return emparejarPorClave(entradas, {
    nombre,
    borradores,
    iguales: [
      [(e) => e.fecha.getTime(), 'tiene una fecha distinta en cada idioma'],
      [(e) => e.imagen.src, 'tiene una imagen distinta en cada idioma'],
    ],
  })
    .map(({ clave, borrador, es, en }) => ({ id: clave, fecha: es.fecha, image: es.imagen, borrador, es, en }))
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}

export const casosBase: Record<Locale, string> = { es: '/portafolio/', en: '/en/work/' };
export const blogBase: Record<Locale, string> = { es: '/blog/', en: '/en/blog/' };

export function casoPath(c: { es: { slug: string }; en: { slug: string } }, locale: Locale): string {
  return `${casosBase[locale]}${c[locale].slug}/`;
}

export function articuloPath(a: { es: { slug: string }; en: { slug: string } }, locale: Locale): string {
  return `${blogBase[locale]}${a[locale].slug}/`;
}
