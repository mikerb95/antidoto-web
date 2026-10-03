// Emparejado genérico de contenido bilingüe: cada entrada vive en un archivo por idioma y los
// dos idiomas se unen por `clave`. Lo usan servicios, ofertas, casos y artículos.
// Sin imports de Astro en tiempo de ejecución para poder probarlo en tests/contenido.test.ts.
import type { Locale } from '../i18n/ui';

export interface EntradaBase {
  clave: string;
  idioma: Locale;
  slug: string;
  borrador?: boolean;
}

export interface Par<E extends EntradaBase> {
  clave: string;
  /** Borrador si cualquiera de los dos idiomas lo es: nunca se publica un idioma sin su par. */
  borrador: boolean;
  es: E;
  en: E;
}

export interface OpcionesEmparejado<E extends EntradaBase> {
  /** Cómo nombrar una entrada en los errores, p. ej. (c) => `El servicio "${c}"`. */
  nombre: (clave: string) => string;
  /** Incluye los borradores (en desarrollo). */
  borradores: boolean;
  /** Campos que deben coincidir en los dos idiomas: [valor, error si no coinciden]. */
  iguales?: Array<[valor: (e: E) => unknown, error: string]>;
  /** Ámbito en el que el slug no puede repetirse (p. ej. la línea de una oferta). */
  ambitoSlug?: (e: E) => string;
}

/**
 * Une las entradas por clave y, si no se piden, quita los borradores. Conserva el orden de
 * aparición: quien llama ordena. Lanza un error (y el build falla) si falta un idioma, si un
 * idioma se repite, si los idiomas no coinciden en un campo de `iguales` o si un slug se repite
 * en su ámbito. Valida también los borradores: un error no espera a que se publique.
 */
export function emparejarPorClave<E extends EntradaBase>(entradas: E[], opciones: OpcionesEmparejado<E>): Par<E>[] {
  const { nombre, borradores, iguales = [], ambitoSlug = () => '' } = opciones;
  const porClave = new Map<string, Partial<Record<Locale, E>>>();
  for (const e of entradas) {
    const par = porClave.get(e.clave) ?? {};
    if (par[e.idioma]) throw new Error(`${nombre(e.clave)} está repetido en ${e.idioma}`);
    par[e.idioma] = e;
    porClave.set(e.clave, par);
  }

  const pares: Par<E>[] = [];
  for (const [clave, { es, en }] of porClave) {
    if (!es || !en) throw new Error(`${nombre(clave)}: le falta el idioma ${es ? 'en' : 'es'}`);
    for (const [valor, error] of iguales) {
      if (valor(es) !== valor(en)) throw new Error(`${nombre(clave)} ${error}`);
    }
    pares.push({ clave, borrador: !!es.borrador || !!en.borrador, es, en });
  }

  for (const l of ['es', 'en'] as const) {
    const vistos = new Set<string>();
    for (const p of pares) {
      const k = `${ambitoSlug(p[l])}/${p[l].slug}`;
      if (vistos.has(k)) throw new Error(`El slug "${p[l].slug}" se repite en ${l}`);
      vistos.add(k);
    }
  }

  return pares.filter((p) => borradores || !p.borrador);
}

/** Primer valor repetido de una lista, o undefined. */
export function repetido<T>(valores: T[]): T | undefined {
  return valores.find((v, i) => valores.indexOf(v) !== i);
}
