// API del portal de proyectos (clientes). Todo pasa por la sesión del cliente y se filtra por su
// organización: un cliente nunca ve proyectos de otra, ni el valor, las notas internas, las
// tareas o entregables no marcados como visibles.
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { proyectos, etapas, tareas, entregables, archivosEntregable, bitacora, usuarios } from '../db/schema';
import type { Env } from '../env';
import { enviar, correoRespuestaCliente } from '../correo';
import { respuestaArchivo } from '../rutas/proyectos';
import { ahora, json, uuid } from '../util';
import { salirCliente, type SesionCliente } from './auth';

const U = '([0-9a-f-]{36})';

interface CtxPortal {
  req: Request;
  ruta: string;
  metodo: string;
  env: Env;
  db: DrizzleD1Database;
  sesion: SesionCliente;
  appUrl: string;
  diferir: (p: Promise<unknown>) => void;
}

export async function rutasPortal(c: CtxPortal): Promise<Response> {
  const { ruta, metodo, sesion } = c;
  let m: RegExpMatchArray | null;
  if (ruta === '/portal/auth/salir' && metodo === 'POST') return salirCliente(c.db, sesion);
  if (ruta === '/portal/api/yo' && metodo === 'GET') return json({ nombre: sesion.usuario.nombre, email: sesion.usuario.email, organizacion: sesion.organizacion.nombre });
  if (ruta === '/portal/api/proyectos' && metodo === 'GET') return listar(c);
  if ((m = ruta.match(new RegExp(`^/portal/api/proyectos/${U}$`))) && metodo === 'GET') return ver(c, m[1]!);
  if ((m = ruta.match(new RegExp(`^/portal/api/proyectos/${U}/comentar$`))) && metodo === 'POST') return comentar(c, m[1]!);
  if ((m = ruta.match(new RegExp(`^/portal/api/entregables/${U}/(aprobar|cambios)$`))) && metodo === 'POST') return responder(c, m[1]!, m[2] as 'aprobar' | 'cambios');
  if ((m = ruta.match(new RegExp(`^/portal/api/archivos/${U}$`))) && metodo === 'GET') return archivo(c, m[1]!);
  return json({ error: 'no existe' }, 404);
}

async function listar(c: CtxPortal): Promise<Response> {
  const filas = await c.db
    .select({
      id: proyectos.id,
      codigo: proyectos.codigo,
      nombre: proyectos.nombre,
      linea: proyectos.linea,
      estado: proyectos.estado,
      inicio: proyectos.inicio,
      entrega: proyectos.entrega,
      etapas: sql<number>`(select count(*) from proyecto_etapas e where e.proyecto_id = proyectos.id)`,
      hechas: sql<number>`(select count(*) from proyecto_etapas e where e.proyecto_id = proyectos.id and e.estado = 'hecha')`,
      porRevisar: sql<number>`(select count(*) from entregables e where e.proyecto_id = proyectos.id and e.visible_cliente = 1 and e.estado = 'en_revision')`,
    })
    .from(proyectos)
    .where(and(eq(proyectos.organizacionId, c.sesion.organizacion.id), ne(proyectos.estado, 'cancelado')))
    .orderBy(desc(proyectos.actualizado));
  return json({ proyectos: filas });
}

/** El proyecto si es de la organización del cliente y no está cancelado; si no, null (404, sin distinguir). */
async function proyectoPropio(c: CtxPortal, id: string) {
  const [p] = await c.db
    .select()
    .from(proyectos)
    .where(and(eq(proyectos.id, id), eq(proyectos.organizacionId, c.sesion.organizacion.id), ne(proyectos.estado, 'cancelado')));
  return p ?? null;
}

