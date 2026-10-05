// Arte del estudio de Antídoto, el cuarto que se ve desde el hero. Una sala de Habbo clara con
// un guiño a cada línea: la pizarra con pósits (formaciones), la pantalla con un chat (IA), la
// cámara con su luz (audiovisual), la mesa de catering y el estante de prototipos (diseño).
// Todo por código, píxel a píxel.

import { CLEAR, hex, mix, type PixelBuffer } from '../buffer.ts';
import { Iso, type BoxColors } from '../iso.ts';
import { C, darker, drawCuarto } from '../cuarto.ts';

export const W = 300;
export const H = 240;
export const I = 7;
export const J = 6;
export const WALL = 76;
export const iso = new Iso(140, 92);

export const DOOR = { j0: 3.1, j1: 4.3, h: 50 };

/** Muebles que tapan al personaje cuando pasa detrás: se ordenan por profundidad (i + j). */
export const PIEZAS = {
  pizarra: { i0: 0.5, i1: 2.7, z0: 26, z1: 62 },
  pantalla: { i0: 3.5, i1: 5.6, z0: 28, z1: 60 },
  estante: { i: 0, j0: 0.5, j1: 2.4, di: 0.7, h: 54 },
  mesa: { i: 1.5, j: 4.3, di: 2.1, dj: 1.0, h: 17 },
  camara: { i: 6.0, j: 3.4 },
  luz: { i: 6.4, j: 0.7 },
  planta: { i: 0.6, j: 5.4 },
};

const WOOD: BoxColors = { top: C.furnitureLit, front: C.furniture, side: C.furnitureDark, line: darker(C.furnitureDark, 0.5) };
const WHITE: BoxColors = { top: C.paper, front: C.mist, side: C.lineSoft, line: C.dash };

/** Piso y paredes con lo que va colgado: siempre detrás del personaje. */
export function drawFondo(buf: PixelBuffer) {
  drawCuarto(buf, iso, { I, J, wall: WALL, door: DOOR, windows: [5.85] });

  // Tapete cian en el centro, con borde y flecos de puntos.
  const r = { i0: 2.2, i1: 5.3, j0: 1.7, j1: 3.9 };
  iso.quad(buf, [[r.i0, r.j0, 0], [r.i1, r.j0, 0], [r.i1, r.j1, 0], [r.i0, r.j1, 0]], (x, y) => {
    const { i, j } = iso.floorAt(x + 0.5, y + 0.5);
    const m = Math.min(i - r.i0, r.i1 - i, (j - r.j0) * 2, (r.j1 - j) * 2);
    if (m < 0.12) return C.deep;
    if (m < 0.24) return C.paper;
    return (Math.floor(i * 3) + Math.floor(j * 6)) % 7 === 0 ? C.glow : C.antidote;
  });

  // Pizarra en la pared derecha: marco, pósits de colores y trazos de marcador.
  const p = PIEZAS.pizarra;
  const posits: [number, number, number][] = [
    [0.75, 52, 0],
    [1.15, 54, 1],
    [1.55, 51, 2],
    [0.85, 40, 3],
    [1.35, 41, 0],
    [2.2, 50, 1],
  ];
  const colors = [C.yellow, C.antidote, C.reto, C.glow];
  iso.onFront(buf, 0.02, [p.i0, p.i1, p.z0, p.z1], (i, z) => {
    if (i < p.i0 || i > p.i1 || z < p.z0 || z > p.z1) return CLEAR;
    if (i < p.i0 + 0.07 || i > p.i1 - 0.07 || z < p.z0 + 1.5 || z > p.z1 - 1.5) return C.steelDark;
    for (const [pi, pz, ci] of posits) {
      if (i > pi && i < pi + 0.3 && z > pz - 6 && z < pz) return z > pz - 1 ? darker(colors[ci], 0.15) : colors[ci];
    }
    // Trazos de marcador: una flecha y unas líneas de texto.
    if (Math.abs(z - (33 + (i - 1.9) * 6)) < 0.7 && i > 1.9 && i < 2.45) return C.deep;
    if (z > 30 && z < 31.2 && i > 0.75 && i < 1.6) return C.slate;
    if (z > 34 && z < 35.2 && i > 0.75 && i < 1.4) return C.slate;
    return C.paper;
  });
  // Bandeja de marcadores.
  iso.box(buf, p.i0 + 0.3, 0, p.z0 - 3, p.i1 - p.i0 - 0.6, 0.18, 3, { top: C.steelLit, front: C.steel, side: C.steelDark });

  // Pantalla en la pared derecha: el chat de la IA (las burbujas se animan en drawVivo).
  const s = PIEZAS.pantalla;
  iso.onFront(buf, 0.02, [s.i0, s.i1, s.z0, s.z1], (i, z) => {
    if (i < s.i0 || i > s.i1 || z < s.z0 || z > s.z1) return CLEAR;
    if (i < s.i0 + 0.06 || i > s.i1 - 0.06 || z < s.z0 + 1.5 || z > s.z1 - 1.5) return C.ink;
    return z > s.z1 - 6 ? C.deepDark : C.inkRaised;
  });
  // Barra de título con tres puntos.
  for (const [k, c] of [[0, C.reto], [1, C.yellow], [2, C.green]] as const) {
    const q = iso.P(s.i0 + 0.18 + k * 0.12, 0.03, s.z1 - 3.6);
    buf.px(q.x, q.y, c);
    buf.px(q.x + 1, q.y, c);
  }

  // Estante de prototipos contra la pared izquierda.
  const e = PIEZAS.estante;
  iso.box(buf, e.i, e.j0, 0, e.di, e.j1 - e.j0, e.h, WOOD);
  // Hueco del estante: tres repisas con piezas de colores.
  iso.onSide(buf, e.i + e.di + 0.001, [e.j0 + 0.1, e.j1 - 0.1, 3, e.h - 3], (j, z) => {
    if (j < e.j0 + 0.1 || j > e.j1 - 0.1 || z < 3 || z > e.h - 3) return CLEAR;
    if (Math.floor(z) % 17 < 2) return C.furnitureLit;
    return C.furnitureDark;
  });
  const piezas: [number, number, number, number, number][] = [
    // j, z, ancho, alto, color
    [0.8, 4, 0.25, 7, 0],
    [1.3, 4, 0.2, 5, 1],
    [1.8, 4, 0.2, 9, 2],
    [0.85, 21, 0.3, 6, 3],
    [1.45, 21, 0.18, 8, 0],
    [1.9, 21, 0.2, 4, 1],
    [0.95, 38, 0.22, 7, 2],
    [1.55, 38, 0.35, 5, 3],
  ];
  const pc = [C.antidote, C.reto, C.yellow, C.paper];
  for (const [j, z, w, h, ci] of piezas) {
    const c = pc[ci];
    iso.box(buf, e.i + e.di - 0.3, j, z, 0.22, w, h, { top: mix(c, C.paper, 0.35), front: c, side: darker(c, 0.25), line: darker(c, 0.6) });
  }
}

