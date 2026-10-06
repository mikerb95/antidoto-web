// De punta a punta contra una D1 local: lead desde el sitio, acceso del equipo con enlace
// mágico, gestión en la bandeja, supresión de datos y el aviso de seguimiento.
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { crearEntorno } from './entorno';
import { manejar } from '../src/index';
import { seguimiento } from '../src/seguimiento';
import { TIEMPO_MINIMO_MS } from '../src/validar';
import { LIMITE_POR_HORA } from '../src/leads';
import consentimiento from '../../src/data/consentimiento.json';

const CONSENTIMIENTO_VERSION = consentimiento.version;
import type { Env } from '../src/env';

const APP = 'https://api.test';
const SITIO = 'https://antidotocolombia.com';

let env: Env;
let cerrar: () => Promise<void>;
let correos: { to: string[]; subject: string; html: string; text: string }[] = [];

beforeAll(async () => {
  ({ env, cerrar } = await crearEntorno());
  env.RESEND_API_KEY = 'prueba';
  env.SAL_IP = 'sal';
  // Solo se interceptan las llamadas a Resend; el resto (miniflare) pasa tal cual.
  const real = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, init) => {
    const url = entrada instanceof Request ? entrada.url : String(entrada);
    if (url.startsWith('https://api.resend.com/')) {
      correos.push(JSON.parse(String(init?.body)));
      return new Response('{"id":"x"}', { status: 200 });
    }
    return real(entrada, init);
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await cerrar();
});
beforeEach(() => {
  correos = [];
});

/** Llama al Worker y espera también el trabajo diferido (correos). */
async function llamar(ruta: string, init: RequestInit & { ip?: string } = {}) {
  const pendientes: Promise<unknown>[] = [];
  const headers = new Headers(init.headers);
  if (init.ip) headers.set('cf-connecting-ip', init.ip);
  const res = await manejar(new Request(`${APP}${ruta}`, { ...init, headers, redirect: 'manual' }), env, (p) => pendientes.push(p));
  await Promise.all(pendientes);
  return res;
}

const lead = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    servicio: 'catering',
    nombre: 'Andrés Ruiz',
    empresa: 'Acme',
    email: 'andres@acme.co',
    telefono: '3001112233',
    fecha: '2026-12',
    personas: 120,
    consentimiento: CONSENTIMIENTO_VERSION,
    locale: 'es',
    pagina: '/contacto/',
    t: TIEMPO_MINIMO_MS + 5000,
    ...extra,
  });

const enviarLead = (cuerpo: string, ip = '203.0.113.1', origen = SITIO) =>
  llamar('/v1/leads', { method: 'POST', body: cuerpo, ip, headers: { origin: origen, 'content-type': 'text/plain;charset=UTF-8' } });

describe('POST /v1/leads', () => {
  test('rechaza orígenes que no son el sitio', async () => {
    const r = await enviarLead(lead(), '203.0.113.9', 'https://otro.com');
    expect(r.status).toBe(403);
  });

  test('responde el preflight con CORS del origen', async () => {
    const r = await llamar('/v1/leads', { method: 'OPTIONS', headers: { origin: 'https://rama.antidoto-web.pages.dev' } });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('https://rama.antidoto-web.pages.dev');
  });

  test('guarda el lead con su consentimiento y avisa a los dos lados', async () => {
    const r = await enviarLead(lead());
    expect(r.status).toBe(201);
    expect(r.headers.get('access-control-allow-origin')).toBe(SITIO);
    const { id } = (await r.json()) as { id: string };

    const fila = await env.DB.prepare('select * from leads where id = ?').bind(id).first<Record<string, unknown>>();
    expect(fila).toMatchObject({ estado: 'nuevo', servicio: 'catering', nombre: 'Andrés Ruiz', personas: 120 });
    expect(fila?.ip_hash).toMatch(/^[0-9a-f]{64}$/);

    const c = await env.DB.prepare('select * from consentimientos where lead_id = ?').bind(id).first<Record<string, unknown>>();
    expect(c).toMatchObject({ version: CONSENTIMIENTO_VERSION, revocado: null });
    expect(String(c?.texto)).toContain('Autorizo a Antídoto');

    expect(correos.map((x) => x.to[0])).toEqual([env.MAIL_EQUIPO, 'andres@acme.co']);
    expect(correos[0]!.subject).toBe('Nuevo lead: Catering corporativo · Andrés Ruiz (Acme)');
  });

  test('a un bot le responde bien pero no guarda nada', async () => {
    const antes = await env.DB.prepare('select count(*) n from leads').first<number>('n');
    const r = await enviarLead(lead({ web: 'x' }), '203.0.113.2');
    expect(r.status).toBe(202);
    expect(await env.DB.prepare('select count(*) n from leads').first<number>('n')).toBe(antes);
    expect(correos).toHaveLength(0);
  });

  test('devuelve los errores de validación', async () => {
    const r = await enviarLead(lead({ email: 'mal', telefono: '' }), '203.0.113.3');
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ ok: false, errores: ['email'] });
  });

  test(`limita a ${LIMITE_POR_HORA} envíos por IP y hora`, async () => {
    for (let i = 0; i < LIMITE_POR_HORA; i++) expect((await enviarLead(lead(), '198.51.100.7')).status).toBe(201);
    expect((await enviarLead(lead(), '198.51.100.7')).status).toBe(429);
    expect((await enviarLead(lead(), '198.51.100.8')).status).toBe(201);
  });

  test('una ráfaga en paralelo no pasa el límite', async () => {
    const r = await Promise.all(Array.from({ length: 12 }, () => enviarLead(lead(), '198.51.100.9')));
    expect(r.filter((x) => x.status === 201)).toHaveLength(LIMITE_POR_HORA);
    expect(r.filter((x) => x.status === 429)).toHaveLength(12 - LIMITE_POR_HORA);
  });
});