async function ver(c: CtxPortal, id: string): Promise<Response> {
  const p = await proyectoPropio(c, id);
  if (!p) return json({ error: 'no existe' }, 404);
  const [ets, tas, ens, bit, resp] = await Promise.all([
    c.db.select({ id: etapas.id, nombre: etapas.nombre, estado: etapas.estado, fecha: etapas.fecha }).from(etapas).where(eq(etapas.proyectoId, id)).orderBy(asc(etapas.orden)),
    c.db
      .select({ id: tareas.id, titulo: tareas.titulo, hecha: tareas.hecha, vence: tareas.vence })
      .from(tareas)
      .where(and(eq(tareas.proyectoId, id), eq(tareas.visibleCliente, true))),
    c.db
      .select({ id: entregables.id, titulo: entregables.titulo, descripcion: entregables.descripcion, estado: entregables.estado, vence: entregables.vence, version: entregables.version, aprobadoPor: entregables.aprobadoPor, aprobadoEn: entregables.aprobadoEn })
      .from(entregables)
      .where(and(eq(entregables.proyectoId, id), eq(entregables.visibleCliente, true)))
      .orderBy(asc(entregables.creado)),
    c.db
      .select({ id: bitacora.id, creado: bitacora.creado, autorTipo: bitacora.autorTipo, autor: bitacora.autor, texto: bitacora.texto })
      .from(bitacora)
      .where(and(eq(bitacora.proyectoId, id), eq(bitacora.visibleCliente, true)))
      .orderBy(desc(bitacora.creado))
      .limit(100),
    p.responsableId ? c.db.select({ nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.id, p.responsableId)) : Promise.resolve([]),
  ]);
  const archivos = ens.length
    ? await c.db
        .select({ id: archivosEntregable.id, entregableId: archivosEntregable.entregableId, nombre: archivosEntregable.nombre, bytes: archivosEntregable.bytes, version: archivosEntregable.version, subido: archivosEntregable.subido })
        .from(archivosEntregable)
        .where(inArray(archivosEntregable.entregableId, ens.map((e) => e.id)))
        .orderBy(desc(archivosEntregable.subido))
    : [];
  return json({
    proyecto: { id: p.id, codigo: p.codigo, nombre: p.nombre, linea: p.linea, estado: p.estado, inicio: p.inicio, entrega: p.entrega, responsable: resp[0]?.nombre ?? null },
    etapas: ets,
    tareas: tas,
    entregables: ens.map((e) => ({ ...e, archivos: archivos.filter((a) => a.entregableId === e.id) })),
    // Las notas del equipo salen con el nombre de pila de quien escribe, no con su correo.
    bitacora: bit.map((b) => ({ ...b, autor: b.autorTipo === 'cliente' ? b.autor : b.autorTipo === 'equipo' ? 'Equipo de Antídoto' : null })),
  });
}

async function avisarResponsable(c: CtxPortal, proyectoId: string, d: Omit<Parameters<typeof correoRespuestaCliente>[0], 'quien' | 'enlace' | 'proyecto'>) {
  const [p] = await c.db.select({ nombre: proyectos.nombre, responsableId: proyectos.responsableId }).from(proyectos).where(eq(proyectos.id, proyectoId));
  const [r] = p?.responsableId ? await c.db.select({ email: usuarios.email }).from(usuarios).where(and(eq(usuarios.id, p.responsableId), eq(usuarios.activo, true))) : [];
  const para = r?.email ?? c.env.MAIL_EQUIPO;
  const quien = c.sesion.usuario.nombre ? `${c.sesion.usuario.nombre} (${c.sesion.organizacion.nombre})` : `${c.sesion.usuario.email} (${c.sesion.organizacion.nombre})`;
  await enviar(c.env, { para, ...correoRespuestaCliente({ ...d, quien, proyecto: p?.nombre ?? '', enlace: `${c.appUrl}/admin/proyectos/${proyectoId}` }) });
}

