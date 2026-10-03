import { describe, expect, it } from 'vitest';
import { emparejarPorClave, type EntradaBase } from '../src/lib/contenido';
import { emparejarOfertas, ofertaPath, type EntradaOferta } from '../src/lib/ofertas';
import { emparejarPublicaciones, rssXml, casoPath, articuloPath, categoriaPath, type EntradaPublicacion } from '../src/lib/publicaciones';
import type { Servicio } from '../src/lib/servicios';

const base = (clave: string, idioma: 'es' | 'en', extra: Partial<EntradaBase & { n: number }> = {}) => ({ clave, idioma, slug: `${clave}-${idioma}`, n: 1, ...extra });
const nombre = (c: string) => `La entrada "${c}"`;

describe('emparejarPorClave', () => {
  it('une los dos idiomas y conserva el orden de aparición', () => {
    const pares = emparejarPorClave([base('b', 'es'), base('a', 'en'), base('b', 'en'), base('a', 'es')], { nombre, borradores: false });
    expect(pares.map((p) => [p.clave, p.es.slug, p.en.slug])).toEqual([
      ['b', 'b-es', 'b-en'],
      ['a', 'a-es', 'a-en'],
    ]);
  });

  it('marca borrador si cualquiera de los idiomas lo es y lo quita salvo que se pidan', () => {
    const entradas = [base('a', 'es'), base('a', 'en', { borrador: true })];
    expect(emparejarPorClave(entradas, { nombre, borradores: false })).toEqual([]);
    expect(emparejarPorClave(entradas, { nombre, borradores: true })[0].borrador).toBe(true);
  });

  it('falla si falta un idioma, si se repite o si un campo de `iguales` no coincide', () => {
    expect(() => emparejarPorClave([base('a', 'es')], { nombre, borradores: true })).toThrow(/le falta el idioma en/);
    expect(() => emparejarPorClave([base('a', 'es'), base('a', 'es')], { nombre, borradores: true })).toThrow(/repetido en es/);
    expect(() =>
      emparejarPorClave([base('a', 'es', { n: 1 }), base('a', 'en', { n: 2 })], { nombre, borradores: true, iguales: [[(e) => e.n, 'no coincide']] }),
    ).toThrow(/La entrada "a" no coincide/);
  });

  it('exige slugs únicos por idioma dentro de su ámbito', () => {
    const repetidos = [base('a', 'es', { slug: 'x' }), base('a', 'en'), base('b', 'es', { slug: 'x' }), base('b', 'en')];
    expect(() => emparejarPorClave(repetidos, { nombre, borradores: true })).toThrow(/slug "x" se repite en es/);
    expect(emparejarPorClave(repetidos, { nombre, borradores: true, ambitoSlug: (e) => e.clave })).toHaveLength(2);
  });
});

const linea = (id: string, slugEs: string, slugEn: string) =>
  ({ id, orden: 1, image: { src: `/${id}.jpg` }, borrador: false, es: { slug: slugEs }, en: { slug: slugEn } }) as unknown as Servicio;

function oferta(clave: string, idioma: 'es' | 'en', extra: Partial<EntradaOferta> = {}): EntradaOferta {
  return { clave, idioma, linea: 'audiovisual', orden: 1, slug: `${clave}-${idioma}`, title: clave, lead: 'lead', para: [], incluye: [], ...extra };
}
const parOferta = (clave: string, extra: Partial<EntradaOferta> = {}) => [oferta(clave, 'es', extra), oferta(clave, 'en', extra)];

