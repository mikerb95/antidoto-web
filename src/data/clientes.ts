// Clientes con logo en el sitio actual (ver marca/clientes.md). Orden: marcas más reconocibles primero.
// Pendiente: confirmar con el cliente la autorización para mostrar cada marca.
import type { ImageMetadata } from 'astro';

const logos = import.meta.glob<{ default: ImageMetadata }>('../assets/clientes/*.png', { eager: true });

/** Sectores de marca/clientes.md, agrupados para el filtro de la home. */
export const SECTORES = ['ingenieria', 'sst', 'seguros', 'transporte', 'otros'] as const;
export type Sector = (typeof SECTORES)[number];

/** Clientes locales. También los publica el panel: obtenerClientes() (src/data/contenido.ts) une los dos. */
export const CLIENTES_LOCALES: Array<[archivo: string, nombre: string, sector: Sector]> = [
  ['enel', 'Enel', 'ingenieria'],
  ['claro', 'Claro', 'otros'],
  ['stanley-black-decker', 'Stanley Black & Decker', 'otros'],
  ['seguros-bolivar', 'Seguros Bolívar', 'seguros'],
  ['gallagher', 'Gallagher', 'seguros'],
  ['cruz-verde', 'Cruz Verde', 'otros'],
  ['howden', 'Howden', 'otros'],
  ['wsp', 'WSP', 'ingenieria'],
  ['wom', 'WOM', 'otros'],
  ['correcol', 'Correcol', 'seguros'],
  ['mab-ingenieria', 'MAB Ingeniería', 'ingenieria'],
  ['sgin', 'SGIN', 'ingenieria'],
  ['tabasco-oc', 'Tabasco OC', 'ingenieria'],
  ['seq-consultores', 'SEQ Consultores', 'sst'],
  ['hseq-consultores', 'HSEQ Consultores', 'sst'],
  ['bogota-movil', 'Bogotá Móvil', 'transporte'],
  ['capital-bus', 'Capital Bus', 'transporte'],
  ['la-lorenza', 'La Lorenza', 'otros'],
];

export const CLIENTES = CLIENTES_LOCALES.map(([archivo, nombre, sector]) => {
  const mod = logos[`../assets/clientes/${archivo}.png`];
  if (!mod) throw new Error(`Falta el logo de ${nombre}: src/assets/clientes/${archivo}.png`);
  return { nombre, sector, logo: mod.default };
});

export function contarPorSector(sector: Sector): number {
  return CLIENTES.filter((c) => c.sector === sector).length;
}
