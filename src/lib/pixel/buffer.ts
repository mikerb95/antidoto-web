// Motor pixel copiado de la plataforma de misiones (../antidoto, src/components/experience/pixel).
// Si se corrige algo aquí, conviene llevarlo allá.
//
// Lienzo de píxeles propio para el arte de las escenas. Nada de canvas 2D al dibujar:
// el canvas suaviza bordes y el estilo isométrico pide píxeles duros, así que todo se
// rasteriza a mano sobre un Uint32Array y al final se vuelca de una vez.
// Es código puro (sin DOM) para poder renderizar una escena en Node y revisarla en PNG.

/** Color en el orden de bytes de ImageData en little-endian: 0xAABBGGRR. 0 = transparente. */
export type Color = number;

export const CLEAR: Color = 0;

export function hex(value: string, alpha = 255): Color {
  const n = parseInt(value.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** Mezcla dos colores opacos; t = 0 devuelve a, t = 1 devuelve b. */
export function mix(a: Color, b: Color, t: number): Color {
  const ch = (c: Color, s: number) => (c >>> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) & 255;
  return ((255 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)) >>> 0;
}

/** Generador pseudoaleatorio con semilla: la textura del pasto sale igual en cada render. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Shader = (x: number, y: number) => Color;

export class PixelBuffer {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;

  // Sin propiedades en el constructor: Node corre este archivo quitando solo los tipos.
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }

  clear(c: Color = CLEAR) {
    this.data.fill(c);
  }

  get(x: number, y: number): Color {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return CLEAR;
    return this.data[y * this.w + x];
  }

  px(x: number, y: number, c: Color) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }

  /** Pinta con transparencia sobre lo que ya hay (sombras, brillos). */
  blend(x: number, y: number, c: Color, alpha: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    const under = this.data[i];
    if (!under) return;
    this.data[i] = mix(under, c, alpha);
  }

  rect(x: number, y: number, w: number, h: number, c: Color) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w));
    const y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) this.data.fill(c, yy * this.w + x0, yy * this.w + Math.max(x0, x1));
  }

  /** Tramo horizontal inclusivo. */
  span(y: number, x0: number, x1: number, c: Color) {
    y = Math.floor(y);
    if (y < 0 || y >= this.h) return;
    const a = Math.max(0, Math.floor(Math.min(x0, x1)));
    const b = Math.min(this.w - 1, Math.floor(Math.max(x0, x1)));
    if (b < a) return;
    this.data.fill(c, y * this.w + a, y * this.w + b + 1);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /**
   * Línea isométrica limpia: 2 px en horizontal por cada 1 px en vertical, el patrón
   * escalonado de Habbo. Avanza de (x, y) hacia la derecha `len` píxeles.
   */
  isoLine(x: number, y: number, len: number, dir: 1 | -1, c: Color) {
    for (let i = 0; i < len; i++) this.px(x + i, y + dir * Math.floor(i / 2), c);
  }

  /** Relleno de polígono por líneas de barrido, muestreando el centro de cada píxel. */
  poly(pts: number[], c: Color | Shader) {
    const n = pts.length / 2;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      minY = Math.min(minY, pts[i]);
      maxY = Math.max(maxY, pts[i]);
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2];
        const ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2];
        const by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.ceil(xs[k] - 0.5);
        const b = Math.floor(xs[k + 1] - 0.5);
        if (typeof c === "number") this.span(y, a, b, c);
        else
          for (let x = a; x <= b; x++) {
            const col = c(x, y);
            if (col) this.px(x, y, col);
          }
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: Color) {
    this.ellipse(cx, cy, r, r, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color) {
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (dy * dy > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      const a = Math.ceil(cx - half - 0.5);
      const b = Math.floor(cx + half - 0.5);
      this.span(y, a, b, c);
    }
  }

  /** Elipse con transparencia (sombras en el piso). */
  shadow(cx: number, cy: number, rx: number, ry: number, c: Color, alpha: number) {
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (dy * dy > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.ceil(cx - half - 0.5); x <= Math.floor(cx + half - 0.5); x++) this.blend(x, y, c, alpha);
    }
  }

  /**
   * Dibuja una forma implícita: `fn` devuelve el color de cada píxel (0 = fuera). Si se
   * pasa `outline`, bordea la silueta con 1 px, el contorno oscuro de Habbo. Así una
   * forma rotada (la cabeza que se inclina, el torso que se dobla) sale nítida.
   */
  implicit(x0: number, y0: number, x1: number, y1: number, fn: Shader, outline: Color = CLEAR) {
    x0 = Math.floor(x0) - 1;
    y0 = Math.floor(y0) - 1;
    x1 = Math.ceil(x1) + 1;
    y1 = Math.ceil(y1) + 1;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const cells = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells[y * w + x] = fn(x0 + x + 0.5, y0 + y + 0.5);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = cells[y * w + x];
        if (c) {
          this.px(x0 + x, y0 + y, c);
        } else if (outline) {
          const near =
            (x > 0 && cells[y * w + x - 1]) ||
            (x < w - 1 && cells[y * w + x + 1]) ||
            (y > 0 && cells[(y - 1) * w + x]) ||
            (y < h - 1 && cells[(y + 1) * w + x]);
          if (near) this.px(x0 + x, y0 + y, outline);
        }
      }
    }
  }

  /** Segmento grueso con radio variable entre los extremos: brazos, piernas, troncos. */
  capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, c: Color | Shader, outline: Color = CLEAR) {
    const r = Math.max(ra, rb);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    this.implicit(
      Math.min(ax, bx) - r,
      Math.min(ay, by) - r,
      Math.max(ax, bx) + r,
      Math.max(ay, by) + r,
      (x, y) => {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        const px = ax + dx * t - x;
        const py = ay + dy * t - y;
        const rr = ra + (rb - ra) * t;
        if (px * px + py * py > rr * rr) return CLEAR;
        return typeof c === "number" ? c : c(x, y);
      },
      outline,
    );
  }

  /** Copia otro buffer encima, respetando la transparencia. */
  blit(src: PixelBuffer, dx: number, dy: number, flip = false) {
    dx = Math.round(dx);
    dy = Math.round(dy);
    for (let y = 0; y < src.h; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + (flip ? src.w - 1 - x : x)];
        if (!c) continue;
        const tx = x + dx;
        if (tx < 0 || tx >= this.w) continue;
        this.data[ty * this.w + tx] = c;
      }
    }
  }

  /** Contorno exterior de 1 px alrededor de todo lo opaco (para objetos prerenderizados). */
  outline(c: Color) {
    const { w, h, data } = this;
    const copy = data.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (copy[y * w + x]) continue;
        const near =
          (x > 0 && copy[y * w + x - 1]) ||
          (x < w - 1 && copy[y * w + x + 1]) ||
          (y > 0 && copy[(y - 1) * w + x]) ||
          (y < h - 1 && copy[(y + 1) * w + x]);
        if (near) data[y * w + x] = c;
      }
    }
  }
}