/** Mesa de catering: mantel blanco, bandeja con fruta, tazas y el termo de café. */
export function drawMesa(buf: PixelBuffer) {
  const m = PIEZAS.mesa;
  // Patas.
  for (const [di, dj] of [[0.1, 0.1], [m.di - 0.15, 0.1], [0.1, m.dj - 0.15], [m.di - 0.15, m.dj - 0.15]]) {
    iso.box(buf, m.i + di, m.j + dj, 0, 0.1, 0.1, m.h - 2, { top: C.steelDark, front: C.steel, side: C.steelDark });
  }
  iso.floorShadow(buf, m.i, m.j, m.di, m.dj, C.shadow, 0.18);
  // Mantel que cae por los lados.
  iso.box(buf, m.i, m.j, m.h - 7, m.di, m.dj, 7, WHITE);
  // Bandeja con frutas.
  iso.box(buf, m.i + 0.25, m.j + 0.2, m.h, 0.9, 0.55, 1.5, { top: C.steelLit, front: C.steel, side: C.steelDark });
  const frutas: [number, number, number][] = [
    [0.45, 0.4, 0],
    [0.7, 0.35, 1],
    [0.6, 0.6, 2],
    [0.9, 0.55, 0],
    [0.85, 0.3, 2],
  ];
  const fc = [C.reto, C.yellow, C.green];
  for (const [di, dj, ci] of frutas) {
    const q = iso.P(m.i + di, m.j + dj, m.h + 3.5);
    buf.disc(q.x, q.y, 2.6, darker(fc[ci], 0.4));
    buf.disc(q.x, q.y, 1.8, fc[ci]);
    buf.px(q.x - 1, q.y - 1, mix(fc[ci], C.paper, 0.6));
  }
  // Tazas.
  for (const dj of [0.25, 0.6]) {
    const q = iso.P(m.i + 1.5, m.j + dj, m.h);
    buf.rect(q.x - 2, q.y - 5, 5, 5, C.paper);
    buf.rect(q.x + 2, q.y - 5, 1, 5, C.lineSoft);
    buf.span(q.y - 5, q.x - 2, q.x + 2, hex('#6b4a2e'));
    buf.px(q.x + 3, q.y - 3, C.dash);
    buf.span(q.y, q.x - 2, q.x + 2, C.dash);
  }
  // Termo.
  iso.box(buf, m.i + 1.75, m.j + 0.15, m.h, 0.22, 0.22, 13, { top: C.ink, front: C.deep, side: C.deepDark, line: C.outline });
}

