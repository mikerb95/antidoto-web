import { describe, expect, it } from 'vitest';
import { desplazamiento, piezas, TIRA } from '../src/lib/motion/odometro';

describe('piezas', () => {
  it('separa signos fijos de dígitos', () => {
    expect(piezas('+150')).toEqual([
      { tipo: 'fijo', texto: '+' },
      { tipo: 'digito', valor: 1 },
      { tipo: 'digito', valor: 5 },
      { tipo: 'digito', valor: 0 },
    ]);
  });

  it('acepta el formato en inglés con el signo al final', () => {
    expect(piezas('150+').at(-1)).toEqual({ tipo: 'fijo', texto: '+' });
  });

  it('reconstruye el texto original', () => {
    for (const t of ['+150', '2020', '3', '50+']) {
      const texto = piezas(t)
        .map((p) => (p.tipo === 'digito' ? String(p.valor) : p.texto))
        .join('');
      expect(texto).toBe(t);
    }
  });
});

describe('desplazamiento', () => {
  it('aterriza en la segunda vuelta de la tira', () => {
    for (let d = 0; d <= 9; d++) {
      const celda = Math.round((-desplazamiento(d) / 100) * TIRA.length);
      expect(celda).toBe(10 + d);
      expect(TIRA[celda]).toBe(String(d));
    }
  });

  it('rechaza valores que no son un dígito', () => {
    expect(() => desplazamiento(10)).toThrow(RangeError);
    expect(() => desplazamiento(-1)).toThrow(RangeError);
    expect(() => desplazamiento(1.5)).toThrow(RangeError);
  });
});
