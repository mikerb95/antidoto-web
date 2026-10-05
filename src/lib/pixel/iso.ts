// Proyección isométrica 2:1 de las salas (la de Habbo): baldosas de 40x20, i crece hacia abajo
// a la derecha, j hacia abajo a la izquierda y z hacia arriba. Sacada de trilladora-art.ts de la
// plataforma de misiones, con el origen como parámetro: el estudio del hero y la sala ancha de
// la home usan la misma escala con distinto tamaño.

import { CLEAR, mix, type Color, type PixelBuffer } from './buffer.ts';

export interface Pt {
  x: number;
  y: number;
}

export type P3 = [number, number, number];

export interface BoxColors {
  top: Color;
  /** Cara +j (mira abajo a la izquierda, de frente a la luz). */
  front: Color;
  /** Cara +i (mira abajo a la derecha, en sombra). */
  side: Color;
  line?: Color;
}

export class Iso {
  readonly x0: number;
  readonly y0: number;

  constructor(x0: number, y0: number) {
    this.x0 = x0;
    this.y0 = y0;
  }

  P(i: number, j: number, z = 0): Pt {
    return { x: this.x0 + (i - j) * 20, y: this.y0 + (i + j) * 10 - z };
  }

  /** Punto del piso (z = 0) bajo un píxel de pantalla. */
  floorAt(x: number, y: number): { i: number; j: number } {
    const a = (x - this.x0) / 20;
    const b = (y - this.y0) / 10;
    return { i: (a + b) / 2, j: (b - a) / 2 };
  }

  quad(buf: PixelBuffer, pts: P3[], c: Color | ((x: number, y: number) => Color)) {
    buf.poly(
      pts.flatMap(([i, j, z]) => {
        const p = this.P(i, j, z);
        return [p.x, p.y];
      }),
      c,
    );
  }

  edge(buf: PixelBuffer, a: P3, b: P3, c: Color) {
    const pa = this.P(...a);
    const pb = this.P(...b);
    buf.line(pa.x, pa.y, pb.x, pb.y, c);
  }

  box(buf: PixelBuffer, i: number, j: number, z: number, di: number, dj: number, dz: number, c: BoxColors) {
    const i1 = i + di;
    const j1 = j + dj;
    const z1 = z + dz;
    this.quad(buf, [[i1, j, z], [i1, j1, z], [i1, j1, z1], [i1, j, z1]], c.side);
    this.quad(buf, [[i, j1, z], [i1, j1, z], [i1, j1, z1], [i, j1, z1]], c.front);
    this.quad(buf, [[i, j, z1], [i1, j, z1], [i1, j1, z1], [i, j1, z1]], c.top);
    if (c.line) {
      const l = c.line;
      this.edge(buf, [i, j, z1], [i1, j, z1], l);
      this.edge(buf, [i, j, z1], [i, j1, z1], l);
      this.edge(buf, [i1, j, z1], [i1, j, z], l);
      this.edge(buf, [i, j1, z1], [i, j1, z], l);
      this.edge(buf, [i1, j, z], [i1, j1, z], l);
      this.edge(buf, [i, j1, z], [i1, j1, z], l);
      this.edge(buf, [i1, j1, z], [i1, j1, z1], mix(l, c.side, 0.5));
    }
  }

  /** Forma sobre el plano j = constante (cara que mira abajo a la izquierda), en coordenadas (i, z). */
  onFront(buf: PixelBuffer, jp: number, bounds: [number, number, number, number], fn: (i: number, z: number) => Color, outline: Color = CLEAR) {
    const [i0, i1, z0, z1] = bounds;
    const pts = [this.P(i0, jp, z0), this.P(i1, jp, z0), this.P(i0, jp, z1), this.P(i1, jp, z1)];
    buf.implicit(
      Math.min(...pts.map((p) => p.x)),
      Math.min(...pts.map((p) => p.y)),
      Math.max(...pts.map((p) => p.x)),
      Math.max(...pts.map((p) => p.y)),
      (x, y) => {
        const i = jp + (x - this.x0) / 20;
        const z = this.y0 + (i + jp) * 10 - y;
        return fn(i, z);
      },
      outline,
    );
  }

  /** Forma sobre el plano i = constante (cara que mira abajo a la derecha), en coordenadas (j, z). */
  onSide(buf: PixelBuffer, ip: number, bounds: [number, number, number, number], fn: (j: number, z: number) => Color, outline: Color = CLEAR) {
    const [j0, j1, z0, z1] = bounds;
    const pts = [this.P(ip, j0, z0), this.P(ip, j1, z0), this.P(ip, j0, z1), this.P(ip, j1, z1)];
    buf.implicit(
      Math.min(...pts.map((p) => p.x)),
      Math.min(...pts.map((p) => p.y)),
      Math.max(...pts.map((p) => p.x)),
      Math.max(...pts.map((p) => p.y)),
      (x, y) => {
        const j = ip - (x - this.x0) / 20;
        const z = this.y0 + (ip + j) * 10 - y;
        return fn(j, z);
      },
      outline,
    );
  }

  /** Sombra rectangular sobre el piso, mezclada con lo que ya hay. */
  floorShadow(buf: PixelBuffer, i: number, j: number, di: number, dj: number, shadow: Color, alpha = 0.28) {
    this.quad(buf, [[i, j, 0], [i + di, j, 0], [i + di, j + dj, 0], [i, j + dj, 0]], (x, y) => {
      const under = buf.get(x, y);
      return under ? mix(under, shadow, alpha) : CLEAR;
    });
  }
}