describe('bandeja', () => {
  let cookie = '';
  let cookieEquipo = '';
  let leadId = '';
  const post = (ruta: string, init: RequestInit = {}, c = cookie) =>
    llamar(ruta, { method: 'POST', ...init, headers: { origin: APP, cookie: c, ...(init.headers as object) } });

  async function entrarComo(email: string): Promise<string> {
    correos = [];
    await post('/auth/enlace', { body: JSON.stringify({ email }), headers: { 'content-type': 'application/json' } }, '');
    const enlace = correos[0]?.text.match(/https:\/\/\S+/)?.[0];
    expect(enlace).toBeTruthy();
    const t = new URL(enlace!).searchParams.get('t')!;
    const r = await post('/auth/entrar', { body: new URLSearchParams({ t }) }, '');
    expect(r.status).toBe(303);
    const set = r.headers.get('set-cookie')!;
    expect(set).toMatch(/^__Host-antidoto=.+; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    return set.split(';')[0]!;
  }

  beforeAll(async () => {
    const t = Date.now();
    await env.DB.batch([
      env.DB.prepare("insert into usuarios (id, email, nombre, rol, activo, creado) values ('11111111-1111-4111-8111-111111111111', 'dueña@antidoto.co', 'Dueña', 'admin', 1, ?)").bind(t),
      env.DB.prepare("insert into usuarios (id, email, nombre, rol, activo, creado) values ('22222222-2222-4222-8222-222222222222', 'equipo@antidoto.co', 'Equipo', 'comercial', 1, ?)").bind(t),
    ]);
    const r = await enviarLead(lead({ nombre: '=Malicioso', email: 'x@y.co' }), '192.0.2.50');
    leadId = ((await r.json()) as { id: string }).id;
  });

  test('sin sesión no hay datos', async () => {
    expect((await llamar('/admin/api/leads')).status).toBe(401);
    expect((await llamar('/admin/leads.csv')).status).toBe(401);
  });

  test('el enlace no revela si el correo existe', async () => {
    const r = await post('/auth/enlace', { body: JSON.stringify({ email: 'nadie@x.co' }), headers: { 'content-type': 'application/json' } }, '');
    expect(r.status).toBe(200);
    expect(correos).toHaveLength(0);
  });

  test('el enlace entra una sola vez y el GET no lo gasta', async () => {
    await post('/auth/enlace', { body: JSON.stringify({ email: 'DUEÑA@antidoto.co' }), headers: { 'content-type': 'application/json' } }, '');
    const t = new URL(correos[0]!.text.match(/https:\/\/\S+/)![0]).searchParams.get('t')!;
    const pagina = await llamar(`/auth/entrar?t=${encodeURIComponent(t)}`);
    expect(await pagina.text()).toContain('method="post"');
    const r1 = await post('/auth/entrar', { body: new URLSearchParams({ t }) }, '');
    expect(r1.headers.get('location')).toBe('/admin/');
    const r2 = await post('/auth/entrar', { body: new URLSearchParams({ t }) }, '');
    expect(r2.headers.get('location')).toBe(`${APP}/admin/?error=enlace`);
  });

  test('entra y ve la bandeja', async () => {
    cookie = await entrarComo('dueña@antidoto.co');
    cookieEquipo = await entrarComo('equipo@antidoto.co');
    const yo = await llamar('/admin/api/yo', { headers: { cookie } });
    expect(await yo.json()).toMatchObject({ nombre: 'Dueña', rol: 'admin' });
    const lista = (await (await llamar('/admin/api/leads?q=Malicioso', { headers: { cookie } })).json()) as { leads: { id: string; ipHash?: string }[] };
    expect(lista.leads.map((l) => l.id)).toEqual([leadId]);
    expect(lista.leads[0]).not.toHaveProperty('ipHash');
  });

  test('cambiar algo exige el mismo origen', async () => {
    const r = await llamar(`/admin/api/leads/${leadId}`, { method: 'PATCH', body: '{"estado":"contactado"}', headers: { cookie, origin: 'https://otro.com' } });
    expect(r.status).toBe(403);
  });

  test('mover el lead registra la primera respuesta y el historial', async () => {
    const r = await post(`/admin/api/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ estado: 'contactado', notas: 'Llamé', valorEstimado: 4500000 }) });
    const d = (await r.json()) as { lead: Record<string, unknown>; eventos: { tipo: string; detalle: string; autor: string }[] };
    expect(d.lead).toMatchObject({ estado: 'contactado', notas: 'Llamé', valorEstimado: 4500000 });
    expect(d.lead.primeraRespuesta).toEqual(expect.any(Number));
    expect(d.eventos.map((e) => e.tipo).sort()).toEqual(['creado', 'edicion', 'estado', 'nota']);
    expect(d.eventos.find((e) => e.tipo === 'estado')).toMatchObject({ detalle: 'nuevo → contactado', autor: 'dueña@antidoto.co' });

    const perdido = await post(`/admin/api/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ estado: 'perdido', motivoPerdida: 'Presupuesto' }) });
    expect(((await perdido.json()) as { lead: object }).lead).toMatchObject({ motivoPerdida: 'Presupuesto' });
    const reabierto = await post(`/admin/api/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ estado: 'cotizado' }) });
    expect(((await reabierto.json()) as { lead: object }).lead).toMatchObject({ estado: 'cotizado', motivoPerdida: null });
  });

  test('las métricas cuentan el embudo', async () => {
    const m = (await (await llamar('/admin/api/metricas', { headers: { cookie } })).json()) as { total: number; porEstado: Record<string, number>; porServicio: { clave: string }[] };
    expect(m.total).toBeGreaterThan(1);
    expect(m.porEstado.cotizado).toBe(1);
    expect(m.porServicio.map((s) => s.clave)).toContain('catering');
  });

  test('el CSV neutraliza fórmulas', async () => {
    const csv = await (await llamar('/admin/leads.csv', { headers: { cookie } })).text();
    expect(csv).toContain("'=Malicioso");
    expect(csv).not.toMatch(/,=Malicioso/);
  });

  test('solo un admin suprime datos, y la supresión borra lo personal', async () => {
    // La misma persona está suscrita a novedades con el correo del lead.
    const t = Date.now();
    await env.DB.prepare(
      "insert into contactos (id, email, nombre, locale, estado, origen, intereses, token, creado, actualizado) values ('88888888-8888-4888-8888-888888888888', 'x@y.co', 'Malicioso', 'es', 'activo', 'cotizador', '[]', 'tok-lead', ?, ?)",
    ).bind(t, t).run();
    expect((await post(`/admin/api/leads/${leadId}/anonimizar`, {}, cookieEquipo)).status).toBe(403);
    const d = (await (await post(`/admin/api/leads/${leadId}/anonimizar`)).json()) as { lead: Record<string, unknown>; consentimientos: { revocado: number | null }[] };
    expect(d.lead).toMatchObject({ nombre: null, email: null, telefono: null, notas: null, servicio: 'catering', estado: 'cotizado' });
    expect(d.consentimientos[0]!.revocado).toEqual(expect.any(Number));
    const nota = await env.DB.prepare("select detalle from lead_eventos where lead_id = ? and tipo = 'nota'").bind(leadId).first<string>('detalle');
    expect(nota).toBe(null);
    const contacto = await env.DB.prepare("select email, nombre, estado, motivo_baja from contactos where id = '88888888-8888-4888-8888-888888888888'").first();
    expect(contacto).toEqual({ email: 'suprimido+88888888-8888-4888-8888-888888888888@invalid', nombre: null, estado: 'baja', motivo_baja: 'supresion' });
    expect((await post(`/admin/api/leads/${leadId}`, { method: 'PATCH', body: '{"estado":"ganado"}' })).status).toBe(409);
  });

  test('el admin gestiona el equipo y quitar el acceso corta la sesión', async () => {
    expect((await post('/admin/api/usuarios', { body: JSON.stringify({ email: 'x@y.co', nombre: 'X' }) }, cookieEquipo)).status).toBe(403);
    const r = await post('/admin/api/usuarios/22222222-2222-4222-8222-222222222222', { method: 'PATCH', body: '{"activo":false}' });
    expect(r.status).toBe(200);
    expect((await llamar('/admin/api/yo', { headers: { cookie: cookieEquipo } })).status).toBe(401);
  });

  test('salir revoca la sesión', async () => {
    const r = await post('/auth/salir');
    expect(r.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await llamar('/admin/api/yo', { headers: { cookie } })).status).toBe(401);
  });
});

test('seguimiento avisa una sola vez por lead viejo sin respuesta', async () => {
  const hace2dias = Date.now() - 48 * 3_600_000;
  await env.DB.prepare(
    "insert into leads (id, creado, actualizado, estado, servicio, nombre, locale) values ('33333333-3333-4333-8333-333333333333', ?, ?, 'nuevo', 'diseno', 'Viejo', 'es')",
  )
    .bind(hace2dias, hace2dias)
    .run();
  const db = drizzle(env.DB);
  expect(await seguimiento(env, db)).toEqual({ avisados: 1 });
  expect(correos).toHaveLength(1);
  expect(correos[0]!.subject).toBe('1 lead sin respuesta después de 24 h');
  expect(correos[0]!.text).toContain('Viejo');
  correos = [];
  expect(await seguimiento(env, db)).toEqual({ avisados: 0 });
  expect(correos).toHaveLength(0);
});
