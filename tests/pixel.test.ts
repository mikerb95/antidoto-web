import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PixelBuffer, hex, mix } from '../src/lib/pixel/buffer';
import { STAND, lerpPose } from '../src/lib/pixel/avatar';
import { Timeline, act, wait } from '../src/lib/pixel/actor';
import { Iso } from '../src/lib/pixel/iso';
import { Estudio, PUNTOS } from '../src/lib/pixel/escenas/estudio';
import { posters } from '../scripts/posters.mts';

describe('PixelBuffer', () => {
  it('hex devuelve 0xAABBGGRR, el orden de ImageData en little-endian', () => {
    expect(hex('#112233')).toBe(0xff332211);
    expect(hex('#112233', 0)).toBe(0x00332211);
  });

  it('mix interpola por canal', () => {
    expect(mix(hex('#000000'), hex('#ffffff'), 0.5)).toBe(hex('#808080'));
  });

  it('rect recorta en los bordes sin salirse', () => {
    const b = new PixelBuffer(4, 4);
    b.rect(-2, -2, 4, 4, 1);
    expect([...b.data].filter(Boolean)).toHaveLength(4);
  });
});

describe('Iso', () => {
  it('floorAt deshace la proyección del piso', () => {
    const iso = new Iso(140, 92);
    const p = iso.P(3.25, 1.5);
    const q = iso.floorAt(p.x, p.y);
    expect(q.i).toBeCloseTo(3.25);
    expect(q.j).toBeCloseTo(1.5);
  });
});

describe('Timeline', () => {
  it('corre los pasos en orden y los de duración cero en el mismo cuadro', () => {
    const tl = new Timeline();
    const visto: string[] = [];
    tl.push(act(() => visto.push('a')), wait(0.5), act(() => visto.push('b')), act(() => visto.push('c')));
    tl.update(0.1);
    expect(visto).toEqual(['a']);
    tl.update(0.5);
    expect(visto).toEqual(['a', 'b', 'c']);
    expect(tl.busy).toBe(false);
  });

  it('lerpPose en 0 y 1 devuelve los extremos', () => {
    const b = { ...STAND, lean: 40 };
    expect(lerpPose(STAND, b, 0).lean).toBe(STAND.lean);
    expect(lerpPose(STAND, b, 1).lean).toBe(40);
  });
});

describe('Estudio', () => {
  it('cada punto de parada queda dentro del piso', () => {
    for (const p of Object.values(PUNTOS)) {
      expect(p.i).toBeGreaterThan(0);
      expect(p.i).toBeLessThan(7);
      expect(p.j).toBeGreaterThan(0);
      expect(p.j).toBeLessThan(6);
    }
  });

  it('llega a cada línea y avisa al llegar', () => {
    const e = new Estudio();
    let llego = false;
    e.ir('catering', () => (llego = true));
    for (let k = 0; k < 300 && !llego; k++) e.update(1 / 30);
    expect(llego).toBe(true);
  });

  it('al salir avisa desde dónde saltó y deja de dibujarse', () => {
    let pies: { x: number; y: number } | null = null;
    const e = new Estudio({ salio: (p) => (pies = p) });
    e.salir();
    for (let k = 0; k < 300 && !pies; k++) e.update(1 / 30);
    expect(pies).not.toBeNull();
    expect(e.visible).toBe(false);
  });

  it('el render sale igual en cada corrida', () => {
    const a = new PixelBuffer(300, 240);
    const b = new PixelBuffer(300, 240);
    new Estudio().render(a);
    new Estudio().render(b);
    expect(a.data).toEqual(b.data);
  });
});

describe('PNG quietos', () => {
  it('están al día con el código (si falla: npm run pixel:posters)', () => {
    for (const [archivo, datos] of Object.entries(posters())) {
      const guardado = readFileSync(new URL(`../src/assets/pixel/${archivo}`, import.meta.url));
      expect(guardado.equals(datos), archivo).toBe(true);
    }
  });
});
