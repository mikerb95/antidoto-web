import { describe, expect, it } from 'vitest';
import { curva, diagrama, filas, FRASCO, LIENZO } from '../src/lib/motion/retos-geometria';

describe('filas', () => {
  it('centra las filas en la altura del frasco', () => {
    const ys = filas(3);
    expect(ys).toEqual([FRASCO.y - 150, FRASCO.y, FRASCO.y + 150]);
  });

  it('con una sola fila la pone a la altura del frasco', () => {
    expect(filas(1)).toEqual([FRASCO.y]);
  });
});

describe('curva', () => {
  it('sale y llega en horizontal (controles a la altura de cada extremo)', () => {
    expect(curva({ x: 100, y: 50 }, { x: 300, y: 200 })).toBe('M100 50 C200 50 200 200 300 200');
  });
});

describe('diagrama', () => {
  const d = diagrama(3);

  it('tiene una entrada y una salida por par', () => {
    expect(d.entradas).toHaveLength(3);
    expect(d.salidas).toHaveLength(3);
  });

  it('todas las entradas terminan en el frasco y las salidas empiezan en él', () => {
    d.entradas.forEach((p) => expect(p.endsWith(`${FRASCO.entrada} ${FRASCO.y}`)).toBe(true));
    d.salidas.forEach((p) => expect(p.startsWith(`M${FRASCO.salida} ${FRASCO.y}`)).toBe(true));
  });

  it('mantiene los nodos dentro del lienzo, con margen para las etiquetas', () => {
    [...d.retos, ...d.soluciones].forEach(({ x, y }) => {
      expect(x).toBeGreaterThan(100);
      expect(x).toBeLessThan(LIENZO.ancho - 100);
      expect(y).toBeGreaterThan(60);
      expect(y).toBeLessThan(LIENZO.alto - 60);
    });
  });
});
