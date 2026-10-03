import { describe, expect, it } from 'vitest';
import { emparejar, servicioPath, type EntradaServicio } from '../src/lib/servicios';

const img = (src: string) => ({ src, width: 10, height: 10, format: 'jpg' }) as EntradaServicio['imagen'];

function entrada(clave: string, idioma: 'es' | 'en', extra: Partial<EntradaServicio> = {}): EntradaServicio {
  return {
    clave,
    idioma,
    orden: 1,
    imagen: img(`/${clave}.jpg`),
    slug: `${clave}-${idioma}`,
    title: `${clave} ${idioma}`,
    lead: 'lead',
    facts: [],
    includes: [],
    alt: 'alt',
    ...extra,
  };
}
const par = (clave: string, orden: number, es: Partial<EntradaServicio> = {}, en: Partial<EntradaServicio> = {}) => [
  entrada(clave, 'es', { orden, ...es }),
  entrada(clave, 'en', { orden, ...en }),
];

describe('emparejar', () => {
  it('une los dos idiomas por clave y ordena por orden', () => {
    const s = emparejar([...par('b', 2), ...par('a', 1)], { borradores: false });
    expect(s.map((x) => x.id)).toEqual(['a', 'b']);
    expect(s[0].es.slug).toBe('a-es');
    expect(s[0].en.slug).toBe('a-en');
    expect(servicioPath(s[0], 'en')).toBe('/en/services/a-en/');
  });

  it('quita el servicio entero si cualquiera de sus idiomas es borrador', () => {
    const entradas = [...par('a', 1), ...par('b', 2, {}, { borrador: true }), ...par('c', 3, { borrador: true })];
    expect(emparejar(entradas, { borradores: false }).map((x) => x.id)).toEqual(['a']);
  });

  it('muestra los borradores cuando se piden (desarrollo)', () => {
    const s = emparejar([...par('a', 1), ...par('b', 2, { borrador: true })], { borradores: true });
    expect(s.map((x) => [x.id, x.borrador])).toEqual([['a', false], ['b', true]]);
  });

  it('falla si falta un idioma', () => {
    expect(() => emparejar([entrada('a', 'es')], { borradores: false })).toThrow(/le falta el idioma en/);
  });

  it('falla si un idioma se repite', () => {
    expect(() => emparejar([...par('a', 1), entrada('a', 'es')], { borradores: false })).toThrow(/repetido/);
  });

  it('falla si los idiomas no coinciden en orden, imagen o foto provisional', () => {
    expect(() => emparejar(par('a', 1, {}, { orden: 2 }), { borradores: false })).toThrow(/orden distinto/);
    expect(() => emparejar(par('a', 1, {}, { imagen: img('/otra.jpg') }), { borradores: false })).toThrow(/imagen distinta/);
    expect(() => emparejar(par('a', 1, { provisional: true }), { borradores: false })).toThrow(/provisional/);
  });

  it('falla si se repite un orden o un slug', () => {
    expect(() => emparejar([...par('a', 1), ...par('b', 1)], { borradores: false })).toThrow(/orden 1/);
    expect(() => emparejar([...par('a', 1), ...par('b', 2, { slug: 'a-es' })], { borradores: false })).toThrow(/slug "a-es"/);
  });

  it('valida aunque el servicio con el error sea borrador', () => {
    expect(() => emparejar([...par('a', 1), entrada('b', 'es', { orden: 2, borrador: true })], { borradores: false })).toThrow();
  });
});
