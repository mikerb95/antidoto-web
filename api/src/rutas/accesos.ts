// Accesos de los clientes al portal de proyectos, desde el panel (permiso portal.gestionar), y el
// aviso por correo cuando un entregable visible pasa a revisión.
import { and, eq, isNull } from 'drizzle-orm';
import { usuariosCliente, sesionesCliente, contactosCliente, organizaciones, proyectos, entregables } from '../db/schema';
import { enviar, correoInvitacionPortal, correoEntregableEnRevision } from '../correo';
import { ahora, json, uuid } from '../util';
import { auditar, sinPermiso, type Ctx } from './contexto';
import { cuandoPaseARevision } from './proyectos';

const U = '([0-9a-f-]{36})';

export async function rutasAccesos(c: Ctx): Promise<Response | null> {
  let m: RegExpMatchArray | null;
  if ((m = c.ruta.match(new RegExp(`^/admin/api/organizaciones/${U}/accesos$`)))) {
    const no = sinPermiso(c, 'portal.gestionar');
    if (no) return no;
    if (c.metodo === 'GET') return listar(c, m[1]!);
    if (c.metodo === 'POST') return invitar(c, m[1]!);
  }
  if ((m = c.ruta.match(new RegExp(`^/admin/api/accesos/${U}/(quitar|devolver)$`))) && c.metodo === 'POST') return sinPermiso(c, 'portal.gestionar') ?? cambiar(c, m[1]!, m[2] === 'devolver');
  return null;
}

async function listar(c: Ctx, orgId: string): Promise<Response> {
  const filas = await c.db.select().from(usuariosCliente).where(eq(usuariosCliente.organizacionId, orgId)).orderBy(usuariosCliente.creado);
  return json({ accesos: filas, portal: `${c.appUrl}/portal/` });
}

async function invitar(c: Ctx, orgId: string): Promise<Response> {
  const d = (await c.req.json().catch(() => ({}))) as { contactoId?: unknown };
  const [contacto] = typeof d.contactoId === 'string' ? await c.db.select().from(contactosCliente).where(and(eq(contactosCliente.id, d.contactoId), eq(contactosCliente.organizacionId, orgId))) : [];
  if (!contacto?.email) return json({ errores: { contactoId: 'Elige un contacto con correo' } }, 422);
  const [org] = await c.db.select({ nombre: organizaciones.nombre }).from(organizaciones).where(eq(organizaciones.id, orgId));
  const [existe] = await c.db.select().from(usuariosCliente).where(eq(usuariosCliente.email, contacto.email));
  if (existe && existe.organizacionId !== orgId) return json({ error: 'otra_organizacion' }, 409);
  if (existe) await c.db.update(usuariosCliente).set({ activo: true }).where(eq(usuariosCliente.id, existe.id));
  else
    await c.db.insert(usuariosCliente).values({ id: uuid(), organizacionId: orgId, contactoId: contacto.id, email: contacto.email, nombre: contacto.nombre, activo: true, creado: ahora(), ultimoAcceso: null });
  c.diferir(enviar(c.env, { para: contacto.email, ...correoInvitacionPortal({ nombre: contacto.nombre, organizacion: org?.nombre ?? '', enlace: `${c.appUrl}/portal/` }) }));
  return auditar(c, await listar(c, orgId), 'portal.invitar', 'organizacion', orgId);
}

async function cambiar(c: Ctx, id: string, activo: boolean): Promise<Response> {
  const [u] = await c.db.update(usuariosCliente).set({ activo }).where(eq(usuariosCliente.id, id)).returning({ org: usuariosCliente.organizacionId });
  if (!u) return json({ error: 'no existe' }, 404);
  // Quitar el acceso cierra sus sesiones abiertas.
  if (!activo) await c.db.update(sesionesCliente).set({ revocada: ahora() }).where(and(eq(sesionesCliente.usuarioId, id), isNull(sesionesCliente.revocada)));
  return auditar(c, await listar(c, u.org), activo ? 'portal.invitar' : 'portal.quitar', 'organizacion', u.org);
}

// Un entregable visible que pasa a revisión avisa a los usuarios activos del portal de la organización.
cuandoPaseARevision(async (c, proyectoId, entregableId) => {
  const [p] = await c.db.select({ nombre: proyectos.nombre, org: proyectos.organizacionId }).from(proyectos).where(eq(proyectos.id, proyectoId));
  const [e] = await c.db.select({ titulo: entregables.titulo }).from(entregables).where(eq(entregables.id, entregableId));
  if (!p || !e) return;
  const destinatarios = await c.db.select({ email: usuariosCliente.email }).from(usuariosCliente).where(and(eq(usuariosCliente.organizacionId, p.org), eq(usuariosCliente.activo, true)));
  for (const d of destinatarios) await enviar(c.env, { para: d.email, ...correoEntregableEnRevision({ proyecto: p.nombre, entregable: e.titulo, enlace: `${c.appUrl}/portal/proyectos/${proyectoId}` }) });
});
