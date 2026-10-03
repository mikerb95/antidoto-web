import { describe, expect, it } from 'vitest';
import { llmsTxt } from '../src/lib/llms';
import type { Servicio } from '../src/lib/servicios';

const texto = (slug: string, title: string) => ({ slug, title, lead: `${title}.`, facts: ['Hecho'], includes: ['Incluye'], alt: '' });
const servicio: Servicio = {
  id: 'audiovisual',
  orden: 2,
  image: { src: '/x.jpg', width: 1, height: 1, format: 'jpg' },
  borrador: false,
  es: texto('produccion-audiovisual', 'Producción audiovisual'),
  en: texto('video-production', 'Video production'),
};

describe('llmsTxt', () => {
  const txt = llmsTxt([servicio], ['Enel', 'Claro']);

  it('sigue el formato de llmstxt.org: h1, resumen en cita y secciones h2', () => {
    expect(txt.startsWith('# Antídoto\n\n> ')).toBe(true);
    expect(txt).toMatch(/^## Servicios$/m);
    expect(txt).toMatch(/^## Optional$/m);
  });

  it('enlaza cada servicio con URL absoluta en los dos idiomas', () => {
    expect(txt).toContain('- [Producción audiovisual](https://antidotocolombia.com/servicios/produccion-audiovisual/): Producción audiovisual.\n  - Hecho.\n  - Incluye: Incluye.');
    expect(txt).toContain('- [Video production](https://antidotocolombia.com/en/services/video-production/)');
  });

  it('nombra los clientes y no usa guiones largos ni semilargos', () => {
    expect(txt).toContain('Enel, Claro.');
    const guiones = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
    expect(guiones.some((g) => txt.includes(g))).toBe(false);
  });
});
