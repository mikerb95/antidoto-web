// Roles y permisos del panel, sesiones propias, ajustes y bitácora de auditoría.
import { describe, test, expect, beforeAll } from 'vitest';
import { prepararPruebas } from './ayudas';
import { puede, permisosDe, PERMISOS } from '../src/permisos';
import { ROLES, type Rol } from '../src/dominio';
import { validarAjustes } from '../src/configuracion';

const p = prepararPruebas();

describe('matriz de permisos', () => {
  test('admin puede todo y un rol desconocido nada', () => {
    for (const permiso of PERMISOS) expect(puede('admin', permiso)).toBe(true);
    expect(permisosDe('equipo')).toEqual([]);
    expect(puede('equipo', 'leads.ver')).toBe(false);
  });

  test('solo admin suprime datos, gestiona el equipo y cambia ajustes', () => {
    for (const rol of ROLES.filter((r) => r !== 'admin')) {
      expect(puede(rol, 'datos.suprimir')).toBe(false);
      expect(puede(rol, 'equipo.gestionar')).toBe(false);
      expect(puede(rol, 'config.editar')).toBe(false);
      expect(puede(rol, 'auditoria.ver')).toBe(false);
    }
  });

  test('lectura no cambia nada', () => {
    expect(permisosDe('lectura').every((x) => x.endsWith('.ver'))).toBe(true);
  });

  test('producción no ve el valor de los proyectos', () => {
    expect(puede('produccion', 'proyectos.editar')).toBe(true);
    expect(puede('produccion', 'proyectos.valor')).toBe(false);
  });
});

describe('rutas por rol', () => {
  const cookies = {} as Record<Rol, string>;
  beforeAll(async () => {
    for (const rol of ROLES) cookies[rol] = await p.entrarComo(`${rol}@antidoto.co`, rol);
  });

  test('/yo devuelve los permisos del rol', async () => {
    const yo = (await (await p.llamar('/admin/api/yo', { headers: { cookie: cookies.contenido } })).json()) as { rol: string; permisos: string[] };
    expect(yo.rol).toBe('contenido');
    expect(yo.permisos).toContain('contenido.publicar');
    expect(yo.permisos).not.toContain('leads.ver');
  });

  const casos: [string, string, string, Rol[]][] = [
    ['GET', '/admin/api/leads', '', ['admin', 'comercial', 'produccion', 'lectura']],
    ['GET', '/admin/leads.csv', '', ['admin', 'comercial']],
    ['GET', '/admin/api/campanas', '', ['admin', 'comercial', 'contenido', 'lectura']],
    ['POST', '/admin/api/plantillas', '{"nombre":"x","asunto":"y","cuerpo":"z","locale":"es"}', ['admin', 'comercial', 'contenido']],
    ['GET', '/admin/api/auditoria', '', ['admin']],
    ['PUT', '/admin/api/configuracion', '{"asesor.activo":true}', ['admin']],
    ['POST', '/admin/api/usuarios', '{"email":"nuevo-ROL@antidoto.co","nombre":"Nuevo"}', ['admin']],
  ];
  test.each(casos)('%s %s', async (metodo, ruta, cuerpo, permitidos) => {
    for (const rol of ROLES) {
      const r = await p.conSesion(cookies[rol], ruta, { method: metodo, ...(cuerpo ? { body: cuerpo.replace('ROL', rol) } : {}) });
      if (permitidos.includes(rol)) expect(r.status, `${rol} debería poder`).not.toBe(403);
      else expect(r.status, `${rol} no debería poder`).toBe(403);
    }
  });

  test('suprimir un lead o un contacto es solo de admin', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    for (const rol of ROLES.filter((r) => r !== 'admin')) {
      expect((await p.conSesion(cookies[rol], `/admin/api/leads/${id}/anonimizar`, { method: 'POST' })).status).toBe(403);
      expect((await p.conSesion(cookies[rol], `/admin/api/contactos/${id}/suprimir`, { method: 'POST' })).status).toBe(403);
    }
  });
});

