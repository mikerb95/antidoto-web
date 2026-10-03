// Lógica pura de los servicios: arma cada servicio con sus dos idiomas a partir de las
// entradas de la colección (un Markdown por servicio y por idioma) y aplica el borrador.
// Sin imports de Astro en tiempo de ejecución para poder probarla en tests/servicios.test.ts.
import type { ImageMetadata } from 'astro';
import type { Locale } from '../i18n/ui';
import { emparejarPorClave, repetido } from './contenido';

export interface ServicioTexto {
  slug: string;
  title: string;
  lead: string;
  facts: string[];
  includes: string[];
  alt: string;
  /** Id de la entrada en la colección, para renderizar el cuerpo del Markdown. */
  entrada?: string;
}

/** Datos de una entrada de la colección (frontmatter de un Markdown). */
export interface EntradaServicio extends ServicioTexto {
  clave: string;
  idioma: Locale;
  orden: number;
  imagen: ImageMetadata;
  provisional?: boolean;
  borrador?: boolean;
}

export interface Servicio {
  /** Clave estable: la usan view-transition-name, data-escena y el cotizador (la API la valida). */
  id: string;
  orden: number;
  image: ImageMetadata;
  /** Foto provisional hasta tener material real del servicio. */
  provisional?: boolean;
  /** Borrador: no se publica en producción. */
  borrador: boolean;
  es: ServicioTexto;
  en: ServicioTexto;
}

const texto = ({ slug, title, lead, facts, includes, alt, entrada }: EntradaServicio): ServicioTexto => ({
  slug,
  title,
  lead,
  facts,
  includes,
  alt,
  ...(entrada ? { entrada } : {}),
});

/**
 * Une las entradas por clave (ver emparejarPorClave), ordena por `orden` y, si no se piden,
 * quita los borradores. Un servicio es borrador si cualquiera de sus dos idiomas lo es: así
 * nunca se publica un idioma sin su par ni un hreflang a una página que no existe.
 * Lanza un error (y el build falla) si falta un idioma, si los dos idiomas no coinciden en
 * orden, imagen o foto provisional, o si se repite una clave, un orden o un slug.
 */
export function emparejar(entradas: EntradaServicio[], { borradores }: { borradores: boolean }): Servicio[] {
  const pares = emparejarPorClave(entradas, {
    nombre: (c) => `El servicio "${c}"`,
    borradores: true,
    iguales: [
      [(e) => e.orden, 'tiene un orden distinto en cada idioma'],
      [(e) => e.imagen.src, 'tiene una imagen distinta en cada idioma'],
      [(e) => !!e.provisional, 'marca la foto provisional solo en un idioma'],
    ],
  });
  const servicios: Servicio[] = pares.map(({ clave, borrador, es, en }) => ({
    id: clave,
    orden: es.orden,
    image: es.imagen,
    ...(es.provisional ? { provisional: true } : {}),
    borrador,
    es: texto(es),
    en: texto(en),
  }));

  const orden = repetido(servicios.map((s) => s.orden));
  if (orden !== undefined) throw new Error(`Dos servicios tienen el orden ${orden}`);

  return servicios.sort((a, b) => a.orden - b.orden).filter((s) => borradores || !s.borrador);
}

export const serviciosBase: Record<Locale, string> = { es: '/servicios/', en: '/en/services/' };

export function servicioPath(s: Servicio, locale: Locale): string {
  return `${serviciosBase[locale]}${s[locale].slug}/`;
}
