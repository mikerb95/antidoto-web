// Email marketing de punta a punta contra una D1 local: suscripción con doble confirmación,
// campañas con audiencia, envío por lotes, webhook firmado de Resend y baja de un clic.
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { crearEntorno } from './entorno';
import trabajador, { manejar } from '../src/index';
import { procesarEnvios, POR_LOTE } from '../src/marketing/envios';
import { convertir, renderizar, personalizar } from '../src/marketing/render';
import { firmaValida } from '../src/marketing/webhook';
import { TIEMPO_MINIMO_MS } from '../src/validar';
import consentimiento from '../../src/data/consentimiento.json';
import type { Env } from '../src/env';

const APP = 'https://api.test';
const SITIO = 'https://antidotocolombia.com';
const NOVEDADES = consentimiento.marketing.version;
const SECRETO_WEBHOOK = 'whsec_' + btoa('clave-de-prueba-del-webhook-1234');

let env: Env;
let cerrar: () => Promise<void>;
type Correo = { to: string[]; subject: string; html: string; text: string; headers?: Record<string, string> };
let correos: Correo[] = [];
let lotes: Correo[][] = [];
/** Respuestas forzadas para las próximas llamadas a /emails/batch (status). */
let fallasLote: number[] = [];

beforeAll(async () => {
  ({ env, cerrar } = await crearEntorno());
  env.RESEND_API_KEY = 'prueba';
  env.SAL_IP = 'sal';
  env.RESEND_WEBHOOK_SECRET = SECRETO_WEBHOOK;
  const real = globalThis.fetch;
  let n = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, init) => {
    const url = entrada instanceof Request ? entrada.url : String(entrada);
    if (url === 'https://api.resend.com/emails/batch') {
      const falla = fallasLote.shift();
      if (falla) return new Response('{"message":"falla"}', { status: falla });
      const cuerpo = JSON.parse(String(init?.body)) as Correo[];
      lotes.push(cuerpo);
      return new Response(JSON.stringify({ data: cuerpo.map(() => ({ id: `re_${++n}` })) }), { status: 200 });
    }
    if (url === 'https://api.resend.com/emails') {
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
  lotes = [];
  fallasLote = [];
});

async function llamar(ruta: string, init: RequestInit & { ip?: string } = {}) {
  const pendientes: Promise<unknown>[] = [];
  const headers = new Headers(init.headers);
  if (init.ip) headers.set('cf-connecting-ip', init.ip);
  const res = await manejar(new Request(`${APP}${ruta}`, { ...init, headers, redirect: 'manual' }), env, (p) => pendientes.push(p));
  await Promise.all(pendientes);
  return res;
}

const suscribirse = (email: string, extra: Record<string, unknown> = {}, ip = '203.0.113.20') =>
  llamar('/v1/suscripciones', {
    method: 'POST',
    ip,
    headers: { origin: SITIO, 'content-type': 'text/plain' },
    body: JSON.stringify({ email, consentimiento: NOVEDADES, locale: 'es', t: TIEMPO_MINIMO_MS + 1000, ...extra }),
  });

const tokenDe = (texto: string, accion: 'confirmar' | 'baja') =>
  new URL(texto.match(new RegExp(`https://\\S+/v1/suscripcion/${accion}\\?\\S+`))![0]).searchParams.get('t')!;

const contacto = (email: string) => env.DB.prepare('select * from contactos where email = ?').bind(email).first<Record<string, unknown>>();

describe('render', () => {
  test('convierte el formato simple y escapa todo lo demás', () => {
    const { html, texto } = convertir(
      '# Hola **equipo**\n\n<script>alert(1)</script>\n\n- uno\n- [dos](https://antidotocolombia.com)\n\n[[Cotizar|https://antidotocolombia.com/contacto/]]\n\n[malo](javascript:alert(1))\n\n![Foto](https://x.co/a.jpg)',
    );
    expect(html).toContain('<strong>equipo</strong>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<li style="margin:4px 0"><a href="https://antidotocolombia.com"');
    expect(html).toContain('href="https://antidotocolombia.com/contacto/"');
    expect(html).not.toContain('javascript:alert(1)"');
    expect(html).toContain('<img src="https://x.co/a.jpg" alt="Foto"');
    expect(texto).toContain('Cotizar: https://antidotocolombia.com/contacto/');
  });

  test('personaliza el nombre con respaldo neutro', () => {
    expect(personalizar('Hola {{nombre}}', { nombre: 'Laura Gómez' }, 'es')).toBe('Hola Laura');
    expect(personalizar('Hi {{ nombre }}', {}, 'en')).toBe('Hi there');
  });

  test('todo correo lleva el motivo y el enlace de baja', () => {
    const r = renderizar({ asunto: 'Novedad', preheader: 'Corto', cuerpo: 'Texto', locale: 'es' }, {}, 'https://api.test/v1/suscripcion/baja?t=abc');
    expect(r.html).toContain('Recibes este correo porque te suscribiste');
    expect(r.html).toContain('href="https://api.test/v1/suscripcion/baja?t=abc"');
    expect(r.texto).toContain('Darte de baja: https://api.test/v1/suscripcion/baja?t=abc');
  });
});

describe('suscripción', () => {
  test('pide confirmación y solo confirma con el POST del botón', async () => {
    expect((await suscribirse('ana@demo.co', { nombre: 'Ana' })).status).toBe(202);
    expect(await contacto('ana@demo.co')).toMatchObject({ estado: 'pendiente', origen: 'pie', nombre: 'Ana' });
    expect(correos).toHaveLength(1);
    expect(correos[0]!.subject).toBe('Confirma tu suscripción · Antídoto');

    const t = tokenDe(correos[0]!.text, 'confirmar');
    // El GET (que también hacen los filtros de correo) solo lleva al botón del sitio.
    const pagina = await llamar(`/v1/suscripcion/confirmar?t=${t}`);
    expect(pagina.status).toBe(302);
    expect(pagina.headers.get('location')).toBe(`${SITIO}/novedades/preferencias/?accion=confirmar&t=${encodeURIComponent(t)}`);
    expect((await contacto('ana@demo.co'))?.estado).toBe('pendiente');

    const r = await llamar(`/v1/suscripcion/confirmar?t=${t}`, { method: 'POST' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`${SITIO}/novedades/preferencias/?estado=confirmado`);
    const c = await contacto('ana@demo.co');
    expect(c).toMatchObject({ estado: 'activo' });
    // Al confirmar llega la bienvenida, del remitente de novedades y con baja de un clic.
    const bienvenida = correos.at(-1)!;
    expect(bienvenida.subject).toBe('Bienvenida a las novedades de Antídoto');
    expect(bienvenida.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(bienvenida.html).toContain(`${SITIO}/servicios/`);
    expect(c?.bienvenida).toEqual(expect.any(Number));
    const cons = await env.DB.prepare('select * from contacto_consentimientos where contacto_id = ?').bind(c!.id).first<Record<string, unknown>>();
    expect(cons).toMatchObject({ version: NOVEDADES, revocado: null });
    expect(cons?.confirmado).toEqual(expect.any(Number));
  });

  test('a un contacto activo no le reenvía nada (no revela que existe)', async () => {
    expect((await suscribirse('ana@demo.co')).status).toBe(202);
    expect(correos).toHaveLength(0);
  });

  test('quien se dio de baja no se reactiva con el enlace viejo; al volver recibe uno nuevo', async () => {
    const viejo = (await contacto('ana@demo.co'))!.token as string;
    await llamar(`/v1/suscripcion/baja?t=${viejo}`, { method: 'POST' });
    expect((await contacto('ana@demo.co'))?.estado).toBe('baja');

    const r = await llamar(`/v1/suscripcion/confirmar?t=${viejo}`, { method: 'POST' });
    expect(r.headers.get('location')).toContain('estado=invalido');
    expect((await contacto('ana@demo.co'))?.estado).toBe('baja');

    await suscribirse('ana@demo.co', {}, '203.0.113.23');
    const nuevo = tokenDe(correos[0]!.text, 'confirmar');
    expect(nuevo).not.toBe(viejo);
    expect((await llamar(`/v1/suscripcion/confirmar?t=${viejo}`, { method: 'POST' })).headers.get('location')).toContain('estado=invalido');
    await llamar(`/v1/suscripcion/confirmar?t=${nuevo}`, { method: 'POST' });
    expect((await contacto('ana@demo.co'))?.estado).toBe('activo');
  });

  test('a quien se quejó por spam no se le vuelve a escribir', async () => {
    const t = Date.now();
    await env.DB.prepare(
      "insert into contactos (id, email, locale, estado, origen, intereses, token, creado, actualizado, baja, motivo_baja) values ('77777777-7777-4777-8777-777777777777', 'queja@demo.co', 'es', 'baja', 'pie', '[]', 'tok-queja', ?, ?, ?, 'queja')",
    ).bind(t, t, t).run();
    expect((await suscribirse('queja@demo.co', {}, '203.0.113.24')).status).toBe(202);
    expect(correos).toHaveLength(0);
    expect(await contacto('queja@demo.co')).toMatchObject({ estado: 'baja', token: 'tok-queja' });
  });

  test('la confirmación no repite el nombre que llegó del formulario público', async () => {
    await suscribirse('nombre@demo.co', { nombre: 'Gana dinero en spam.example' }, '203.0.113.25');
    expect(correos).toHaveLength(1);
    expect(correos[0]!.html).not.toContain('spam.example');
    expect(correos[0]!.text).not.toContain('spam.example');
  });

  test('bots y autorizaciones viejas no suscriben', async () => {
    await suscribirse('bot@demo.co', { web: 'x' });
    await suscribirse('rapido@demo.co', { t: 100 });
    expect(await contacto('bot@demo.co')).toBe(null);
    expect(await contacto('rapido@demo.co')).toBe(null);
    expect((await suscribirse('viejo@demo.co', { consentimiento: 'v0' })).status).toBe(422);
  });

  test('el cotizador suscribe aparte cuando marcan novedades', async () => {
    const r = await llamar('/v1/leads', {
      method: 'POST',
      ip: '203.0.113.21',
      headers: { origin: SITIO, 'content-type': 'text/plain' },
      body: JSON.stringify({
        servicio: 'audiovisual',
        nombre: 'Beto',
        email: 'beto@demo.co',
        consentimiento: consentimiento.version,
        novedades: NOVEDADES,
        locale: 'es',
        t: TIEMPO_MINIMO_MS + 1000,
      }),
    });
    expect(r.status).toBe(201);
    expect(await contacto('beto@demo.co')).toMatchObject({ estado: 'pendiente', origen: 'cotizador', intereses: '["audiovisual"]' });
    expect(correos.map((c) => c.subject)).toContain('Confirma tu suscripción · Antídoto');
  });

  test('sin la casilla de novedades el lead no crea contacto', async () => {
    await llamar('/v1/leads', {
      method: 'POST',
      ip: '203.0.113.22',
      headers: { origin: SITIO, 'content-type': 'text/plain' },
      body: JSON.stringify({ servicio: 'catering', nombre: 'Caro', email: 'caro@demo.co', consentimiento: consentimiento.version, locale: 'es', t: TIEMPO_MINIMO_MS + 1000 }),
    });
    expect(await contacto('caro@demo.co')).toBe(null);
  });
});

describe('campañas', () => {
  let cookie = '';
  const admin = (ruta: string, init: RequestInit = {}) =>
    llamar(ruta, { ...init, headers: { origin: APP, cookie, 'content-type': 'application/json', ...(init.headers as object) } });

  beforeAll(async () => {
    const t = Date.now();
    await env.DB.prepare("insert into usuarios (id, email, nombre, rol, activo, creado) values ('44444444-4444-4444-8444-444444444444', 'mk@antidoto.co', 'Mercadeo', 'admin', 1, ?)").bind(t).run();
    correos = [];
    await llamar('/auth/enlace', { method: 'POST', headers: { origin: APP, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'mk@antidoto.co' }) });
    const tk = new URL(correos[0]!.text.match(/https:\/\/\S+/)![0]).searchParams.get('t')!;
    const r = await llamar('/auth/entrar', { method: 'POST', headers: { origin: APP }, body: new URLSearchParams({ t: tk }) });
    cookie = r.headers.get('set-cookie')!.split(';')[0]!;

    // Audiencia: 3 activos en español (2 con interés en catering), 1 en inglés, 1 pendiente y 1 de baja.
    const filas: [string, string, string, string][] = [
      ['c1@demo.co', 'es', 'activo', '["catering"]'],
      ['c2@demo.co', 'es', 'activo', '["catering","diseno"]'],
      ['c3@demo.co', 'es', 'activo', '["formaciones"]'],
      ['c4@demo.co', 'en', 'activo', '["catering"]'],
      ['c5@demo.co', 'es', 'pendiente', '["catering"]'],
      ['c6@demo.co', 'es', 'baja', '["catering"]'],
    ];
    await env.DB.batch(
      filas.map(([email, locale, estado, intereses], i) =>
        env.DB.prepare(
          "insert into contactos (id, email, nombre, locale, estado, origen, intereses, token, creado, actualizado) values (?, ?, ?, ?, ?, 'pie', ?, ?, ?, ?)",
        ).bind(`5555555${i}-5555-4555-8555-555555555555`, email, `Persona ${i}`, locale, estado, intereses, `tok${i}`, t, t),
      ),
    );
  });

  test('crea, previsualiza y prueba una campaña', async () => {
    const r = await admin('/admin/api/campanas', { method: 'POST', body: JSON.stringify({ asunto: 'Menús de fin de año', cuerpo: 'Hola {{nombre}}\n\n[[Ver menú|https://antidotocolombia.com/]]', locale: 'es', intereses: ['catering', 'inventado'] }) });
    const { campana, audiencia } = (await r.json()) as { campana: { id: string; intereses: string[] }; audiencia: number };
    expect(campana.intereses).toEqual(['catering']);
    expect(audiencia).toBe(2);

    const vista = await admin(`/admin/api/campanas/${campana.id}/vista`);
    expect(vista.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
    expect(await vista.text()).toContain('Hola Laura');

    const prueba = await admin(`/admin/api/campanas/${campana.id}/prueba`, { method: 'POST' });
    expect(prueba.status).toBe(200);
    expect(correos.at(-1)).toMatchObject({ to: ['mk@antidoto.co'], subject: '[Prueba] Menús de fin de año' });
  });

  test('envía solo a la audiencia, con baja de un clic, y no deja enviar dos veces', async () => {
    const { campana } = (await (await admin('/admin/api/campanas', { method: 'POST', body: JSON.stringify({ asunto: 'Catering para {{nombre}}', cuerpo: 'Hola {{nombre}}', locale: 'es', intereses: ['catering'] }) })).json()) as { campana: { id: string } };

    const malo = await admin(`/admin/api/campanas/${campana.id}/enviar`, { method: 'POST', body: '{"destinatarios":99}' });
    expect(malo.status).toBe(409);
    expect(await malo.json()).toEqual({ error: 'audiencia_cambio', audiencia: 2 });

    expect((await admin(`/admin/api/campanas/${campana.id}/enviar`, { method: 'POST', body: '{"destinatarios":2}' })).status).toBe(200);
    // El primer lote sale después de responder; al terminar, la campaña queda enviada.
    const d = (await (await admin(`/admin/api/campanas/${campana.id}`)).json()) as { campana: { estado: string }; stats: { enviados: number } };
    expect(d.campana.estado).toBe('enviada');
    expect(d.stats.enviados).toBe(2);

    expect(lotes).toHaveLength(1);
    const para = lotes[0]!.map((c) => c.to[0]).sort();
    expect(para).toEqual(['c1@demo.co', 'c2@demo.co']);
    const uno = lotes[0]!.find((c) => c.to[0] === 'c1@demo.co')!;
    expect(uno.subject).toBe('Catering para Persona');
    expect(uno.headers?.['List-Unsubscribe']).toBe(`<${APP}/v1/suscripcion/baja?t=tok0&c=${campana.id}>`);
    expect(uno.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');

    expect((await admin(`/admin/api/campanas/${campana.id}/enviar`, { method: 'POST', body: '{"destinatarios":2}' })).status).toBe(409);
  });

  test('reintenta si Resend está limitado y parte en lotes de 100', async () => {
    const t = Date.now();
    await env.DB.batch(
      Array.from({ length: 230 }, (_, i) =>
        env.DB.prepare("insert into contactos (id, email, locale, estado, origen, intereses, token, creado, actualizado) values (?, ?, 'en', 'activo', 'pie', '[]', ?, ?, ?)").bind(
          `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`,
          `masivo${i}@demo.co`,
          `masivo-${i}`,
          t,
          t,
        ),
      ),
    );
    const { campana, audiencia } = (await (await admin('/admin/api/campanas', { method: 'POST', body: JSON.stringify({ asunto: 'News', cuerpo: 'Hi {{nombre}}', locale: 'en' }) })).json()) as { campana: { id: string }; audiencia: number };
    expect(audiencia).toBe(231);

    console.log('T0', Date.now() - t);
    fallasLote = [429];
    const r = await admin(`/admin/api/campanas/${campana.id}/enviar`, { method: 'POST', body: JSON.stringify({ destinatarios: 231 }) });
    expect(((await r.json()) as { campana: { estado: string } }).campana.estado).toBe('enviando');
    expect(lotes).toHaveLength(0);
    console.log('T1', Date.now() - t);

    // El cron de la hora en punto no manda lotes: eso lo hace solo el de cada 5 minutos.
    const tareas: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => tareas.push(p), passThroughOnException() {} } as unknown as ExecutionContext;
    await trabajador.scheduled!({ cron: '0 * * * *', scheduledTime: Date.now(), type: 'scheduled', noRetry() {} } as ScheduledController, env, ctx);
    await Promise.all(tareas);
    expect(lotes).toHaveLength(0);

    console.log('T2', Date.now() - t);
    const res = await procesarEnvios(env, drizzle(env.DB));
    console.log('T3', Date.now() - t);
    expect(res).toEqual({ enviados: 231, fallidos: 0 });
    expect(lotes.map((l) => l.length)).toEqual([POR_LOTE, POR_LOTE, 31]);
    expect(new Set(lotes.flat().map((c) => c.to[0])).size).toBe(231);
    const d = (await (await admin(`/admin/api/campanas/${campana.id}`)).json()) as { campana: { estado: string } };
    expect(d.campana.estado).toBe('enviada');
  });

  test('el webhook firmado registra eventos; un rebote y una queja dan de baja', async () => {
    const envio = await env.DB.prepare("select e.resend_id, e.contacto_id from envios e join contactos c on c.id = e.contacto_id where c.email = 'c1@demo.co'").first<{ resend_id: string; contacto_id: string }>();
    const evento = async (type: string, data: Record<string, unknown> = {}, firmar = true) => {
      const cuerpo = JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: envio!.resend_id, ...data } });
      const id = `msg_${type}`;
      const ts = String(Math.floor(Date.now() / 1000));
      const clave = await crypto.subtle.importKey('raw', Uint8Array.from(atob(SECRETO_WEBHOOK.slice(6)), (c) => c.charCodeAt(0)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const firma = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`${id}.${ts}.${cuerpo}`)))));
      return llamar('/v1/resend/webhook', { method: 'POST', body: cuerpo, headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': firmar ? `v1,${firma}` : 'v1,falsa' } });
    };
    expect((await evento('email.opened', {}, false)).status).toBe(401);
    expect((await evento('email.delivered')).status).toBe(200);
    expect((await evento('email.opened')).status).toBe(200);
    const fila = await env.DB.prepare('select entregado, abierto from envios where resend_id = ?').bind(envio!.resend_id).first<Record<string, number>>();
    expect(fila?.entregado).toEqual(expect.any(Number));
    expect(fila?.abierto).toEqual(expect.any(Number));

    await evento('email.bounced', { bounce: { type: 'Transient' } });
    expect((await contacto('c1@demo.co'))?.estado).toBe('activo');
    await evento('email.bounced', { bounce: { type: 'Undetermined' } });
    expect((await contacto('c1@demo.co'))?.estado).toBe('activo');
    await evento('email.bounced', { bounce: { type: 'Permanent' } });
    expect(await contacto('c1@demo.co')).toMatchObject({ estado: 'rebotado', motivo_baja: 'rebote' });
  });

  test('la baja de un clic funciona sin Origin y registra la campaña', async () => {
    const campana = await env.DB.prepare("select e.campana_id from envios e join contactos c on c.id = e.contacto_id where c.email = 'c2@demo.co'").first<string>('campana_id');
    const r = await llamar(`/v1/suscripcion/baja?t=tok1&c=${campana}`, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(r.status).toBe(200);
    expect(await contacto('c2@demo.co')).toMatchObject({ estado: 'baja', motivo_baja: 'enlace' });
    const envio = await env.DB.prepare("select baja from envios where campana_id = ? and contacto_id = '55555551-5555-4555-8555-555555555555'").bind(campana).first<number>('baja');
    expect(envio).toEqual(expect.any(Number));
    const cons = await env.DB.prepare("select count(*) n from contacto_consentimientos where contacto_id = '55555551-5555-4555-8555-555555555555' and revocado is null").first<number>('n');
    expect(cons).toBe(0);
  });

  test('quien se da de baja antes de su lote no recibe nada', async () => {
    const { campana } = (await (await admin('/admin/api/campanas', { method: 'POST', body: JSON.stringify({ asunto: 'Formaciones', cuerpo: 'x', locale: 'es', intereses: ['formaciones'] }) })).json()) as { campana: { id: string } };
    fallasLote = [503, 503, 503, 503, 503];
    await admin(`/admin/api/campanas/${campana.id}/enviar`, { method: 'POST', body: '{"destinatarios":1}' });
    await llamar('/v1/suscripcion/baja?t=tok2', { method: 'POST' });
    fallasLote = [];
    await procesarEnvios(env, drizzle(env.DB));
    expect(lotes).toHaveLength(0);
    const estado = await env.DB.prepare('select estado from envios where campana_id = ?').bind(campana.id).first<string>('estado');
    expect(estado).toBe('cancelado');
  });

  test('invitar desde la bandeja no registra autorización hasta que confirme', async () => {
    const r = await admin('/admin/api/contactos', { method: 'POST', body: JSON.stringify({ email: 'invitado@demo.co', nombre: 'Inv', locale: 'en' }) });
    expect(r.status).toBe(200);
    const c = await contacto('invitado@demo.co');
    expect(c).toMatchObject({ estado: 'pendiente', origen: 'admin' });
    expect(await env.DB.prepare('select count(*) n from contacto_consentimientos where contacto_id = ?').bind(c!.id).first<number>('n')).toBe(0);
    expect(correos.at(-1)?.subject).toBe('Confirm your subscription · Antídoto');
    await llamar(`/v1/suscripcion/confirmar?t=${tokenDe(correos.at(-1)!.text, 'confirmar')}`, { method: 'POST' });
    const cons = await env.DB.prepare('select version, confirmado from contacto_consentimientos where contacto_id = ?').bind(c!.id).first<Record<string, unknown>>();
    expect(cons).toMatchObject({ version: NOVEDADES, confirmado: expect.any(Number) });
  });

  test('el equipo no puede reinvitar a quien se dio de baja', async () => {
    const r = await admin('/admin/api/contactos', { method: 'POST', body: JSON.stringify({ email: 'c6@demo.co', locale: 'es' }) });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'baja' });
    expect(correos).toHaveLength(0);
  });

  test('suprimir borra los datos personales del contacto', async () => {
    const c = await contacto('invitado@demo.co');
    const d = (await (await admin(`/admin/api/contactos/${c!.id}/suprimir`, { method: 'POST' })).json()) as { contacto: Record<string, unknown> };
    expect(d.contacto).toMatchObject({ email: `suprimido+${c!.id}@invalid`, nombre: null, estado: 'baja', motivoBaja: 'supresion' });
    expect(d.contacto).not.toHaveProperty('token');
  });

  test('lista contactos con conteos por estado', async () => {
    const d = (await (await admin('/admin/api/contactos?estado=activo')).json()) as { total: number; conteos: Record<string, number> };
    expect(d.conteos.rebotado).toBe(1);
    expect(d.total).toBe(d.conteos.activo);
  });
});

test('firmaValida rechaza firmas viejas', async () => {
  expect(await firmaValida(SECRETO_WEBHOOK, 'id', String(Math.floor(Date.now() / 1000) - 3600), '{}', 'v1,x')).toBe(false);
});
