// Plataforma de misiones en el panel: pases firmados (los verifica el otro proyecto con el mismo
// algoritmo que esta prueba), permisos, resumen, enlace con organizaciones y caída de la plataforma.
import { describe, test, expect, beforeAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { prepararPruebas } from './ayudas';
import { destinoSeguro, firmarPase, misionesConfiguradas, SEGUNDOS_PASE } from '../src/misiones';
import type { Env } from '../src/env';
import { consulta } from './entorno';

const URL_MISIONES = 'https://misiones.test';
const SECRETO = 'secreto-compartido-de-prueba-con-mas-de-32';

/** Lo mismo que hace verifyPass en la plataforma de misiones (src/lib/panel-pass.ts). */
function verificar(pase: string, uso: string): Record<string, unknown> | null {
  const [v, cuerpo, firma] = pase.split('.');
  if (v !== 'v1' || !cuerpo || !firma) return null;
  if (createHmac('sha256', SECRETO).update(`v1.${cuerpo}`).digest('base64url') !== firma) return null;
  const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as Record<string, unknown>;
  return datos.uso === uso && typeof datos.exp === 'number' && datos.exp > Date.now() ? datos : null;
}

const remoto = { caida: false, llamadas: [] as { ruta: string; metodo: string; cuerpo: unknown }[], empresas: [{ id: 7, nombre: 'Ruta 5', archivada: false, actividades: 2, participantes: 31 }] };
const RESUMEN = { empresas: 1, actividades: { activas: 2, pausadas: 0, vencidas: 1 }, participantes: 31, completaron: 20, semanas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 12, 15], enMarcha: [] };

const p = prepararPruebas((url, init) => {
  if (!url.startsWith(URL_MISIONES)) return null;
  const ruta = url.slice(URL_MISIONES.length);
  const pase = String(new Headers(init?.headers).get('authorization') ?? '').replace('Bearer ', '');
  if (!verificar(pase, 'api')) return Response.json({ error: 'pase' }, { status: 401 });
  if (remoto.caida) return new Response('caída', { status: 500 });
  const metodo = init?.method ?? 'GET';
  const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
  remoto.llamadas.push({ ruta, metodo, cuerpo });
  if (ruta === '/api/panel/resumen') return Response.json(RESUMEN);
  if (ruta === '/api/panel/empresas' && metodo === 'GET') return Response.json({ empresas: remoto.empresas });
  if (ruta === '/api/panel/empresas' && metodo === 'POST') {
    const nueva = { id: 8, nombre: cuerpo.nombre as string, archivada: false, actividades: 0, participantes: 0 };
    remoto.empresas.push(nueva);
    return Response.json({ empresa: { id: 8, nombre: nueva.nombre, creada: true } });
  }
  const m = ruta.match(/^\/api\/panel\/empresas\/(\d+)$/);
  const empresa = m && remoto.empresas.find((e) => e.id === Number(m[1]));
  if (!empresa) return Response.json({ error: 'no existe' }, { status: 404 });
  return Response.json({ empresa: { id: empresa.id, nombre: empresa.nombre, archivada: false }, actividades: [{ id: 1, codigo: 'ABC123', actividad: 'Detecta el riesgo', estado: 'activo', expira: null, participantes: 31, completaron: 20, avance: 70 }] });
});

let admin = '';
let comercial = '';
let contenido = '';
const ORG = '00000000-0000-4000-8000-0000000000d1';
const ORG2 = '00000000-0000-4000-8000-0000000000d2';
const enviar = (ck: string, ruta: string, metodo = 'GET', cuerpo?: unknown) => p.conSesion(ck, ruta, { method: metodo, ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}) });

beforeAll(async () => {
  admin = await p.entrarComo('admin-mis@antidoto.co', 'admin');
  comercial = await p.entrarComo('com-mis@antidoto.co', 'comercial');
  contenido = await p.entrarComo('cont-mis@antidoto.co', 'contenido');
  const t = Date.now();
  for (const [id, nombre] of [[ORG, 'Ruta 5'], [ORG2, 'Café del Valle']])
    await consulta(p.env.DB, 'insert into organizaciones (id, nombre, creado, actualizado) values (?, ?, ?, ?)', id, nombre, t, t).run();
});

describe('pases firmados', () => {
  test('la otra plataforma los verifica con el secreto compartido', async () => {
    const pase = await firmarPase(SECRETO, 'entrar', { email: 'ana@antidoto.co' });
    const datos = verificar(pase, 'entrar')!;
    expect(datos.email).toBe('ana@antidoto.co');
    expect(Number(datos.exp) - Date.now()).toBeLessThanOrEqual(SEGUNDOS_PASE * 1000);
    expect(String(datos.jti).length).toBeGreaterThanOrEqual(16);
    expect(verificar(pase, 'api')).toBeNull();
    expect(verificar(`${pase}x`, 'entrar')).toBeNull();
  });

  test('dos pases nunca son iguales', async () => {
    expect(await firmarPase(SECRETO, 'api')).not.toBe(await firmarPase(SECRETO, 'api'));
  });

  test('el destino solo puede ser una ruta del portal de misiones', () => {
    expect(destinoSeguro('/admin/empresas/7')).toBe('/admin/empresas/7');
    for (const malo of ['https://otro.com', '//otro.com', '/admin//otro.com', '/mision', '/admin?x=1', null, 3]) expect(destinoSeguro(malo)).toBe('/admin');
  });

  test('sin URL o con un secreto corto no está configurada', () => {
    expect(misionesConfiguradas({} as Env)).toBe(false);
    expect(misionesConfiguradas({ MISIONES_URL: URL_MISIONES, MISIONES_SECRETO: 'corto' } as Env)).toBe(false);
    expect(misionesConfiguradas({ MISIONES_URL: URL_MISIONES, MISIONES_SECRETO: SECRETO } as Env)).toBe(true);
  });
});

