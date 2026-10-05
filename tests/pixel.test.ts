import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PixelBuffer, hex, mix } from '../src/lib/pixel/buffer';
import { STAND, lerpPose } from '../src/lib/pixel/avatar';
import { Timeline, act, wait } from '../src/lib/pixel/actor';
import { Iso } from '../src/lib/pixel/iso';
import { Estudio, PUNTOS } from '../src/lib/pixel/escenas/estudio';
import { Sala, RONDAS } from '../src/lib/pixel/escenas/sala';
import { enRuta, scrollFinal, type Ruta } from '../src/lib/pixel/paseo';
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

describe('Sala', () => {
  it('en cada ronda votan los otros cuatro', () => {
    for (const r of RONDAS) expect(r.votos).toHaveLength(4);
  });

  it('sin llegada no hay facilitador ni juego; al llegar corre el guion completo', () => {
    const dichas: string[] = [];
    const s = new Sala({ di: (_q, l) => dichas.push(l) });
    for (let k = 0; k < 90; k++) s.update(1 / 30);
    expect(dichas).toEqual([]);
    s.llegar(true);
    for (let k = 0; k < 30 * 120 && !dichas.includes('cierra'); k++) s.update(1 / 30);
    expect(dichas).toEqual(['abre', 'frases-0', 'vota', 'revela-0', 'frases-1', 'vota', 'revela-1', 'cierra']);
  });

  it('si ya entró por la puerta, el del paseo toma su lugar sin reiniciar el juego', () => {
    const dichas: string[] = [];
    const s = new Sala({ di: (_q, l) => dichas.push(l) });
    s.llegar(false);
    for (let k = 0; k < 30 * 16; k++) s.update(1 / 30);
    const antes = dichas.length;
    s.llegar(true);
    for (let k = 0; k < 30 * 60 && !dichas.includes('cierra'); k++) s.update(1 / 30);
    expect(antes).toBeGreaterThan(0);
    expect(dichas.filter((l) => l === 'abre')).toHaveLength(1);
  });

  it('el punto de llegada del paseo queda dentro del lienzo', () => {
    const p = new Sala().llegada();
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(640);
    expect(p.y).toBeLessThan(312);
  });
});

describe('Ruta del paseo', () => {
  const r: Ruta = {
    desde: { x: 1000, y: 700 },
    hasta: { x: 900, y: 4200 },
    scrollDesde: 0,
    scrollHasta: 3600,
    ancho: 1440,
    escalaDesde: 1.7,
    escalaHasta: 2,
  };

  it('empieza y termina exactamente en los pies de salida y de llegada', () => {
    expect(enRuta(r, 0).pies).toEqual(r.desde);
    expect(enRuta(r, 1).pies).toEqual(r.hasta);
    expect(enRuta(r, 1).scroll).toBe(3600);
    expect(enRuta(r, 1).escala).toBe(2);
  });

  it('salta, abre, baja meciéndose y aterriza, sin salirse de la ventana', () => {
    const fases: string[] = [];
    for (let u = 0; u <= 1; u += 0.01) {
      const p = enRuta(r, u);
      if (fases.at(-1) !== p.fase) fases.push(p.fase);
      expect(p.pies.x).toBeGreaterThanOrEqual(40);
      expect(p.pies.x).toBeLessThanOrEqual(1440 - 40);
      expect(Math.abs(p.angulo)).toBeLessThanOrEqual(9);
    }
    expect(fases).toEqual(['salto', 'abre', 'baja', 'aterriza']);
    expect(enRuta(r, 0).apertura).toBe(0);
    expect(enRuta(r, 0.5).apertura).toBe(1);
    expect(enRuta(r, 1).angulo).toBeCloseTo(0);
  });

  it('en pantalla el personaje no se escapa por arriba ni por abajo', () => {
    for (let u = 0.1; u <= 0.9; u += 0.05) {
      const p = enRuta(r, u);
      const enPantalla = p.pies.y - p.scroll;
      expect(enPantalla).toBeGreaterThan(500);
      expect(enPantalla).toBeLessThan(800);
    }
  });

  it('scrollFinal encuadra la sala', () => {
    // Sala en 5000, lienzo hasta 5900, llegada en 5800, ventana de 900: el lienzo entero a la vista.
    expect(scrollFinal({ llegadaY: 5800, abajo: 5900, arriba: 5000, alto: 900, maximo: 20000 })).toBe(5024);
    expect(scrollFinal({ llegadaY: 500, abajo: 600, arriba: 0, alto: 900, maximo: 10000 })).toBe(0);
    expect(scrollFinal({ llegadaY: 20000, abajo: 20100, arriba: 19000, alto: 900, maximo: 10000 })).toBe(10000);
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
