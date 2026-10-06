// Bitácora de auditoría del panel. Se escribe después de cada cambio que salió bien, sin datos
// personales en el detalle (solo ids, nombres de campos y valores de catálogo).
import { and, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { auditoria } from './db/schema';
import type { Sesion } from './auth';
import { ahora, uuid, json } from './util';

const POR_PAGINA = 50;

export function registrar(
  db: DrizzleD1Database,
  sesion: Sesion | null,
  accion: string,
  entidad: string | null = null,
  entidadId: string | null = null,
  detalle: Record<string, unknown> | null = null,
  ipHash: string | null = null,
) {
  return db.insert(auditoria).values({
    id: uuid(),
    creado: ahora(),
    usuarioId: sesion?.usuario.id ?? null,
    usuarioEmail: sesion?.usuario.email ?? null,
    accion,
    entidad,
    entidadId,
    detalle,
    ipHash,
  });
}

/** GET /admin/api/auditoria?entidad=&entidadId=&usuario=&accion=&desde=&hasta=&pagina= */
export async function listarAuditoria(url: URL, db: DrizzleD1Database): Promise<Response> {
  const p = url.searchParams;
  const filtros: SQL[] = [];
  const entidad = p.get('entidad');
  if (entidad) filtros.push(eq(auditoria.entidad, entidad.slice(0, 40)));
  const entidadId = p.get('entidadId');
  if (entidadId) filtros.push(eq(auditoria.entidadId, entidadId.slice(0, 80)));
  const usuario = p.get('usuario');
  if (usuario) filtros.push(eq(auditoria.usuarioId, usuario.slice(0, 80)));
  const accion = p.get('accion');
  if (accion) filtros.push(sql`${auditoria.accion} like ${accion.replace(/[%_]/g, '').slice(0, 40) + '%'}`);
  const desde = Number(p.get('desde'));
  if (desde > 0) filtros.push(gte(auditoria.creado, desde));
  const hasta = Number(p.get('hasta'));
  if (hasta > 0) filtros.push(lt(auditoria.creado, hasta));
  const pagina = Math.max(0, Number(p.get('pagina')) || 0);
  const donde = filtros.length ? and(...filtros) : undefined;
  const [filas, [total]] = await Promise.all([
    db.select().from(auditoria).where(donde).orderBy(desc(auditoria.creado)).limit(POR_PAGINA).offset(pagina * POR_PAGINA),
    db.select({ n: sql<number>`count(*)` }).from(auditoria).where(donde),
  ]);
  return json({ registros: filas.map(({ ipHash: _, ...r }) => r), total: total?.n ?? 0, pagina, porPagina: POR_PAGINA });
}
