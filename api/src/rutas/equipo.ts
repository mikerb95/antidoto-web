// Equipo, cuenta propia, ajustes y auditoría.
import { listarUsuarios, crearUsuario, editarUsuario } from '../admin';
import { listarSesiones, revocarSesion, salir } from '../auth';
import { listarAuditoria } from '../auditoria';
import { leerAjustes, validarAjustes, guardarAjustes } from '../configuracion';
import { permisosDe } from '../permisos';
import { json } from '../util';
import { auditar, cuerpoJson, sinPermiso, type Ctx } from './contexto';

const RE_USUARIO = /^\/admin\/api\/usuarios\/([0-9a-f-]{36})$/;
const RE_SESION = /^\/admin\/api\/yo\/sesiones\/([0-9a-f-]{36})\/revocar$/;

export async function rutasEquipo(c: Ctx): Promise<Response | null> {
  const { ruta, metodo, url, db, req, sesion } = c;

  if (ruta === '/auth/salir' && metodo === 'POST') return salir(db, sesion, url.searchParams.has('todas'));
  if (ruta === '/admin/api/yo' && metodo === 'GET') {
    const { id, email, nombre, rol } = sesion.usuario;
    return json({ id, email, nombre, rol, permisos: permisosDe(rol) });
  }
  if (ruta === '/admin/api/yo/sesiones' && metodo === 'GET') return listarSesiones(db, sesion);
  const s = ruta.match(RE_SESION);
  if (s && metodo === 'POST') return auditar(c, await revocarSesion(db, sesion, s[1]!), 'sesion.revocar', 'sesion', s[1]!);

  if (ruta === '/admin/api/usuarios' && metodo === 'GET') return listarUsuarios(db);
  if (ruta === '/admin/api/usuarios' && metodo === 'POST') {
    const no = sinPermiso(c, 'equipo.gestionar');
    if (no) return no;
    const d = await cuerpoJson(req);
    return auditar(c, await crearUsuario(req, db), 'usuario.crear', 'usuario', null, { rol: d.rol ?? null });
  }
  const u = ruta.match(RE_USUARIO);
  if (u && metodo === 'PATCH') {
    const no = sinPermiso(c, 'equipo.gestionar');
    if (no) return no;
    const d = await cuerpoJson(req);
    const detalle = Object.fromEntries(['rol', 'activo'].filter((k) => k in d).map((k) => [k, d[k]]));
    return auditar(c, await editarUsuario(u[1]!, req, db, sesion), 'usuario.editar', 'usuario', u[1]!, detalle);
  }

  if (ruta === '/admin/api/configuracion' && metodo === 'GET') return json({ ajustes: await leerAjustes(db) });
  if (ruta === '/admin/api/configuracion' && metodo === 'PUT') {
    const no = sinPermiso(c, 'config.editar');
    if (no) return no;
    const r = validarAjustes(await req.json().catch(() => null));
    if (!r.ok) return json({ errores: r.errores }, 422);
    await guardarAjustes(db, r.cambios, sesion.usuario.email);
    return auditar(c, json({ ajustes: await leerAjustes(db) }), 'config.cambiar', 'configuracion', null, r.cambios);
  }

  if (ruta === '/admin/api/auditoria' && metodo === 'GET') return sinPermiso(c, 'auditoria.ver') ?? listarAuditoria(url, db);
  return null;
}