/** Puntos de vapor sobre las tazas, la luz de grabar y el chat que escribe. */
export function drawVivo(buf: PixelBuffer, t: number) {
  const m = PIEZAS.mesa;
  for (const [k, dj] of [[0, 0.25], [1, 0.6]] as const) {
    const q = iso.P(m.i + 1.5, m.j + dj, m.h);
    for (let n = 0; n < 3; n++) {
      const f = (t * 0.7 + n / 3 + k * 0.4) % 1;
      const x = q.x + Math.round(Math.sin((f + n) * 6) * 1.5);
      const y = q.y - 7 - Math.round(f * 9);
      if (f < 0.85) buf.blend(x, y, C.paper, 0.75 - f * 0.6);
    }
  }
  // Chat de la IA: dos burbujas fijas y una tercera que se escribe.
  const s = PIEZAS.pantalla;
  const bubble = (i0: number, i1: number, z: number, c: number) =>
    iso.onFront(buf, 0.03, [i0, i1, z - 4, z], (i, zz) => (i >= i0 && i <= i1 && zz >= z - 4 && zz <= z ? c : CLEAR));
  bubble(s.i0 + 0.2, s.i0 + 1.1, s.z1 - 9, C.lineSoft);
  bubble(s.i1 - 1.25, s.i1 - 0.2, s.z1 - 16, C.antidote);
  const fase = Math.floor(t * 2) % 4;
  if (fase === 3) bubble(s.i0 + 0.2, s.i0 + 1.4, s.z1 - 23, C.lineSoft);
  else {
    bubble(s.i0 + 0.2, s.i0 + 0.75, s.z1 - 23, C.lineSoft);
    for (let k = 0; k <= fase; k++) {
      const q = iso.P(s.i0 + 0.33 + k * 0.13, 0.04, s.z1 - 25);
      buf.px(q.x, q.y, C.slate);
    }
  }
  // Luz de grabar de la cámara: parpadea cada segundo.
  if (Math.floor(t * 1.2) % 2 === 0) {
    const c = camaraCuerpo();
    buf.px(c.x + 3, c.y - 7, C.reto);
    buf.px(c.x + 4, c.y - 7, C.reto);
  }
}

function camaraCuerpo() {
  const c = PIEZAS.camara;
  return iso.P(c.i, c.j, 34);
}

/** Cámara de video sobre trípode, mirando hacia la pizarra. */
export function drawCamara(buf: PixelBuffer) {
  const c = PIEZAS.camara;
  const top = iso.P(c.i, c.j, 30);
  const ink = C.ink;
  iso.floorShadow(buf, c.i - 0.35, c.j - 0.35, 0.7, 0.7, C.shadow, 0.16);
  for (const [di, dj] of [[-0.4, 0], [0.3, -0.3], [0.2, 0.4]]) {
    const f = iso.P(c.i + di, c.j + dj, 0);
    buf.line(top.x, top.y, f.x, f.y, ink);
    buf.line(top.x + 1, top.y, f.x + 1, f.y, C.slate);
  }
  // Cuerpo y lente hacia arriba a la izquierda.
  iso.box(buf, c.i - 0.25, c.j - 0.15, 30, 0.5, 0.3, 9, { top: C.slate, front: C.inkRaised, side: C.ink, line: C.outline });
  iso.box(buf, c.i - 0.55, c.j - 0.1, 32, 0.3, 0.2, 5, { top: C.steelDark, front: C.ink, side: C.ink, line: C.outline });
  const lens = iso.P(c.i - 0.55, c.j, 34.5);
  buf.px(lens.x, lens.y, C.glow);
}

/** Luz de estudio con caja difusora en la esquina del fondo. */
export function drawLuz(buf: PixelBuffer) {
  const l = PIEZAS.luz;
  const base = iso.P(l.i, l.j, 0);
  const top = iso.P(l.i, l.j, 52);
  buf.line(base.x, base.y, top.x, top.y, C.ink);
  for (const [di, dj] of [[-0.25, 0], [0.2, -0.2], [0.15, 0.25]]) {
    const f = iso.P(l.i + di, l.j + dj, 0);
    buf.line(base.x, base.y - 6, f.x, f.y, C.ink);
  }
  iso.box(buf, l.i - 0.35, l.j - 0.1, 50, 0.7, 0.35, 16, { top: C.slate, front: C.paper, side: C.inkRaised, line: C.outline });
}

/** Planta en matera en la esquina de adelante. */
export function drawPlanta(buf: PixelBuffer) {
  const p = PIEZAS.planta;
  iso.box(buf, p.i - 0.25, p.j - 0.25, 0, 0.5, 0.5, 10, { top: C.retoDark, front: C.reto, side: C.retoDark, line: darker(C.retoDark, 0.5) });
  const q = iso.P(p.i, p.j, 10);
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