async function responder(c: CtxPortal, entId: string, accion: 'aprobar' | 'cambios'): Promise<Response> {
  const [e] = await c.db
    .select({ e: entregables })
    .from(entregables)
    .innerJoin(proyectos, eq(proyectos.id, entregables.proyectoId))
    .where(and(eq(entregables.id, entId), eq(entregables.visibleCliente, true), eq(proyectos.organizacionId, c.sesion.organizacion.id)));
  if (!e) return json({ error: 'no existe' }, 404);
  if (e.e.estado !== 'en_revision') return json({ error: 'estado' }, 409);
  const d = (await c.req.json().catch(() => ({}))) as { comentario?: unknown };
  const comentario = typeof d.comentario === 'string' && d.comentario.trim() ? d.comentario.trim().slice(0, 2000) : null;
  if (accion === 'cambios' && !comentario) return json({ errores: { comentario: 'Cuéntale al equipo qué cambiar' } }, 422);
  const t = ahora();
  const quien = c.sesion.usuario.nombre ?? c.sesion.usuario.email;
  await c.db.batch([
    c.db
      .update(entregables)
      .set(accion === 'aprobar' ? { estado: 'aprobado', aprobadoPor: quien, aprobadoEn: t, actualizado: t } : { estado: 'cambios', actualizado: t })
      .where(eq(entregables.id, entId)),
    c.db.insert(bitacora).values({
      id: uuid(),
      proyectoId: e.e.proyectoId,
      creado: t,
      autorTipo: 'cliente',
      autor: quien,
      tipo: accion === 'aprobar' ? 'aprobado' : 'cambios',
      texto: accion === 'aprobar' ? `Aprobó ${e.e.titulo}${comentario ? `: ${comentario}` : '.'}` : `Pidió cambios en ${e.e.titulo}: ${comentario}`,
      visibleCliente: true,
    }),
    c.db.update(proyectos).set({ actualizado: t }).where(eq(proyectos.id, e.e.proyectoId)),
  ]);
  c.diferir(avisarResponsable(c, e.e.proyectoId, { accion: accion === 'aprobar' ? 'aprobado' : 'cambios', entregable: e.e.titulo, texto: comentario }).catch((x) => console.error('[portal] aviso', x)));
  return ver(c, e.e.proyectoId);
}

async function comentar(c: CtxPortal, id: string): Promise<Response> {
  const p = await proyectoPropio(c, id);
  if (!p) return json({ error: 'no existe' }, 404);
  const d = (await c.req.json().catch(() => ({}))) as { texto?: unknown };
  const texto = typeof d.texto === 'string' && d.texto.trim() ? d.texto.trim().slice(0, 2000) : null;
  if (!texto) return json({ errores: { texto: 'Escribe tu comentario' } }, 422);
  const t = ahora();
  await c.db.batch([
    c.db.insert(bitacora).values({ id: uuid(), proyectoId: id, creado: t, autorTipo: 'cliente', autor: c.sesion.usuario.nombre ?? c.sesion.usuario.email, tipo: 'comentario', texto, visibleCliente: true }),
    c.db.update(proyectos).set({ actualizado: t }).where(eq(proyectos.id, id)),
  ]);
  c.diferir(avisarResponsable(c, id, { accion: 'comentario', texto }).catch((x) => console.error('[portal] aviso', x)));
  return ver(c, id);
}

async function archivo(c: CtxPortal, id: string): Promise<Response> {
  const [a] = await c.db
    .select({ a: archivosEntregable })
    .from(archivosEntregable)
    .innerJoin(entregables, eq(entregables.id, archivosEntregable.entregableId))
    .innerJoin(proyectos, eq(proyectos.id, entregables.proyectoId))
    .where(and(eq(archivosEntregable.id, id), eq(entregables.visibleCliente, true), eq(proyectos.organizacionId, c.sesion.organizacion.id), ne(proyectos.estado, 'cancelado')));
  return a ? respuestaArchivo(c.env, a.a) : json({ error: 'no existe' }, 404);
}
