import { describe, it, expect } from 'vitest';
import { convertir, clavesReemplazadas, rutaMedio, type EntradaApi } from '../src/lib/cms/convertir';

const IMG = '00000000-0000-4000-8000-0000000000aa';
const medios = { [IMG]: { url: 'https://api.test/v1/medios/x', mime: 'image/webp', ancho: 1200, alto: 800 } };
const base = (datos: Record<string, unknown>, textos: EntradaApi['textos'] = {}): EntradaApi => ({ clave: 'una', datos, textos, version: 3, publicadaEn: 1 });

describe('contenido del panel para las colecciones', () => {
  it('un artículo da una entrada por idioma con la imagen relativa', () => {
    const r = convertir(
      'blog',
      base(
        { fecha: '2026-10-01', categoria: 'formacion', lineas: ['formaciones'], autor: 'Equipo', imagen: IMG },
        { es: { title: 'Hola', slug: 'hola', lead: 'L', alt: 'A', cuerpo: '## Uno' }, en: { title: 'Hi', slug: 'hi', lead: 'L', alt: 'A', cuerpo: '## One' } },
      ),
      medios,
    );
    expect(r.map((x) => x.id)).toEqual(['una.es', 'una.en']);
    expect(r[0]).toMatchObject({ body: '## Uno', data: { clave: 'una', idioma: 'es', borrador: false, slug: 'hola', imagen: `../medios/${IMG}.webp`, categoria: 'formacion' } });
    expect(rutaMedio(IMG, medios[IMG]!)).toBe(`../medios/${IMG}.webp`);
  });

  it('una imagen que la API no devolvió detiene la conversión', () => {
    expect(() => convertir('caso', base({ imagen: 'otro' }, { es: {}, en: {} }), medios)).toThrow(/imagen/);
  });

  it('preguntas y clientes son una sola entrada; los clientes del panel van a color', () => {
    const f = convertir('faq', base({ tema: 'general', destacada: true, orden: 2 }, { es: { pregunta: 'P', respuesta: 'R' }, en: { pregunta: 'Q', respuesta: 'A' } }), medios);
    expect(f).toEqual([{ id: 'una', data: { clave: 'una', tema: 'general', destacada: true, orden: 2, es: ['P', 'R'], en: ['Q', 'A'] } }]);
    const c = convertir('cliente', base({ nombre: 'Acme', sector: 'otros', logo: IMG }), medios);
    expect(c[0]!.data).toMatchObject({ nombre: 'Acme', color: true, logo: `../medios/${IMG}.webp` });
  });

  it('una vacante cerrada no sale', () => {
    const v = (cierre: string) => convertir('vacante', base({ modalidad: 'remota', vinculo: 'completo', cierre }, { es: { title: 'T', slug: 't', lead: 'L', cuerpo: 'C' }, en: { title: 'T', slug: 't', lead: 'L', cuerpo: 'C' } }), medios, '2026-10-06');
    expect(v('2026-10-05')).toEqual([]);
    expect(v('2026-10-06')).toHaveLength(2);
  });

  it('una entrada del panel reemplaza a la local con la misma clave', () => {
    expect([...clavesReemplazadas([{ data: { clave: 'a' } }, { data: { clave: 'b' } }], [base({}), { ...base({}), clave: 'b' }])]).toEqual(['b']);
  });
});
