import { describe, test, expect } from 'vitest';
import { validarLead, normalizarTelefono, TIEMPO_MINIMO_MS } from '../src/validar';
import consentimiento from '../../src/data/consentimiento.json';

const CONSENTIMIENTO_VERSION = consentimiento.version;

const base = {
  servicio: 'formaciones',
  nombre: 'Laura Gómez',
  email: 'Laura@Empresa.co',
  consentimiento: CONSENTIMIENTO_VERSION,
  locale: 'es',
  t: TIEMPO_MINIMO_MS + 1000,
};

describe('validarLead', () => {
  test('acepta un lead completo y lo normaliza', () => {
    const r = validarLead({
      ...base,
      telefono: '+57 312 556 8016',
      fecha: '2026-11',
      personas: '40',
      pagina: '/contacto/',
      referente: 'https://www.google.com/search?q=antidoto',
      utm: { source: 'instagram', medium: 'bio' },
      empresa: '  Acme  ',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead).toMatchObject({
      email: 'laura@empresa.co',
      telefono: '+573125568016',
      personas: 40,
      empresa: 'Acme',
      referente: 'www.google.com',
      utmSource: 'instagram',
      utmMedium: 'bio',
      pagina: '/contacto/',
    });
  });

  test('la trampa llena o un envío demasiado rápido cuentan como bot', () => {
    expect(validarLead({ ...base, web: 'http://spam' })).toEqual({ ok: false, bot: true });
    expect(validarLead({ ...base, t: 300 })).toEqual({ ok: false, bot: true });
    expect(validarLead({ ...base, t: undefined })).toEqual({ ok: false, bot: true });
  });

  test('exige consentimiento vigente, nombre y algún contacto', () => {
    const r = validarLead({ ...base, consentimiento: 'vieja', nombre: 'L', email: '' });
    expect(r).toEqual({ ok: false, bot: false, errores: ['nombre', 'contacto', 'consentimiento'] });
  });

  test('rechaza datos mal formados en vez de guardarlos a medias', () => {
    const r = validarLead({ ...base, servicio: 'otro', email: 'no-es-correo', telefono: '12', fecha: '2026-13', personas: 0 });
    expect(r.ok).toBe(false);
    if (r.ok || r.bot) return;
    expect(r.errores).toEqual(['servicio', 'email', 'telefono', 'fecha', 'personas']);
  });

  test('la página no guarda query y el texto no guarda caracteres de control', () => {
    const r = validarLead({ ...base, pagina: '/contacto/?email=x@y.co', ciudad: 'Cali\u0000\u0007' });
    expect(r.ok && r.lead.pagina).toBe(null);
    expect(r.ok && r.lead.ciudad).toBe('Cali');
  });

  test('basta con el teléfono', () => {
    expect(validarLead({ ...base, email: undefined, telefono: '3125568016' }).ok).toBe(true);
  });
});

test('normalizarTelefono', () => {
  expect(normalizarTelefono('(601) 555 1234')).toBe('6015551234');
  expect(normalizarTelefono('+1 415 555 0000')).toBe('+14155550000');
  expect(normalizarTelefono('123')).toBe(null);
  expect(normalizarTelefono('1234567890123456')).toBe(null);
});
