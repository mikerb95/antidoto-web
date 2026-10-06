import { describe, test, expect } from 'vitest';
import { validarCambios, mediana, celdaCsv } from '../src/admin';
import { origenPermitido } from '../src/cors';
import { correoLeadEquipo, correoLeadCliente } from '../src/correo';
import { buscarVersion } from '../src/consentimiento';
import type { Lead } from '../src/db/schema';

describe('validarCambios', () => {
  test('acepta estado, notas, valor y motivo', () => {
    expect(validarCambios({ estado: 'perdido', notas: '  llamar  ', valorEstimado: '1500000', motivoPerdida: 'Presupuesto' })).toEqual({
      ok: true,
      cambios: { estado: 'perdido', notas: 'llamar', valorEstimado: 1500000, motivoPerdida: 'Presupuesto' },
    });
  });
  test('vacía con null o texto vacío', () => {
    expect(validarCambios({ notas: '', valorEstimado: null })).toEqual({ ok: true, cambios: { notas: null, valorEstimado: null } });
  });
  test('rechaza estados y valores inválidos', () => {
    expect(validarCambios({ estado: 'archivado', valorEstimado: -1 })).toEqual({ ok: false, errores: ['estado', 'valorEstimado'] });
    expect(validarCambios({})).toEqual({ ok: false, errores: ['vacio'] });
  });
});

test('mediana', () => {
  expect(mediana([])).toBe(null);
  expect(mediana([5, 1, 3])).toBe(3);
  expect(mediana([4, 1, 3, 2])).toBe(2.5);
});

test('celdaCsv neutraliza fórmulas y escapa comillas', () => {
  expect(celdaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  expect(celdaCsv('+57 312')).toBe("'+57 312");
  expect(celdaCsv('Acme, S.A.')).toBe('"Acme, S.A."');
  expect(celdaCsv(null)).toBe('');
  expect(celdaCsv(40)).toBe('40');
});

test('origenPermitido', () => {
  const env = { ORIGENES: 'https://antidotocolombia.com, https://antidoto-web.pages.dev' };
  expect(origenPermitido('https://antidotocolombia.com', env)).toBe(true);
  expect(origenPermitido('https://mi-rama.antidoto-web.pages.dev', env)).toBe(true);
  expect(origenPermitido('https://antidoto-web.pages.dev.evil.com', env)).toBe(false);
  expect(origenPermitido('https://evil-antidoto-web.pages.dev', env)).toBe(false);
  expect(origenPermitido('http://localhost:4321', env)).toBe(false);
  expect(origenPermitido('http://localhost:4321', env, true)).toBe(true);
  expect(origenPermitido(null, env)).toBe(false);
});

describe('correos', () => {
  const lead = {
    id: '00000000-0000-4000-8000-000000000000',
    servicio: 'audiovisual',
    nombre: '<script>alert(1)</script>',
    empresa: 'Acme & Co',
    email: 'a@b.co',
    telefono: '+573001112233',
    locale: 'en',
    creado: Date.now(),
    mensaje: 'Hola',
  } as Lead;

  test('escapan el HTML que viene del formulario', () => {
    const c = correoLeadEquipo(lead, 'https://api.test');
    expect(c.html).not.toContain('<script>');
    expect(c.html).toContain('&lt;script&gt;');
    expect(c.html).toContain('Acme &amp; Co');
    expect(c.html).toContain('https://api.test/admin/solicitudes/00000000-0000-4000-8000-000000000000');
    expect(c.html).toContain('https://wa.me/573001112233');
    expect(c.responderA).toBe('a@b.co');
  });

  test('la confirmación sale en el idioma del lead', () => {
    const c = correoLeadCliente(lead, 'equipo@antidoto.co');
    expect(c.asunto).toBe('We received your request · Antídoto');
    expect(c.texto).toContain('Video production');
    expect(c.texto).toContain('equipo@antidoto.co');
  });

  test('la confirmación no repite texto libre del formulario', () => {
    const c = correoLeadCliente({ ...lead, nombre: 'Gana dinero en spam.example', empresa: 'Visita spam.example', ciudad: 'spam.example' }, 'equipo@antidoto.co');
    expect(c.html).not.toContain('spam.example');
    expect(c.texto).not.toContain('spam.example');
  });
});

test('acepta la versión vigente y las anteriores, nada más', () => {
  const v1 = { version: 'v1', es: 'Texto 1', en: 'Text 1' };
  const bloque = { version: 'v2', es: 'Texto 2', en: 'Text 2', anteriores: [v1] };
  expect(buscarVersion(bloque, 'v2')?.es).toBe('Texto 2');
  expect(buscarVersion(bloque, 'v1')).toBe(v1);
  expect(buscarVersion(bloque, 'v0')).toBe(null);
  expect(buscarVersion(bloque, undefined)).toBe(null);
});
