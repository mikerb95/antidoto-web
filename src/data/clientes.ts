// Clientes con logo en el sitio actual (ver marca/clientes.md). Orden: marcas más reconocibles primero.
// Pendiente: confirmar con el cliente la autorización para mostrar cada marca.
import type { ImageMetadata } from 'astro';

const logos = import.meta.glob<{ default: ImageMetadata }>('../assets/clientes/*.png', { eager: true });

const CLIENTES_BASE: Array<[archivo: string, nombre: string]> = [
  ['enel', 'Enel'],
  ['claro', 'Claro'],
  ['stanley-black-decker', 'Stanley Black & Decker'],
  ['seguros-bolivar', 'Seguros Bolívar'],
  ['gallagher', 'Gallagher'],
  ['cruz-verde', 'Cruz Verde'],
  ['howden', 'Howden'],
  ['wsp', 'WSP'],
  ['wom', 'WOM'],
  ['correcol', 'Correcol'],
  ['mab-ingenieria', 'MAB Ingeniería'],
  ['sgin', 'SGIN'],
  ['tabasco-oc', 'Tabasco OC'],
  ['seq-consultores', 'SEQ Consultores'],
  ['hseq-consultores', 'HSEQ Consultores'],
  ['bogota-movil', 'Bogotá Móvil'],
  ['capital-bus', 'Capital Bus'],
  ['la-lorenza', 'La Lorenza'],
];

export const CLIENTES = CLIENTES_BASE.map(([archivo, nombre]) => {
  const mod = logos[`../assets/clientes/${archivo}.png`];
  if (!mod) throw new Error(`Falta el logo de ${nombre}: src/assets/clientes/${archivo}.png`);
  return { nombre, logo: mod.default };
});
