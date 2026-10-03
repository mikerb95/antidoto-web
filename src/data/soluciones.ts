// Soluciones por área: las cuatro entradas de "Elige por dónde entras" de la home, cada una con
// su página. Título y descripción salen de ui.inicio.paraQuien.perfiles (misma posición) y los
// retos de ui.inicio.dolores.items, para no duplicar textos. Las ofertas son claves de
// src/content/ofertas/; las que no estén publicadas no se muestran.
import type { Locale } from '../i18n/ui';
import type { Sector } from './clientes';

export interface Solucion {
  clave: string;
  /** Posición en ui.inicio.paraQuien.perfiles. */
  perfil: number;
  slug: Record<Locale, string>;
  /** Posiciones en ui.inicio.dolores.items. */
  retos: number[];
  ofertas: string[];
  /** Sector de clientes que se muestra como prueba, si aplica. */
  sectorClientes?: Sector;
}

export const SOLUCIONES: Solucion[] = [
  {
    clave: 'sst',
    perfil: 0,
    slug: { es: 'sst-y-hseq', en: 'health-and-safety' },
    retos: [0, 2, 3, 1],
    ofertas: ['induccion', 'emergencias', 'capacitaciones', 'equipos'],
    sectorClientes: 'sst',
  },
  {
    clave: 'talento',
    perfil: 1,
    slug: { es: 'talento-humano-y-bienestar', en: 'hr-and-wellbeing' },
    retos: [4, 5, 1],
    ofertas: ['equipos', 'cultura', 'comunicacion', 'desayunos', 'estaciones', 'productos'],
  },
  {
    clave: 'comunicaciones',
    perfil: 2,
    slug: { es: 'comunicaciones-internas', en: 'internal-communications' },
    retos: [5, 0],
    ofertas: ['institucionales', 'dron', 'cultura', 'experiencias'],
  },
  {
    clave: 'educacion',
    perfil: 3,
    slug: { es: 'colegios-y-universidades', en: 'schools-and-universities' },
    retos: [],
    ofertas: ['orientacion-vocacional', 'inclusion', 'almuerzos', 'refrigerios'],
  },
];

export const solucionesBase: Record<Locale, string> = { es: '/soluciones/', en: '/en/solutions/' };

export function solucionPath(s: Solucion, locale: Locale): string {
  return `${solucionesBase[locale]}${s.slug[locale]}/`;
}
