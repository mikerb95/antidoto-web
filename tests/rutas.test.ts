import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGINAS, rutas, ui } from '../src/i18n/ui';
import { paginas } from '../src/i18n/paginas';
import { FAQ, TEMAS_FAQ } from '../src/data/faq';
import { SOLUCIONES, solucionPath } from '../src/data/soluciones';

describe('rutas', () => {
  it('cada página tiene ruta en los dos idiomas, con barra final, y el inglés va bajo /en/', () => {
    for (const p of PAGINAS) {
      expect(rutas[p].es).toMatch(/^\/([a-z0-9-]+\/)*$/);
      expect(rutas[p].en).toMatch(/^\/en\/([a-z0-9-]+\/)*$/);
      expect(rutas[p].es.startsWith('/en/')).toBe(false);
    }
  });

  it('no hay dos páginas con la misma ruta', () => {
    const todas = PAGINAS.flatMap((p) => [rutas[p].es, rutas[p].en]);
    expect(new Set(todas).size).toBe(todas.length);
  });

  it('cada página tiene nombre en la nav y textos de SEO en los dos idiomas', () => {
    for (const l of ['es', 'en'] as const) {
      for (const p of PAGINAS) {
        // La home no lleva nombre en la nav: el logo la enlaza.
        if (p !== 'inicio') expect(ui[l].nav[p], `${l}.nav.${p}`).toBeTruthy();
        expect(ui[l].seo[p]?.[0], `${l}.seo.${p}`).toBeTruthy();
      }
    }
  });
});

describe('textos de páginas', () => {
  const sinGuiones = (v: unknown, ruta: string) => {
    if (typeof v === 'string') expect(v, ruta).not.toMatch(/[–—]/);
    else if (Array.isArray(v)) v.forEach((x, i) => sinGuiones(x, `${ruta}[${i}]`));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => sinGuiones(x, `${ruta}.${k}`));
  };

  it('sin guiones largos ni semilargos', () => {
    sinGuiones(paginas, 'paginas');
    sinGuiones(FAQ, 'FAQ');
  });

  it('los dos idiomas tienen las mismas claves', () => {
    const claves = (o: object, pre = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? claves(v, `${pre}${k}.`) : [`${pre}${k}`]));
    expect(claves(paginas.en).sort()).toEqual(claves(paginas.es).sort());
  });
});

describe('preguntas frecuentes', () => {
  it('claves únicas, tema válido y texto en los dos idiomas', () => {
    expect(new Set(FAQ.map((f) => f.clave)).size).toBe(FAQ.length);
    for (const f of FAQ) {
      expect(TEMAS_FAQ).toContain(f.tema);
      for (const l of ['es', 'en'] as const) for (const x of f[l]) expect(x.trim()).not.toBe('');
      // Una respuesta pendiente lo es en los dos idiomas.
      expect(/^\[.*\]$/.test(f.es[1])).toBe(/^\[.*\]$/.test(f.en[1]));
    }
  });
});

describe('soluciones', () => {
  // Claves de oferta declaradas en los Markdown de src/content/ofertas/<linea>/.
  const dir = join(__dirname, '../src/content/ofertas');
  const claves = new Set(
    readdirSync(dir).flatMap((l) =>
      readdirSync(join(dir, l)).map((f) => readFileSync(join(dir, l, f), 'utf8').match(/^clave:\s*(\S+)/m)?.[1]),
    ),
  );

  it('slugs y claves únicos, y perfiles y retos que existen en la home', () => {
    expect(new Set(SOLUCIONES.map((s) => s.clave)).size).toBe(SOLUCIONES.length);
    for (const l of ['es', 'en'] as const) {
      const rutasSol = SOLUCIONES.map((s) => solucionPath(s, l));
      expect(new Set(rutasSol).size).toBe(rutasSol.length);
      for (const s of SOLUCIONES) {
        expect(ui[l].inicio.paraQuien.perfiles[s.perfil]).toBeDefined();
        for (const r of s.retos) expect(ui[l].inicio.dolores.items[r]).toBeDefined();
      }
    }
  });

  it('cada oferta recomendada existe como Markdown', () => {
    for (const s of SOLUCIONES) for (const o of s.ofertas) expect(claves, `${s.clave} > ${o}`).toContain(o);
  });
});