describe('emparejarOfertas', () => {
  const servicios = [linea('formaciones', 'formaciones-vivenciales', 'experiential-training'), linea('audiovisual', 'produccion-audiovisual', 'video-production')];
  const lineasConocidas = ['formaciones', 'audiovisual', 'catering'];

  it('ordena por la posición de la línea y luego por el orden de la oferta', () => {
    const o = emparejarOfertas(
      [...parOferta('dron', { orden: 2 }), ...parOferta('induccion', { orden: 1 }), ...parOferta('equipos', { linea: 'formaciones', orden: 1 })],
      { borradores: false, servicios, lineasConocidas },
    );
    expect(o.map((x) => x.id)).toEqual(['equipos', 'induccion', 'dron']);
    expect(ofertaPath(servicios[1], o[1], 'es')).toBe('/servicios/produccion-audiovisual/induccion-es/');
    expect(ofertaPath(servicios[1], o[1], 'en')).toBe('/en/services/video-production/induccion-en/');
  });

  it('quita las ofertas de una línea que no se publica', () => {
    expect(emparejarOfertas(parOferta('desayunos', { linea: 'catering' }), { borradores: false, servicios, lineasConocidas })).toEqual([]);
  });

  it('falla con una línea que no existe, un orden repetido o un slug repetido en la línea', () => {
    expect(() => emparejarOfertas(parOferta('x', { linea: 'nada' }), { borradores: false, servicios, lineasConocidas })).toThrow(/no existe/);
    expect(() => emparejarOfertas([...parOferta('a'), ...parOferta('b')], { borradores: false, servicios, lineasConocidas })).toThrow(/orden 1/);
    expect(() =>
      emparejarOfertas([...parOferta('a', { slug: 'mismo' }), ...parOferta('b', { slug: 'mismo', orden: 2 })], { borradores: false, servicios, lineasConocidas }),
    ).toThrow(/slug "mismo"/);
    // El mismo slug en líneas distintas sí vale.
    expect(
      emparejarOfertas([...parOferta('a', { slug: 'mismo' }), ...parOferta('b', { slug: 'mismo', linea: 'formaciones' })], { borradores: false, servicios, lineasConocidas }),
    ).toHaveLength(2);
  });
});

function publicacion(clave: string, idioma: 'es' | 'en', fecha: string, extra: Partial<EntradaPublicacion> = {}): EntradaPublicacion {
  return { clave, idioma, slug: `${clave}-${idioma}`, title: clave, lead: 'lead', fecha: new Date(fecha), imagen: { src: '/a.jpg' } as EntradaPublicacion['imagen'], alt: 'alt', ...extra };
}

describe('emparejarPublicaciones', () => {
  it('ordena de la más reciente a la más antigua', () => {
    const p = emparejarPublicaciones(
      [publicacion('vieja', 'es', '2025-01-01'), publicacion('vieja', 'en', '2025-01-01'), publicacion('nueva', 'es', '2026-05-01'), publicacion('nueva', 'en', '2026-05-01')],
      { borradores: false, nombre },
    );
    expect(p.map((x) => x.id)).toEqual(['nueva', 'vieja']);
    expect(casoPath(p[0], 'en')).toBe('/en/work/nueva-en/');
    expect(articuloPath(p[0], 'es')).toBe('/blog/nueva-es/');
  });

  it('falla si la fecha o la imagen cambian entre idiomas', () => {
    expect(() => emparejarPublicaciones([publicacion('a', 'es', '2026-01-01'), publicacion('a', 'en', '2026-01-02')], { borradores: true, nombre })).toThrow(/fecha distinta/);
  });

  it('arma rutas de categoría en cada idioma', () => {
    expect(categoriaPath('sst', 'es')).toBe('/blog/categoria/sst/');
    expect(categoriaPath('sst', 'en')).toBe('/en/blog/category/sst/');
  });
});

describe('rssXml', () => {
  it('escapa los textos y usa URLs absolutas', () => {
    const xml = rssXml([{ titulo: 'SST & video', resumen: '<b>', ruta: '/blog/a/', fecha: new Date('2026-01-01') }], {
      titulo: 'Blog',
      descripcion: 'Ideas',
      ruta: '/blog/',
      idioma: 'es-CO',
    });
    expect(xml).toContain('<title>SST &amp; video</title>');
    expect(xml).toContain('<link>https://antidotocolombia.com/blog/a/</link>');
    expect(xml).toContain('&lt;b&gt;');
  });
});
