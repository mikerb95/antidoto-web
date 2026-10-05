// Cascarón de las salas pixel del sitio: piso con su espesor y dos paredes, flotando sin fondo
// (el lienzo es transparente y deja ver lo que haya detrás en la página). Lo comparten el
// estudio del hero y la sala ancha de la home. Colores de la paleta oficial de global.css.

import { CLEAR, hex, mix, type Color, type PixelBuffer } from './buffer.ts';
import type { Iso } from './iso.ts';

/** Paleta del mundo pixel: tokens de marca más los tonos de material que piden las piezas. */
export const C = {
  ink: hex('#0f181d'),
  inkRaised: hex('#15232a'),
  deep: hex('#0c5c7d'),
  deepDark: hex('#09485f'),
  mid: hex('#1c99ca'),
  antidote: hex('#3bc8f3'),
  glow: hex('#80dcff'),
  paper: hex('#ffffff'),
  mist: hex('#f3f8fa'),
  lineSoft: hex('#e3ebee'),
  dash: hex('#9fb3ba'),
  slate: hex('#4a5a60'),
  reto: hex('#ff7a59'),
  retoDark: hex('#d65a3c'),
  yellow: hex('#ffd23f'),
  yellowDark: hex('#d9a91c'),
  green: hex('#6cc070'),
  greenDark: hex('#3f8f4a'),
  outline: hex('#1b2a31'),
  shadow: hex('#16303b'),
  wallLit: hex('#f6f9fa'),
  wallShade: hex('#dce8ed'),
  wallTop: hex('#ffffff'),
  wallLine: hex('#9fb3ba'),
  wood: hex('#e6d5b8'),
  woodAlt: hex('#ddc9a8'),
  woodLine: hex('#c4ad86'),
  woodSide: hex('#a88e66'),
  woodSideDark: hex('#8a7350'),
  furniture: hex('#c9a77a'),
  furnitureLit: hex('#dcbf95'),
  furnitureDark: hex('#a5835a'),
  steel: hex('#9aa8ae'),
  steelLit: hex('#c7d2d6'),
  steelDark: hex('#66767d'),
};

export interface CuartoOpts {
  /** Baldosas en i (pared derecha) y en j (pared izquierda). */
  I: number;
  J: number;
  /** Alto de las paredes en px. */
  wall: number;
  /** Puerta en la pared izquierda (plano i = 0), en j. */
  door?: { j0: number; j1: number; h: number };
  /** Ventanas altas en la pared derecha (plano j = 0), en i. */
  windows?: number[];
  seed?: number;
}

const THICK = 8;

/** Piso de tablas claras, paredes con zócalo azul profundo, ventanas y puerta. */
export function drawCuarto(buf: PixelBuffer, iso: Iso, o: CuartoOpts) {
  const { I, J, wall } = o;

  // Espesor del piso por los dos lados de adelante.
  iso.quad(buf, [[0, J, 0], [I, J, 0], [I, J, -THICK], [0, J, -THICK]], C.woodSide);
  iso.quad(buf, [[I, 0, 0], [I, J, 0], [I, J, -THICK], [I, 0, -THICK]], C.woodSideDark);
  iso.edge(buf, [0, J, -THICK], [I, J, -THICK], C.outline);
  iso.edge(buf, [I, 0, -THICK], [I, J, -THICK], C.outline);
  iso.edge(buf, [I, J, 0], [I, J, -THICK], C.outline);
  iso.edge(buf, [0, J, 0], [0, J, -THICK], C.outline);
  iso.edge(buf, [I, 0, 0], [I, 0, -THICK], C.outline);

  // Tablas en diagonal (a lo largo de i), con juntas escalonadas.
  iso.quad(buf, [[0, 0, 0], [I, 0, 0], [I, J, 0], [0, J, 0]], (x, y) => {
    const { i, j } = iso.floorAt(x + 0.5, y + 0.5);
    const row = Math.floor(j * 2);
    const fj = j * 2 - row;
    if (fj < 0.09) return C.woodLine;
    const shift = (row % 3) * 0.37;
    const fi = (i + shift) / 1.6 - Math.floor((i + shift) / 1.6);
    if (fi < 0.025) return C.woodLine;
    const n = (Math.imul(Math.floor(x), 73856093) ^ Math.imul(Math.floor(y), 19349663)) >>> 0;
    if (n % 53 === 0) return C.woodAlt;
    return row % 2 === 0 ? C.wood : C.woodAlt;
  });
  iso.edge(buf, [0, J, 0], [I, J, 0], mix(C.woodLine, C.outline, 0.4));
  iso.edge(buf, [I, 0, 0], [I, J, 0], mix(C.woodLine, C.outline, 0.4));

  // Pared derecha (plano j = 0), en sombra, con ventanas altas.
  const windows = o.windows ?? [];
  iso.onFront(buf, 0, [0, I, 0, wall], (i, z) => {
    if (i < 0 || i > I || z < 0 || z > wall) return CLEAR;
    if (z < 9) return z > 7.6 ? C.deepDark : C.deep;
    for (const w0 of windows) {
      if (i > w0 && i < w0 + 1.1 && z > wall - 30 && z < wall - 9) {
        if (i < w0 + 0.08 || i > w0 + 1.02 || z < wall - 28.5 || z > wall - 10.5 || Math.abs(i - w0 - 0.55) < 0.05) return C.slate;
        return z > wall - 15 || (i - w0) * 20 + (wall - 9 - z) < 8 ? C.paper : C.glow;
      }
    }
    return C.wallShade;
  });
  // Pared izquierda (plano i = 0), iluminada, con la puerta.
  const d = o.door;
  iso.onSide(buf, 0, [0, J, 0, wall], (j, z) => {
    if (j < 0 || j > J || z < 0 || z > wall) return CLEAR;
    if (d && j > d.j0 && j < d.j1 && z < d.h) {
      // Puerta abierta: el pasillo en penumbra.
      const k = z / d.h;
      return mix(C.inkRaised, C.slate, k * 0.6);
    }
    if (d && j > d.j0 - 0.1 && j < d.j1 + 0.1 && z < d.h + 2) return C.paper;
    if (z < 9) return z > 7.6 ? C.deepDark : C.deep;
    return C.wallLit;
  });
  if (d) {
    iso.edge(buf, [0, d.j0 - 0.1, 0], [0, d.j0 - 0.1, d.h + 2], C.wallLine);
    iso.edge(buf, [0, d.j1 + 0.1, 0], [0, d.j1 + 0.1, d.h + 2], C.wallLine);
    iso.edge(buf, [0, d.j0 - 0.1, d.h + 2], [0, d.j1 + 0.1, d.h + 2], C.wallLine);
  }
  // Filo de arriba y esquinas.
  iso.edge(buf, [0, 0, wall], [I, 0, wall], C.wallTop);
  iso.edge(buf, [0, 0, wall], [0, J, wall], C.wallTop);
  iso.edge(buf, [0, 0, wall + 1], [I, 0, wall + 1], C.wallLine);
  iso.edge(buf, [0, 0, wall + 1], [0, J, wall + 1], C.wallLine);
  iso.edge(buf, [0, J, 0], [0, J, wall], C.wallLine);
  iso.edge(buf, [I, 0, 0], [I, 0, wall], C.wallLine);
  iso.edge(buf, [0, 0, 0], [0, 0, wall], mix(C.wallShade, C.wallLine, 0.6));
}

/** Contorno oscuro de 1 px de Habbo para objetos: un tono más oscuro que el material. */
export function darker(c: Color, k = 0.45): Color {
  return mix(c, C.outline, k);
}
