import { describe, expect, it } from 'vitest';
import { grafo, migasSchema, organizationSchema, servicioSchema } from '../src/data/schema';
import type { Servicio } from '../src/lib/servicios';

const texto = (slug: string, title: string) => ({ slug, title, lead: `${title}.`, facts: [], includes: [], alt: '' });
const servicio: Servicio = {
  id: 'audiovisual',
  orden: 2,
  image: { src: '/x.jpg', width: 1, height: 1, format: 'jpg' },
  borrador: false,
  es: texto('produccion-audiovisual', 'Producción audiovisual'),
  en: texto('video-production', 'Video production'),
};

describe('servicioSchema', () => {
  it('describe el servicio en su idioma con URLs absolutas y la organización como proveedor', () => {
    const s = servicioSchema(servicio, 'en', '/_astro/foto.jpg');
    expect(s).toMatchObject({
      '@type': 'Service',
      '@id': 'https://antidotocolombia.com/en/services/video-production/#servicio',
      name: 'Video production',
      description: 'Video production.',
      url: 'https://antidotocolombia.com/en/services/video-production/',
      image: 'https://antidotocolombia.com/_astro/foto.jpg',
      inLanguage: 'en',
      provider: { '@id': 'https://antidotocolombia.com/#org' },
    });
    expect(servicioSchema(servicio, 'es', '/x.jpg').inLanguage).toBe('es-CO');
  });
});

describe('organizationSchema', () => {
  it('describe la organización y su catálogo en el idioma de la página', () => {
    const en = organizationSchema([servicio], 'en');
    expect(en.founder.jobTitle).toBe('CEO and founder');
    expect(en.description).toMatch(/^Creative studio/);
    expect(en.hasOfferCatalog.itemListElement[0].itemOffered).toEqual({
      '@type': 'Service',
      name: 'Video production',
      url: 'https://antidotocolombia.com/en/services/video-production/',
    });
    const es = organizationSchema([servicio], 'es');
    expect(es['@id']).toBe(en['@id']);
    expect(es.hasOfferCatalog.itemListElement[0].itemOffered.url).toBe('https://antidotocolombia.com/servicios/produccion-audiovisual/');
  });
});

describe('migasSchema', () => {
  it('numera los eslabones desde 1 con URLs absolutas', () => {
    const m = migasSchema([
      ['Antídoto', '/'],
      ['Servicios', '/servicios/'],
      ['Producción audiovisual', '/servicios/produccion-audiovisual/'],
    ]);
    expect(m['@type']).toBe('BreadcrumbList');
    expect(m.itemListElement.map((e) => [e.position, e.name, e.item])).toEqual([
      [1, 'Antídoto', 'https://antidotocolombia.com/'],
      [2, 'Servicios', 'https://antidotocolombia.com/servicios/'],
      [3, 'Producción audiovisual', 'https://antidotocolombia.com/servicios/produccion-audiovisual/'],
    ]);
  });
});

describe('grafo', () => {
  it('junta los nodos en un @graph con un solo @context', () => {
    expect(grafo({ '@type': 'A' }, { '@type': 'B' })).toEqual({ '@context': 'https://schema.org', '@graph': [{ '@type': 'A' }, { '@type': 'B' }] });
  });
});