describe('sesiones propias', () => {
  test('lista las sesiones abiertas y revoca otra sin tocar la actual', async () => {
    const a = await p.entrarComo('sesiones@antidoto.co', 'comercial');
    const b = await p.entrarComo('sesiones@antidoto.co', 'comercial');
    const lista = (await (await p.llamar('/admin/api/yo/sesiones', { headers: { cookie: a } })).json()) as { sesiones: { id: string; actual: boolean }[] };
    expect(lista.sesiones).toHaveLength(2);
    expect(lista.sesiones.filter((s) => s.actual)).toHaveLength(1);
    expect(lista.sesiones[0]).not.toHaveProperty('hash');
    const otra = lista.sesiones.find((s) => !s.actual)!;
    expect((await p.conSesion(a, `/admin/api/yo/sesiones/${otra.id}/revocar`, { method: 'POST' })).status).toBe(200);
    expect((await p.llamar('/admin/api/yo', { headers: { cookie: b } })).status).toBe(401);
    expect((await p.llamar('/admin/api/yo', { headers: { cookie: a } })).status).toBe(200);
  });

  test('no se puede revocar la sesión de otra persona', async () => {
    const ajena = await p.entrarComo('ajena@antidoto.co', 'lectura');
    const propia = await p.entrarComo('propia@antidoto.co', 'lectura');
    const lista = (await (await p.llamar('/admin/api/yo/sesiones', { headers: { cookie: ajena } })).json()) as { sesiones: { id: string }[] };
    const r = await p.conSesion(propia, `/admin/api/yo/sesiones/${lista.sesiones[0]!.id}/revocar`, { method: 'POST' });
    expect(r.status).toBe(404);
    expect((await p.llamar('/admin/api/yo', { headers: { cookie: ajena } })).status).toBe(200);
  });
});

describe('ajustes', () => {
  test('valida por clave', () => {
    expect(validarAjustes({ 'asesor.tope_diario_usd': 2.5 })).toEqual({ ok: true, cambios: { 'asesor.tope_diario_usd': 2.5 } });
    expect(validarAjustes({ 'asesor.tope_diario_usd': 99 })).toEqual({ ok: false, errores: ['asesor.tope_diario_usd'] });
    expect(validarAjustes({ 'otra.cosa': 1 })).toEqual({ ok: false, errores: ['otra.cosa'] });
    expect(validarAjustes({ 'asesor.activo': 'si' })).toEqual({ ok: false, errores: ['asesor.activo'] });
    expect(validarAjustes({})).toEqual({ ok: false, errores: ['vacio'] });
  });

  test('el admin cambia el tope, queda en la auditoría y null vuelve al defecto', async () => {
    const admin = await p.entrarComo('ajustes@antidoto.co', 'admin');
    const r = await p.conSesion(admin, '/admin/api/configuracion', { method: 'PUT', body: JSON.stringify({ 'asesor.tope_diario_usd': 3 }) });
    expect(((await r.json()) as { ajustes: Record<string, unknown> }).ajustes['asesor.tope_diario_usd']).toBe(3);
    const reg = await p.env.DB.prepare("select usuario_email, detalle from auditoria where accion = 'config.cambiar' order by creado desc").first<{ usuario_email: string; detalle: string }>();
    expect(reg).toEqual({ usuario_email: 'ajustes@antidoto.co', detalle: JSON.stringify({ 'asesor.tope_diario_usd': 3 }) });
    const vuelta = await p.conSesion(admin, '/admin/api/configuracion', { method: 'PUT', body: JSON.stringify({ 'asesor.tope_diario_usd': null }) });
    expect(((await vuelta.json()) as { ajustes: Record<string, unknown> }).ajustes['asesor.tope_diario_usd']).toBe(null);
  });
});

describe('auditoría', () => {
  test('editar un lead deja registro sin datos personales', async () => {
    const t = Date.now();
    const id = '00000000-0000-4000-8000-0000000000a1';
    await p.env.DB.prepare("insert into leads (id, creado, actualizado, estado, servicio, nombre, email, locale) values (?, ?, ?, 'nuevo', 'catering', 'Ana Pérez', 'ana@demo.co', 'es')")
      .bind(id, t, t)
      .run();
    const c = await p.entrarComo('auditor@antidoto.co', 'admin');
    const r = await p.conSesion(c, `/admin/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ estado: 'contactado', notas: 'Llamé a Ana al 3001234567' }) });
    expect(r.status).toBe(200);
    const lista = (await (await p.llamar(`/admin/api/auditoria?entidad=lead&entidadId=${id}`, { headers: { cookie: c } })).json()) as {
      registros: { accion: string; detalle: Record<string, unknown>; usuarioEmail: string }[];
    };
    expect(lista.registros).toHaveLength(1);
    expect(lista.registros[0]).toMatchObject({ accion: 'lead.editar', usuarioEmail: 'auditor@antidoto.co', detalle: { estado: 'contactado', campos: ['estado', 'notas'] } });
    expect(JSON.stringify(lista.registros)).not.toMatch(/Ana|3001234567/);
    expect(lista.registros[0]).not.toHaveProperty('ipHash');
  });

  test('un cambio que falla no se registra', async () => {
    const c = await p.entrarComo('auditor@antidoto.co', 'admin');
    await p.conSesion(c, '/admin/api/leads/00000000-0000-4000-8000-0000000000ff', { method: 'PATCH', body: '{"estado":"ganado"}' });
    const n = await p.env.DB.prepare("select count(*) as n from auditoria where entidad_id = '00000000-0000-4000-8000-0000000000ff'").first<number>('n');
    expect(n).toBe(0);
  });
});