describe('sin configurar', () => {
  test('el panel lo dice y no llama a nadie', async () => {
    expect(await (await enviar(admin, '/admin/api/misiones')).json()).toEqual({ configurada: false });
    expect((await enviar(admin, '/admin/api/misiones/pase', 'POST', {})).status).toBe(409);
    expect(await (await enviar(admin, `/admin/api/organizaciones/${ORG}/misiones`)).json()).toMatchObject({ configurada: false, empresa: null });
    expect(remoto.llamadas).toHaveLength(0);
  });
});

describe('con la plataforma conectada', () => {
  beforeAll(() => {
    p.env.MISIONES_URL = `${URL_MISIONES}/`;
    p.env.MISIONES_SECRETO = SECRETO;
  });

  test('el resumen sale para quien puede verlo y dice si puede entrar', async () => {
    const a = (await (await enviar(admin, '/admin/api/misiones')).json()) as { configurada: boolean; puedeEntrar: boolean; resumen: typeof RESUMEN };
    expect(a.configurada).toBe(true);
    expect(a.puedeEntrar).toBe(true);
    expect(a.resumen.participantes).toBe(31);
    const c = (await (await enviar(comercial, '/admin/api/misiones')).json()) as { puedeEntrar: boolean };
    expect(c.puedeEntrar).toBe(false);
    expect((await enviar(contenido, '/admin/api/misiones')).status).toBe(403);
  });

  test('solo admin recibe un pase de entrada, con su correo y un destino seguro', async () => {
    expect((await enviar(comercial, '/admin/api/misiones/pase', 'POST', {})).status).toBe(403);
    const r = (await (await enviar(admin, '/admin/api/misiones/pase', 'POST', { destino: 'https://malo.com' })).json()) as { url: string };
    const url = new URL(r.url);
    expect(url.origin + url.pathname).toBe(`${URL_MISIONES}/admin/entrar`);
    const datos = verificar(url.searchParams.get('pase')!, 'entrar')!;
    expect(datos.email).toBe('admin-mis@antidoto.co');
    expect(datos.destino).toBe('/admin');
    const fila = await consulta(p.env.DB, "select count(*) as n from auditoria where accion = 'misiones.entrar'").first<{ n: number }>();
    expect(fila?.n).toBe(1);
  });

  test('una organización se enlaza con una empresa que existe y muestra sus actividades', async () => {
    expect((await enviar(comercial, `/admin/api/organizaciones/${ORG}/misiones`, 'PUT', { empresaId: 7 })).status).toBe(403);
    expect((await enviar(admin, `/admin/api/organizaciones/${ORG}/misiones`, 'PUT', { empresaId: 99 })).status).toBe(422);
    expect((await enviar(admin, `/admin/api/organizaciones/${ORG}/misiones`, 'PUT', { empresaId: 'x' })).status).toBe(422);
    const r = await enviar(admin, `/admin/api/organizaciones/${ORG}/misiones`, 'PUT', { empresaId: 7 });
    expect(r.status).toBe(200);
    const ficha = (await (await enviar(comercial, `/admin/api/organizaciones/${ORG}/misiones`)).json()) as { empresa: { id: number }; actividades: { codigo: string }[] };
    expect(ficha.empresa.id).toBe(7);
    expect(ficha.actividades[0]!.codigo).toBe('ABC123');
  });

  test('una empresa no se enlaza con dos organizaciones', async () => {
    const r = await enviar(admin, `/admin/api/organizaciones/${ORG2}/misiones`, 'PUT', { empresaId: 7 });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: 'enlazada', organizacion: { id: ORG } });
  });

  test('crear la empresa usa el nombre de la organización y queda enlazada', async () => {
    const r = await enviar(admin, `/admin/api/organizaciones/${ORG2}/misiones`, 'PUT', { crear: true });
    expect(r.status).toBe(200);
    const alta = remoto.llamadas.find((l) => l.metodo === 'POST');
    expect(alta?.cuerpo).toEqual({ nombre: 'Café del Valle', actor: 'admin-mis@antidoto.co' });
    const lista = (await (await enviar(admin, '/admin/api/misiones/empresas')).json()) as { empresas: { id: number; organizacion: { id: string } | null }[] };
    expect(lista.empresas.find((e) => e.id === 8)?.organizacion?.id).toBe(ORG2);
    expect(lista.empresas.find((e) => e.id === 7)?.organizacion?.id).toBe(ORG);
  });

  test('quitar el enlace no toca la plataforma', async () => {
    const antes = remoto.llamadas.length;
    const r = (await (await enviar(admin, `/admin/api/organizaciones/${ORG2}/misiones`, 'PUT', { empresaId: null })).json()) as { empresa: unknown };
    expect(r.empresa).toBeNull();
    expect(remoto.llamadas.length).toBe(antes);
  });

  test('si la empresa enlazada desaparece, la ficha lo avisa', async () => {
    await consulta(p.env.DB, 'update organizaciones set mision_empresa_id = 55 where id = ?', ORG2).run();
    expect(await (await enviar(admin, `/admin/api/organizaciones/${ORG2}/misiones`)).json()).toMatchObject({ empresa: null, perdida: true });
  });

  test('si la plataforma no responde, el panel contesta 502 y lo demás sigue', async () => {
    remoto.caida = true;
    expect((await enviar(admin, '/admin/api/misiones')).status).toBe(502);
    expect((await enviar(admin, `/admin/api/organizaciones/${ORG}/misiones`)).status).toBe(502);
    expect((await enviar(admin, `/admin/api/organizaciones/${ORG}`)).status).toBe(200);
    remoto.caida = false;
  });
});
