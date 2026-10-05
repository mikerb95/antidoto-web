// Arte de la sala de la actividad, la sección a ancho completo de la home: la sala virtual donde
// un equipo juega un rompehielos con un facilitador de Antídoto. Pantalla grande con las tres
// opciones, tres baldosas de color para votar con los pies, el círculo de quien habla, puffs y
// plantas. Lo importante va en el centro: en celular se ve solo la franja del medio.

import { CLEAR, mix, type Color, type PixelBuffer } from '../buffer.ts';
import { Iso, type BoxColors } from '../iso.ts';
import { C, darker, drawCuarto } from '../cuarto.ts';

export const W = 640;
export const H = 312;
export const I = 16;
export const J = 6;
export const WALL = 70;
export const iso = new Iso(220, 80);

export const DOOR = { j0: 3.4, j1: 4.6, h: 48 };
export const PANTALLA = { i0: 6.0, i1: 10.6, z0: 22, z1: 62 };
/** Centro de cada baldosa de voto (opciones 1, 2 y 3) y su lado en baldosas. */
export const VOTOS = [
  { i: 8.6, j: 4.0 },
  { i: 10.6, j: 4.0 },
  { i: 12.6, j: 4.0 },
];
export const LADO = 1.5;
export const CIRCULO = { i: 4.2, j: 1.6 };
export const COLORES_VOTO: Color[] = [C.antidote, C.yellow, C.reto];

export const PUFFS = [
  { i: 2.2, j: 4.6, c: C.reto },
  { i: 3.5, j: 5.2, c: C.antidote },
  { i: 1.5, j: 3.2, c: C.yellow },
];
export const PLANTAS = [
  { i: 0.7, j: 0.7 },
  { i: 15.2, j: 0.8 },
  { i: 15.3, j: 5.2 },
];

/** Dígitos de 3x5 para la pantalla y las baldosas. */
const DIGITOS: Record<string, string[]> = {
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
};

function digito(buf: PixelBuffer, d: string, x: number, y: number, c: Color, k = 1) {
  const filas = DIGITOS[d];
  for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (filas[r][q] === '1') buf.rect(x + q * k, y + r * k, k, k, c);
}

/** Piso, paredes, ventanas, la pantalla apagada, el círculo y las baldosas de voto. */
export function drawFondo(buf: PixelBuffer) {
  drawCuarto(buf, iso, { I, J, wall: WALL, door: DOOR, windows: [12.2, 13.6] });

  // Círculo de quien habla: una alfombra redonda con borde.
  const c = iso.P(CIRCULO.i, CIRCULO.j);
  buf.ellipse(c.x, c.y, 26, 13, C.deep);
  buf.ellipse(c.x, c.y, 24, 12, C.paper);
  buf.ellipse(c.x, c.y, 21, 10.5, C.glow);
  buf.ellipse(c.x, c.y, 12, 6, mix(C.glow, C.paper, 0.4));

  // Baldosas de voto con su número pintado en el piso.
  VOTOS.forEach((v, n) => {
    const h = LADO / 2;
    const col = COLORES_VOTO[n];
    iso.quad(buf, [[v.i - h, v.j - h, 0], [v.i + h, v.j - h, 0], [v.i + h, v.j + h, 0], [v.i - h, v.j + h, 0]], (x, y) => {
      const { i, j } = iso.floorAt(x + 0.5, y + 0.5);
      const m = Math.min(i - (v.i - h), v.i + h - i, j - (v.j - h), v.j + h - j);
      if (m < 0.08) return darker(col, 0.35);
      if (m < 0.16) return C.paper;
      return col;
    });
    const p = iso.P(v.i, v.j);
    digito(buf, String(n + 1), p.x - 3, p.y - 5, darker(col, 0.6), 2);
  });

  // Pantalla grande en la pared derecha.
  const s = PANTALLA;
  iso.onFront(buf, 0.02, [s.i0, s.i1, s.z0, s.z1], (i, z) => {
    if (i < s.i0 || i > s.i1 || z < s.z0 || z > s.z1) return CLEAR;
    if (i < s.i0 + 0.06 || i > s.i1 - 0.06 || z < s.z0 + 1.5 || z > s.z1 - 1.5) return C.ink;
    return C.inkRaised;
  });
  // Puffs: no tapan a nadie (van atrás a la izquierda), se pintan con el fondo.
  for (const p of PUFFS) drawPuff(buf, p.i, p.j, p.c);
}

/** Lo que muestra la pantalla: las tres opciones y, al revelar, la mentira resaltada. */
export function drawPantalla(buf: PixelBuffer, estado: { encendida: boolean; revela: number | null; t: number }) {
  const s = PANTALLA;
  if (!estado.encendida) return;
  const ancho = (s.i1 - s.i0 - 0.6) / 3;
  for (let n = 0; n < 3; n++) {
    const i0 = s.i0 + 0.3 + n * ancho + 0.08;
    const i1 = i0 + ancho - 0.16;
    const lit = estado.revela === n && Math.floor(estado.t * 4) % 2 === 0;
    const apagada = estado.revela !== null && estado.revela !== n;
    const col = apagada ? mix(COLORES_VOTO[n], C.inkRaised, 0.6) : COLORES_VOTO[n];
    iso.onFront(buf, 0.03, [i0, i1, s.z0 + 6, s.z1 - 8], (i, z) => {
      if (i < i0 || i > i1 || z < s.z0 + 6 || z > s.z1 - 8) return CLEAR;
      if (lit && (i < i0 + 0.06 || i > i1 - 0.06 || z < s.z0 + 7 || z > s.z1 - 9)) return C.paper;
      // Tres renglones de texto falso.
      if ((Math.floor(z) === s.z0 + 13 || Math.floor(z) === s.z0 + 17) && i > i0 + 0.2 && i < i1 - 0.2) return darker(col, 0.3);
      return col;
    });
    const p = iso.P((i0 + i1) / 2, 0.03, s.z1 - 14);
    digito(buf, String(n + 1), p.x - 2, p.y - 4, apagada ? C.inkRaised : C.ink, 1);
  }
}

function drawPuff(buf: PixelBuffer, i: number, j: number, c: Color) {
  const p = iso.P(i, j);
  buf.shadow(p.x, p.y + 1, 12, 5, C.shadow, 0.25);
  buf.ellipse(p.x, p.y - 4, 11, 7, darker(c, 0.5));
  buf.ellipse(p.x, p.y - 4.5, 10, 6.2, c);
  buf.ellipse(p.x - 2, p.y - 7, 5, 2.5, mix(c, C.paper, 0.4));
}

export function drawPlanta(buf: PixelBuffer, i: number, j: number) {
  const pot: BoxColors = { top: C.retoDark, front: C.reto, side: C.retoDark, line: darker(C.retoDark, 0.5) };
  iso.box(buf, i - 0.25, j - 0.25, 0, 0.5, 0.5, 10, pot);
  const q = iso.P(i, j, 10);
  const hojas: [number, number, number][] = [
    [0, -14, 5],
    [-6, -9, 4],
    [6, -10, 4],
    [-3, -19, 3.5],
    [4, -17, 3.5],
  ];
  for (const [dx, dy, r] of hojas) buf.ellipse(q.x + dx, q.y + dy, r + 1, r * 0.7 + 1, C.greenDark);
  for (const [dx, dy, r] of hojas) buf.ellipse(q.x + dx, q.y + dy - 0.5, r, r * 0.7, C.green);
}
