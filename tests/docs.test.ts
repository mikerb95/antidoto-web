import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REQUISITOS_FUNCIONALES, REQUISITOS_NO_FUNCIONALES } from '../src/data/docs/requisitos';
import { CASOS_DE_USO } from '../src/data/docs/casos-de-uso';
import { HISTORIAS } from '../src/data/docs/historias';
import { ITERACIONES, TARJETAS } from '../src/data/docs/iteraciones';
import { INVESTIGACIONES } from '../src/data/docs/fuentes';
import { PAGINAS_DOCS } from '../src/data/docs/indice';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const requisitos = [...REQUISITOS_FUNCIONALES, ...REQUISITOS_NO_FUNCIONALES];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const repetidos = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe('documentación: identificadores', () => {
  it.each([
    ['requisitos', ids(requisitos)],
    ['casos de uso', ids(CASOS_DE_USO)],
    ['historias', ids(HISTORIAS)],
    ['tarjetas', ids(TARJETAS)],
    ['iteraciones', ids(ITERACIONES)],
    ['investigaciones', ids(INVESTIGACIONES)],
  ])('%s no repiten id', (_, lista) => {
    expect(repetidos(lista)).toEqual([]);
  });
});

describe('documentación: referencias cruzadas', () => {
  const rIds = new Set(ids(requisitos));
  const cIds = new Set(ids(CASOS_DE_USO));
  const hIds = new Set(ids(HISTORIAS));
  const iIds = new Set(ids(ITERACIONES));

  it('los casos de uso apuntan a requisitos que existen', () => {
    for (const c of CASOS_DE_USO) for (const r of c.requisitos) expect(rIds.has(r), `${c.id} -> ${r}`).toBe(true);
  });
  it('las historias apuntan a requisitos, casos e iteraciones que existen', () => {
    for (const h of HISTORIAS) {
      for (const r of h.requisitos) expect(rIds.has(r), `${h.id} -> ${r}`).toBe(true);
      for (const c of h.casos) expect(cIds.has(c), `${h.id} -> ${c}`).toBe(true);
      expect(iIds.has(h.iteracion), `${h.id} -> ${h.iteracion}`).toBe(true);
    }
  });
  it('las tarjetas apuntan a iteraciones e historias que existen', () => {
    for (const t of TARJETAS) {
      expect(iIds.has(t.iteracion), `${t.id} -> ${t.iteracion}`).toBe(true);
      for (const h of t.historias ?? []) expect(hIds.has(h), `${t.id} -> ${h}`).toBe(true);
    }
  });
  it('todo requisito funcional lo cubre algún caso o historia', () => {
    const cubiertos = new Set([...CASOS_DE_USO.flatMap((c) => c.requisitos), ...HISTORIAS.flatMap((h) => h.requisitos)]);
    const sinCubrir = REQUISITOS_FUNCIONALES.filter((r) => !cubiertos.has(r.id)).map((r) => r.id);
    expect(sinCubrir).toEqual([]);
  });
});

describe('documentación: evidencia', () => {
  it('toda ruta de evidencia existe en el repositorio', () => {
    const faltan = requisitos.flatMap((r) => r.evidencia.filter((e) => !existsSync(raiz + e)).map((e) => `${r.id}: ${e}`));
    expect(faltan).toEqual([]);
  });
  it('un requisito implementado tiene evidencia', () => {
    const sin = requisitos.filter((r) => r.estado === 'implementado' && r.evidencia.length === 0).map((r) => r.id);
    expect(sin).toEqual([]);
  });
  it('un requisito parcial explica qué falta', () => {
    const sin = requisitos.filter((r) => r.estado === 'parcial' && !r.nota).map((r) => r.id);
    expect(sin).toEqual([]);
  });
  it('las fuentes internas existen en el repositorio', () => {
    for (const f of INVESTIGACIONES.flatMap((i) => i.fuentes)) {
      if (!/^https?:/.test(f.enlace)) expect(existsSync(raiz + f.enlace), f.enlace).toBe(true);
    }
  });
});

describe('documentación: iteraciones', () => {
  it('los commits por iteración suman el historial reconstruido', () => {
    expect(ITERACIONES.reduce((n, i) => n + i.commits, 0)).toBe(107);
  });
  it('las páginas del índice son rutas /docs/ con barra final', () => {
    for (const p of PAGINAS_DOCS) expect(p.ruta).toMatch(/^\/docs\/[a-z-]+\/$/);
  });
});

describe('documentación: escritura', () => {
  it('no usa guiones largos ni semilargos', () => {
    const todo = JSON.stringify([requisitos, CASOS_DE_USO, HISTORIAS, ITERACIONES, TARJETAS, INVESTIGACIONES, PAGINAS_DOCS]);
    expect(/[—–]/.test(todo)).toBe(false);
  });
});
