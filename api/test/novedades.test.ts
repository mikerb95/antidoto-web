// Novedades, segunda parte: preferencias y pausa, páginas en el sitio, bienvenida editable,
// recordatorio único, importación con invitaciones por lotes, programación, prueba A/B, plantillas,
// duplicado, archivo público, métricas de la lista y suscripción en la ficha del lead.
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { crearEntorno } from './entorno';
import { manejar } from '../src/index';
import { procesarEnvios, arrancarProgramadas, decidirPruebas, ganadora } from '../src/marketing/envios';
import { recordatorios, invitaciones, RECORDATORIO_TRAS } from '../src/marketing/automaticos';
import { enmascarar } from '../src/marketing/suscripciones';
import { renderizar } from '../src/marketing/render';
import { TIEMPO_MINIMO_MS } from '../src/validar';
import consentimiento from '../../src/data/consentimiento.json';
import type { Env } from '../src/env';

const APP = 'https://api.test';
const SITIO = 'https://antidotocolombia.com';
const NOVEDADES = consentimiento.marketing.version;

let env: Env;
let cerrar: () => Promise<void>;
type Correo = { to: string[]; subject: string; html: string; text: string; from?: string; headers?: Record<string, string> };
let correos: Correo[] = [];
let lotes: Correo[][] = [];
let cookie = '';

beforeAll(async () => {
  ({ env, cerrar } = await crearEntorno());
  env.RESEND_API_KEY = 'prueba';
  env.SAL_IP = 'sal';
  env.APP_URL = APP;
  const real = globalThis.fetch;
  let n = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, init) => {
    const url = entrada instanceof Request ? entrada.url : String(entrada);
    if (url === 'https://api.resend.com/emails/batch') {
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

  const t = Date.now();
  await env.DB.prepare("insert into usuarios (id, email, nombre, rol, activo, creado) values ('88888888-8888-4888-8888-888888888888', 'nov@antidoto.co', 'Novedades', 'admin', 1, ?)").bind(t).run();
  await llamar('/auth/enlace', { method: 'POST', headers: { origin: APP, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nov@antidoto.co' }) });
  const tk = new URL(correos[0]!.text.match(/https:\/\/\S+/)![0]).searchParams.get('t')!;
  const r = await llamar('/auth/entrar', { method: 'POST', headers: { origin: APP }, body: new URLSearchParams({ t: tk }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0]!;
});
afterAll(async () => {
  vi.restoreAllMocks();
  await cerrar();
});
beforeEach(() => {
  correos = [];
  lotes = [];
});

async function llamar(ruta: string, init: RequestInit & { ip?: string } = {}) {
  const pendientes: Promise<unknown>[] = [];
  const headers = new Headers(init.headers);
  if (init.ip) headers.set('cf-connecting-ip', init.ip);
  const res = await manejar(new Request(`${APP}${ruta}`, { ...init, headers, redirect: 'manual' }), env, (p) => pendientes.push(p));
  await Promise.all(pendientes);
  return res;
}

const admin = (ruta: string, init: RequestInit = {}) =>
  llamar(ruta, { ...init, headers: { origin: APP, cookie, 'content-type': 'application/json', ...(init.headers as object) } });

let ip = 10;
const suscribirse = (email: string, extra: Record<string, unknown> = {}) =>
  llamar('/v1/suscripciones', {
    method: 'POST',
    ip: `203.0.113.${ip++}`,
    headers: { origin: SITIO, 'content-type': 'text/plain' },
    body: JSON.stringify({ email, consentimiento: NOVEDADES, locale: 'es', t: TIEMPO_MINIMO_MS + 1000, ...extra }),
  });

const contacto = (email: string) => env.DB.prepare('select * from contactos where email = ?').bind(email).first<Record<string, unknown>>();

/** Contacto activo listo para campañas. */
async function activo(email: string, extra: { locale?: string; intereses?: string; pausa?: number | null } = {}) {
  const t = Date.now();
  await env.DB.prepare(
    "insert into contactos (id, email, locale, estado, origen, intereses, token, creado, actualizado, confirmado, pausa_hasta) values (?, ?, ?, 'activo', 'pie', ?, ?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), email, extra.locale ?? 'es', extra.intereses ?? '[]', `tok-${email}`, t, t, t, extra.pausa ?? null)
    .run();
}

const formulario = (datos: [string, string][]) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(datos).toString(),
});

describe('formularios del sitio', () => {
  test('guarda de qué formulario llegó y sus intereses', async () => {
    await suscribirse('home@demo.co', { origen: 'inicio', intereses: ['catering', 'inventado'] });
    await suscribirse('raro@demo.co', { origen: 'admin' });
    expect(await contacto('home@demo.co')).toMatchObject({ origen: 'inicio', intereses: '["catering"]' });
    // Un formulario público no puede hacerse pasar por una invitación del equipo.
    expect(await contacto('raro@demo.co')).toMatchObject({ origen: 'pie' });
  });
});

describe('preferencias y baja en el sitio', () => {
  const T = 'tok-pref@demo.co';

  test('los datos solo se leen desde el sitio y con el correo enmascarado', async () => {
    await activo('pref@demo.co', { intereses: '["audiovisual"]' });
    expect((await llamar(`/v1/suscripcion/datos?t=${T}`)).status).toBe(403);
    const r = await llamar(`/v1/suscripcion/datos?t=${T}`, { headers: { origin: SITIO } });
    expect(r.headers.get('access-control-allow-origin')).toBe(SITIO);
    expect(await r.json()).toEqual({ ok: true, email: 'pr**@demo.co', estado: 'activo', locale: 'es', intereses: ['audiovisual'], pausaHasta: null });
    expect((await llamar('/v1/suscripcion/datos?t=nada', { headers: { origin: SITIO } })).status).toBe(404);
    expect(enmascarar('a@b.co')).toBe('a*@b.co');
  });

  test('el GET lleva a la página del sitio y el POST guarda temas, idioma y pausa', async () => {
    const ir = await llamar(`/v1/suscripcion/preferencias?t=${T}`);
    expect(ir.headers.get('location')).toBe(`${SITIO}/novedades/preferencias/?accion=preferencias&t=${encodeURIComponent(T)}`);

    const r = await llamar(`/v1/suscripcion/preferencias?t=${T}`, formulario([['intereses', 'catering'], ['intereses', 'diseno'], ['intereses', 'x'], ['locale', 'en'], ['pausa', '30']]));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`${SITIO}/en/news/preferences/?estado=actualizado&t=${encodeURIComponent(T)}`);
    const c = await contacto('pref@demo.co');
    expect(c).toMatchObject({ intereses: '["catering","diseno"]', locale: 'en' });
    expect(c!.pausa_hasta as number).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    // Una pausa inventada se ignora.
    await llamar(`/v1/suscripcion/preferencias?t=${T}`, formulario([['locale', 'es'], ['pausa', '7']]));
    expect(await contacto('pref@demo.co')).toMatchObject({ pausa_hasta: null, intereses: '[]', locale: 'es' });
  });

  test('quien está en pausa no entra en la audiencia', async () => {
    await activo('pausa1@demo.co', { locale: 'en', pausa: Date.now() + 86_400_000 });
    await activo('pausa2@demo.co', { locale: 'en', pausa: Date.now() - 1000 });
    const r = await admin('/admin/api/campanas', { method: 'POST', body: JSON.stringify({ asunto: 'Pausa', cuerpo: 'x', locale: 'en' }) });
    expect(((await r.json()) as { audiencia: number }).audiencia).toBe(1);
  });

  test('baja: el GET lleva al botón, el formulario vuelve al sitio y la de un clic responde 200', async () => {
    await activo('baja1@demo.co');
    await activo('baja2@demo.co');
    const ir = await llamar('/v1/suscripcion/baja?t=tok-baja1@demo.co&c=abc');
    expect(ir.headers.get('location')).toBe(`${SITIO}/novedades/preferencias/?accion=baja&t=tok-baja1%40demo.co&c=abc`);
    expect((await contacto('baja1@demo.co'))?.estado).toBe('activo');

    const r = await llamar('/v1/suscripcion/baja?t=tok-baja1@demo.co', formulario([]));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`${SITIO}/novedades/preferencias/?estado=baja`);
    expect((await contacto('baja1@demo.co'))?.estado).toBe('baja');

    const unClic = await llamar('/v1/suscripcion/baja?t=tok-baja2@demo.co', formulario([['List-Unsubscribe', 'One-Click']]));
    expect(unClic.status).toBe(200);
    expect((await contacto('baja2@demo.co'))?.estado).toBe('baja');
  });
});

describe('correos automáticos', () => {
  test('la bienvenida editada reemplaza la de por defecto, y se puede apagar o restaurar', async () => {
    const lista = (await (await admin('/admin/api/automaticos')).json()) as { automaticos: { clave: string; personalizado: boolean }[] };
    expect(lista.automaticos.map((a) => [a.clave, a.personalizado])).toEqual([
      ['bienvenida:es', false],
      ['bienvenida:en', false],
    ]);

    const guardar = await admin('/admin/api/automaticos/bienvenida:es', { method: 'PUT', body: JSON.stringify({ asunto: 'Tu guía de regalo', cuerpo: '[[Descargar la guía|{{sitio}}/guia.pdf]]', activo: true }) });
    expect(guardar.status).toBe(200);
    const vista = await (await admin('/admin/api/automaticos/bienvenida:es/vista')).text();
    expect(vista).toContain(`href="${SITIO}/guia.pdf"`);

    await suscribirse('bien@demo.co');
    const t = new URL(correos[0]!.text.match(/https:\/\/\S+confirmar\S+/)![0]).searchParams.get('t')!;
    correos = [];
    await llamar(`/v1/suscripcion/confirmar?t=${t}`, { method: 'POST' });
    expect(correos.map((c) => c.subject)).toEqual(['Tu guía de regalo']);
    expect(correos[0]!.from).toBe(env.MAIL_FROM_NOVEDADES);

    await admin('/admin/api/automaticos/bienvenida:es', { method: 'PUT', body: JSON.stringify({ asunto: 'Apagada', cuerpo: 'x', activo: false }) });
    await suscribirse('sin-bien@demo.co');
    const t2 = new URL(correos.at(-1)!.text.match(/https:\/\/\S+confirmar\S+/)![0]).searchParams.get('t')!;
    correos = [];
    await llamar(`/v1/suscripcion/confirmar?t=${t2}`, { method: 'POST' });
    expect(correos).toHaveLength(0);

    await admin('/admin/api/automaticos/bienvenida:es', { method: 'DELETE' });
    const otra = (await (await admin('/admin/api/automaticos')).json()) as { automaticos: { personalizado: boolean }[] };
    expect(otra.automaticos[0]!.personalizado).toBe(false);
    expect((await admin('/admin/api/automaticos/despedida:es', { method: 'PUT', body: '{}' })).status).toBe(404);
  });

  test('un solo recordatorio a quien no confirmó, y nunca a los invitados', async () => {
    const hace = Date.now() - RECORDATORIO_TRAS - 60_000;
    const insertar = (email: string, origen: string, enviada: number) =>
      env.DB.prepare("insert into contactos (id, email, locale, estado, origen, intereses, token, creado, actualizado, confirmacion_enviada) values (?, ?, 'es', 'pendiente', ?, '[]', ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), email, origen, `tok-${email}`, enviada, enviada, enviada)
        .run();
    await insertar('olvido@demo.co', 'inicio', hace);
    await insertar('reciente@demo.co', 'pie', Date.now() - 3_600_000);
    await insertar('viejo@demo.co', 'pie', Date.now() - 10 * 86_400_000);
    await insertar('invitado2@demo.co', 'admin', hace);

    expect(await recordatorios(env, drizzle(env.DB), APP)).toBe(1);
    expect(correos.map((c) => [c.to[0], c.subject])).toEqual([['olvido@demo.co', 'Recordatorio: confirma tu suscripción · Antídoto']]);
    expect(correos[0]!.text).toContain('único recordatorio');
    expect(await recordatorios(env, drizzle(env.DB), APP)).toBe(0);
  });
});

describe('importación', () => {
  test('crea invitaciones sin tocar a quien ya existe; el cron las manda por lotes', async () => {
    await activo('ya@demo.co');
    const r = await admin('/admin/api/contactos/importar', {
      method: 'POST',
      body: JSON.stringify({
        filas: [
          { email: 'Imp1@Demo.co', nombre: 'Uno', locale: 'en', intereses: ['catering'] },
          { email: 'imp1@demo.co' },
          { email: 'no-es-correo' },
          { email: 'ya@demo.co' },
          ...Array.from({ length: 95 }, (_, i) => ({ email: `lote${i}@demo.co` })),
        ],
      }),
    });
    expect(await r.json()).toEqual({ ok: true, creados: 96, existentes: 1, invalidos: 1 });
    expect(await contacto('imp1@demo.co')).toMatchObject({ estado: 'pendiente', origen: 'importado', nombre: 'Uno', locale: 'en', confirmacion_enviada: null });
    expect(await contacto('ya@demo.co')).toMatchObject({ estado: 'activo', origen: 'pie' });
    expect(correos).toHaveLength(0);

    expect(await invitaciones(env, drizzle(env.DB), APP)).toBe(96);
    expect(lotes.map((l) => l.length)).toEqual([90, 6]);
    const uno = lotes.flat().find((c) => c.to[0] === 'imp1@demo.co')!;
    expect(uno.subject).toBe('Confirm your subscription · Antídoto');
    expect(uno.html).toContain('Hi Uno,');
    expect(await invitaciones(env, drizzle(env.DB), APP)).toBe(0);

    // Como toda invitación, la autorización nace cuando confirma.
    const c = await contacto('imp1@demo.co');
    expect(await env.DB.prepare('select count(*) n from contacto_consentimientos where contacto_id = ?').bind(c!.id).first<number>('n')).toBe(0);
    await llamar(`/v1/suscripcion/confirmar?t=${encodeURIComponent(c!.token as string)}`, { method: 'POST' });
    expect(await env.DB.prepare('select count(*) n from contacto_consentimientos where contacto_id = ? and confirmado is not null').bind(c!.id).first<number>('n')).toBe(1);

    expect((await admin('/admin/api/contactos/importar', { method: 'POST', body: JSON.stringify({ filas: Array(1001).fill({ email: 'a@b.co' }) }) })).status).toBe(413);
  });
});

describe('campañas: programación, A/B, duplicado y plantillas', () => {
  type Detalle = { campana: { id: string; estado: string; programada: number | null; abGanador: string | null; asunto: string }; audiencia: number; variantes: { variante: string; enviados: number }[] | null };
  const crear = async (datos: Record<string, unknown>) => ((await (await admin('/admin/api/campanas', { method: 'POST', body: JSON.stringify(datos) })).json()) as Detalle).campana;

  beforeAll(async () => {
    for (let i = 0; i < 10; i++) await activo(`ab${i}@demo.co`, { intereses: '["formaciones"]' });
  });

  test('programa, desprograma y el cron la arranca a su hora', async () => {
    const c = await crear({ asunto: 'Programada', cuerpo: 'x', locale: 'es', intereses: ['formaciones'] });
    expect((await admin(`/admin/api/campanas/${c.id}/programar`, { method: 'POST', body: JSON.stringify({ fecha: Date.now() + 60_000 }) })).status).toBe(422);
    const r = (await (await admin(`/admin/api/campanas/${c.id}/programar`, { method: 'POST', body: JSON.stringify({ fecha: Date.now() + 3_600_000 }) })).json()) as Detalle;
    expect(r.campana.estado).toBe('programada');
    // Programada no se edita: primero se desprograma.
    expect((await admin(`/admin/api/campanas/${c.id}`, { method: 'PATCH', body: JSON.stringify({ asunto: 'x', cuerpo: 'y' }) })).status).toBe(409);
    expect(((await (await admin(`/admin/api/campanas/${c.id}/desprogramar`, { method: 'POST' })).json()) as Detalle).campana.estado).toBe('borrador');

    await admin(`/admin/api/campanas/${c.id}/programar`, { method: 'POST', body: JSON.stringify({ fecha: Date.now() + 3_600_000 }) });
    expect(await arrancarProgramadas(env, drizzle(env.DB))).toBe(0);
    await env.DB.prepare('update campanas set programada = ? where id = ?').bind(Date.now() - 1000, c.id).run();
    expect(await arrancarProgramadas(env, drizzle(env.DB))).toBe(1);
    await procesarEnvios(env, drizzle(env.DB));
    expect(lotes.flat()).toHaveLength(10);
    expect(lotes[0]![0]!.html).toContain(`${APP}/v1/suscripcion/preferencias?t=`);
    expect(lotes[0]![0]!.html).toContain(`${APP}/v1/novedades/${c.id}`);
    expect(((await (await admin(`/admin/api/campanas/${c.id}`)).json()) as Detalle).campana.estado).toBe('enviada');
  });

  test('prueba A/B: la muestra recibe las dos variantes y el resto la ganadora', async () => {
    expect(ganadora({ clics: 1, abiertos: 0 }, { clics: 2, abiertos: 0 })).toBe('b');
    expect(ganadora({ clics: 0, abiertos: 3 }, { clics: 0, abiertos: 1 })).toBe('a');
    expect(ganadora({ clics: 0, abiertos: 0 }, { clics: 0, abiertos: 0 })).toBe('a');

    const c = await crear({ asunto: 'Asunto A', asuntoB: 'Asunto B', abMuestra: 40, abHoras: 2, cuerpo: 'x', locale: 'es', intereses: ['formaciones'] });
    await admin(`/admin/api/campanas/${c.id}/enviar`, { method: 'POST', body: '{"destinatarios":10}' });
    const muestra = lotes.flat();
    expect(muestra.map((m) => m.subject).sort()).toEqual(['Asunto A', 'Asunto A', 'Asunto B', 'Asunto B']);
    expect(((await (await admin(`/admin/api/campanas/${c.id}`)).json()) as Detalle).campana.estado).toBe('enviando');

    // Antes de la hora no se decide nada.
    expect(await decidirPruebas(env, drizzle(env.DB))).toBe(0);
    await env.DB.prepare("update envios set clic = ? where campana_id = ? and variante = 'b' and rowid = (select min(rowid) from envios where campana_id = ? and variante = 'b')").bind(Date.now(), c.id, c.id).run();
    await env.DB.prepare('update campanas set ab_decision = ? where id = ?').bind(Date.now() - 1000, c.id).run();
    expect(await decidirPruebas(env, drizzle(env.DB))).toBe(1);
    lotes = [];
    await procesarEnvios(env, drizzle(env.DB));
    expect(lotes.flat().map((m) => m.subject)).toEqual(Array(6).fill('Asunto B'));
    const d = (await (await admin(`/admin/api/campanas/${c.id}`)).json()) as Detalle;
    expect(d.campana).toMatchObject({ estado: 'enviada', abGanador: 'b' });
    expect(Object.fromEntries(d.variantes!.map((v) => [v.variante, v.enviados]))).toEqual({ a: 2, b: 8 });
  });

  test('duplica cualquier campaña como borrador y guarda plantillas', async () => {
    const c = await crear({ asunto: 'Original', cuerpo: 'Cuerpo', locale: 'en', publica: true });
    const copia = ((await (await admin(`/admin/api/campanas/${c.id}/duplicar`, { method: 'POST' })).json()) as Detalle).campana;
    expect(copia).toMatchObject({ estado: 'borrador', asunto: 'Original', publica: true });
    expect(copia.id).not.toBe(c.id);

    const r = await admin('/admin/api/plantillas', { method: 'POST', body: JSON.stringify({ nombre: 'Boletín', asunto: 'Boletín de {{nombre}}', cuerpo: '# Hola', locale: 'es' }) });
    const { plantillas } = (await r.json()) as { plantillas: { id: string; nombre: string }[] };
    expect(plantillas.map((p) => p.nombre)).toEqual(['Boletín']);
    expect((await admin('/admin/api/plantillas', { method: 'POST', body: JSON.stringify({ asunto: 'x', cuerpo: 'y' }) })).status).toBe(422);
    const tras = (await (await admin(`/admin/api/plantillas/${plantillas[0]!.id}`, { method: 'DELETE' })).json()) as { plantillas: unknown[] };
    expect(tras.plantillas).toHaveLength(0);
  });
});

describe('archivo público', () => {
  test('lista solo las públicas enviadas y su versión web no lleva datos de nadie', async () => {
    const t = Date.now();
    const insertar = (id: string, asunto: string, estado: string, publica: number) =>
      env.DB.prepare("insert into campanas (id, asunto, cuerpo, locale, intereses, estado, autor, creada, actualizada, iniciada, publica) values (?, ?, 'Hola {{nombre}}', 'es', '[]', ?, 'x', ?, ?, ?, ?)")
        .bind(id, asunto, estado, t, t, t, publica)
        .run();
    await insertar('99999999-9999-4999-8999-000000000001', 'Pública', 'enviada', 1);
    await insertar('99999999-9999-4999-8999-000000000002', 'Privada', 'enviada', 0);
    await insertar('99999999-9999-4999-8999-000000000003', 'Borrador', 'borrador', 1);

    const r = await llamar('/v1/novedades?locale=es', { headers: { origin: SITIO } });
    expect(r.headers.get('access-control-allow-origin')).toBe(SITIO);
    const { novedades } = (await r.json()) as { novedades: { asunto: string }[] };
    expect(novedades.map((n) => n.asunto)).toEqual(['Pública']);

    const web = await llamar('/v1/novedades/99999999-9999-4999-8999-000000000001');
    const html = await web.text();
    expect(html).toContain('Hola hola');
    expect(html).toContain(`${SITIO}/novedades/`);
    expect(html).not.toContain('/v1/suscripcion/');
    expect(web.headers.get('x-robots-tag')).toBe(null);
    expect((await llamar('/v1/novedades/99999999-9999-4999-8999-000000000002')).headers.get('x-robots-tag')).toBe('noindex');
    expect((await llamar('/v1/novedades/99999999-9999-4999-8999-000000000003')).status).toBe(404);
  });

  test('render web: pie para suscribirse en vez de baja', () => {
    const r = renderizar({ asunto: 'A', cuerpo: 'B', locale: 'en' }, {}, `${SITIO}/en/news/`, { modoWeb: true, responsable: 'Antídoto S.A.S.' });
    expect(r.html).toContain('subscribe here');
    expect(r.html).not.toContain('Unsubscribe');
    expect(r.texto).toContain('Antídoto S.A.S.');
  });
});

describe('métricas y ficha del lead', () => {
  test('series semanales y confirmación por origen', async () => {
    const m = (await (await admin('/admin/api/marketing?semanas=8')).json()) as {
      semanas: number[];
      altas: number[];
      confirmados: number[];
      origenes: { origen: string; total: number; confirmados: number }[];
      conteos: Record<string, number>;
    };
    expect(m.semanas).toHaveLength(8);
    expect(m.altas).toHaveLength(8);
    expect(m.altas.at(-1)).toBeGreaterThan(0);
    expect(m.origenes.find((o) => o.origen === 'importado')).toMatchObject({ total: 96, confirmados: 1 });
    expect(m.conteos.activo).toBeGreaterThan(0);
  });

  test('la ficha del lead muestra su suscripción', async () => {
    const r = await llamar('/v1/leads', {
      method: 'POST',
      ip: '203.0.113.200',
      headers: { origin: SITIO, 'content-type': 'text/plain' },
      body: JSON.stringify({ servicio: 'formaciones', nombre: 'Lia', email: 'ab3@demo.co', consentimiento: consentimiento.version, locale: 'es', t: TIEMPO_MINIMO_MS + 1000 }),
    });
    const { id } = (await r.json()) as { id: string };
    const d = (await (await admin(`/admin/api/leads/${id}`)).json()) as { suscripcion: { estado: string; recibidas: number; clics: number } };
    expect(d.suscripcion).toMatchObject({ estado: 'activo', recibidas: 2 });
  });
});
