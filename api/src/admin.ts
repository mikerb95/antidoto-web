// API de la bandeja de leads. Todo pasa por una sesión válida; lo que cambia datos exige
// además el mismo origen (ver index.ts). Cada cambio queda en lead_eventos con su autor.
import { and, desc, eq, gte, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { leads, eventos, consentimientos, usuarios, ESTADOS, SERVICIOS, ROLES, type Estado, type Lead } from './db/schema';
import type { Sesion } from './auth';
import { ahora, uuid, json, DIA } from './util';

const POR_PAGINA = 50;

export async function listarLeads(url: URL, db: DrizzleD1Database): Promise<Response> {
  const p = url.searchParams;
  const filtros: SQL[] = [];
  const estado = p.get('estado');
  if (estado && ESTADOS.includes(estado as Estado)) filtros.push(eq(leads.estado, estado as Estado));
  const servicio = p.get('servicio');
  if (servicio && SERVICIOS.includes(servicio as Lead['servicio'])) filtros.push(eq(leads.servicio, servicio as Lead['servicio']));
  const q = p.get('q')?.trim().slice(0, 80);
  if (q) {
    const patron = `%${q.replace(/[%_]/g, '')}%`;
    filtros.push(or(like(leads.nombre, patron), like(leads.empresa, patron), like(leads.email, patron), like(leads.telefono, patron))!);
  }
  const pagina = Math.max(0, Number(p.get('pagina')) || 0);
  const donde = filtros.length ? and(...filtros) : undefined;

  const [filas, [total]] = await Promise.all([
    db.select().from(leads).where(donde).orderBy(desc(leads.creado)).limit(POR_PAGINA).offset(pagina * POR_PAGINA),
    db.select({ n: sql<number>`count(*)` }).from(leads).where(donde),
  ]);
  return json({ leads: filas.map(sinIp), total: total?.n ?? 0, pagina, porPagina: POR_PAGINA });
}

const sinIp = ({ ipHash: _, ...resto }: Lead) => resto;

export async function verLead(id: string, db: DrizzleD1Database): Promise<Response> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return json({ error: 'no existe' }, 404);
  const [hist, cons] = await Promise.all([
    db.select().from(eventos).where(eq(eventos.leadId, id)).orderBy(desc(eventos.creado)),
    db
      .select({ version: consentimientos.version, texto: consentimientos.texto, aceptado: consentimientos.aceptado, revocado: consentimientos.revocado })
      .from(consentimientos)
      .where(eq(consentimientos.leadId, id)),
  ]);
  return json({ lead: sinIp(lead), eventos: hist, consentimientos: cons });
}

export interface Cambios {
  estado?: Estado;
  notas?: string | null;
  valorEstimado?: number | null;
  motivoPerdida?: string | null;
}

/** Valida el cuerpo del PATCH. Función pura. */
export function validarCambios(d: unknown): { ok: true; cambios: Cambios } | { ok: false; errores: string[] } {
  if (!d || typeof d !== 'object') return { ok: false, errores: ['cuerpo'] };
  const e = d as Record<string, unknown>;
  const cambios: Cambios = {};
  const errores: string[] = [];
  if ('estado' in e) {
    if (ESTADOS.includes(e.estado as Estado)) cambios.estado = e.estado as Estado;
    else errores.push('estado');
  }
  if ('notas' in e) {
    if (e.notas === null || typeof e.notas === 'string') cambios.notas = (e.notas as string | null)?.trim().slice(0, 5000) || null;
    else errores.push('notas');
  }
  if ('valorEstimado' in e) {
    const v = e.valorEstimado;
    if (v === null || v === '') cambios.valorEstimado = null;
    else if (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < 1e13) cambios.valorEstimado = Number(v);
    else errores.push('valorEstimado');
  }
  if ('motivoPerdida' in e) {
    if (e.motivoPerdida === null || typeof e.motivoPerdida === 'string') cambios.motivoPerdida = (e.motivoPerdida as string | null)?.trim().slice(0, 300) || null;
    else errores.push('motivoPerdida');
  }
  if (!Object.keys(cambios).length && !errores.length) errores.push('vacio');
  return errores.length ? { ok: false, errores } : { ok: true, cambios };
}

export async function editarLead(id: string, req: Request, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  const r = validarCambios(await req.json().catch(() => null));
  if (!r.ok) return json({ errores: r.errores }, 422);
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return json({ error: 'no existe' }, 404);
  if (lead.anonimizado) return json({ error: 'anonimizado' }, 409);

  const t = ahora();
  const c = r.cambios;
  const set: Partial<Lead> = { ...c, actualizado: t };
  const registros: (typeof eventos.$inferInsert)[] = [];
  const evento = (tipo: 'estado' | 'nota' | 'edicion', detalle: string) =>
    registros.push({ id: uuid(), leadId: id, creado: t, tipo, detalle, autor: sesion.usuario.email });

  if (c.estado && c.estado !== lead.estado) {
    evento('estado', `${lead.estado} → ${c.estado}`);
    if (lead.estado === 'nuevo' && !lead.primeraRespuesta) set.primeraRespuesta = t;
  }
  // El motivo de pérdida solo tiene sentido en "perdido"; al reabrir se limpia.
  const estadoFinal = c.estado ?? lead.estado;
  if (estadoFinal !== 'perdido') set.motivoPerdida = null;
  if (c.notas !== undefined && c.notas !== lead.notas) evento('nota', c.notas ?? '');
  if (c.valorEstimado !== undefined && c.valorEstimado !== lead.valorEstimado) evento('edicion', `valor estimado: ${c.valorEstimado ?? 'sin valor'}`);
  if (set.motivoPerdida !== undefined && set.motivoPerdida !== lead.motivoPerdida && set.motivoPerdida) evento('edicion', `motivo de pérdida: ${set.motivoPerdida}`);

  await db.batch([db.update(leads).set(set).where(eq(leads.id, id)), ...registros.map((e) => db.insert(eventos).values(e))]);
  return verLead(id, db);
}

/**
 * Supresión (Ley 1581): borra los datos personales del lead y revoca su consentimiento.
 * Se conservan servicio, fechas y estado para las métricas, sin nada que identifique a nadie.
 */
export async function anonimizarLead(id: string, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  if (sesion.usuario.rol !== 'admin') return json({ error: 'rol' }, 403);
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return json({ error: 'no existe' }, 404);
  if (lead.anonimizado) return verLead(id, db);
  const t = ahora();
  await db.batch([
    db
      .update(leads)
      .set({ nombre: null, empresa: null, email: null, telefono: null, ciudad: null, mensaje: null, notas: null, ipHash: null, anonimizado: t, actualizado: t })
      .where(eq(leads.id, id)),
    db.update(consentimientos).set({ revocado: t, ipHash: null, userAgent: null }).where(and(eq(consentimientos.leadId, id), isNull(consentimientos.revocado))),
    // Las notas del historial pueden tener datos personales: se vacían.
    db.update(eventos).set({ detalle: null }).where(and(eq(eventos.leadId, id), eq(eventos.tipo, 'nota'))),
    db.insert(eventos).values({ id: uuid(), leadId: id, creado: t, tipo: 'anonimizado', detalle: null, autor: sesion.usuario.email }),
  ]);
  return verLead(id, db);
}

/** Métricas de los últimos N días (90 por defecto): embudo, servicios, origen y tiempos. */
export async function metricas(url: URL, db: DrizzleD1Database): Promise<Response> {
  const dias = Math.min(730, Math.max(7, Number(url.searchParams.get('dias')) || 90));
  const desde = ahora() - dias * DIA;
  const rango = gte(leads.creado, desde);
  const origen = sql<string>`coalesce(${leads.utmSource}, ${leads.referente}, 'directo')`;
  const mes = sql<string>`strftime('%Y-%m', ${leads.creado} / 1000, 'unixepoch', '-5 hours')`;

  const [porEstado, porServicio, porOrigen, porMes, tiempos] = await Promise.all([
    db.select({ clave: leads.estado, n: sql<number>`count(*)` }).from(leads).where(rango).groupBy(leads.estado),
    db
      .select({
        clave: leads.servicio,
        n: sql<number>`count(*)`,
        ganados: sql<number>`sum(case when ${leads.estado} = 'ganado' then 1 else 0 end)`,
        valorGanado: sql<number>`coalesce(sum(case when ${leads.estado} = 'ganado' then ${leads.valorEstimado} end), 0)`,
      })
      .from(leads)
      .where(rango)
      .groupBy(leads.servicio),
    db.select({ clave: origen, n: sql<number>`count(*)` }).from(leads).where(rango).groupBy(origen).orderBy(desc(sql`count(*)`)).limit(10),
    db.select({ clave: mes, n: sql<number>`count(*)` }).from(leads).where(rango).groupBy(mes).orderBy(mes),
    db
      .select({ ms: sql<number>`${leads.primeraRespuesta} - ${leads.creado}` })
      .from(leads)
      .where(and(rango, sql`${leads.primeraRespuesta} is not null`)),
  ]);

  const cuenta = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<Estado, number>;
  porEstado.forEach((f) => (cuenta[f.clave] = f.n));
  const total = Object.values(cuenta).reduce((a, b) => a + b, 0);
  const cerrados = cuenta.ganado + cuenta.perdido;
  return json({
    dias,
    total,
    porEstado: cuenta,
    tasaCierre: cerrados ? cuenta.ganado / cerrados : null,
    horasPrimeraRespuesta: mediana(tiempos.map((f) => f.ms / 3_600_000)),
    porServicio,
    porOrigen,
    porMes,
  });
}

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/** Celda CSV segura: comillas escapadas y sin fórmulas (evita inyección al abrir en Excel). */
export function celdaCsv(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportarCsv(db: DrizzleD1Database): Promise<Response> {
  const filas = await db.select().from(leads).orderBy(desc(leads.creado));
  const cols: (keyof Lead)[] = [
    'creado', 'estado', 'servicio', 'nombre', 'empresa', 'email', 'telefono', 'tipoOrganizacion', 'fecha', 'personas', 'ciudad',
    'valorEstimado', 'motivoPerdida', 'utmSource', 'utmMedium', 'utmCampaign', 'referente', 'pagina', 'locale', 'notas',
  ];
  const fecha = (ms: number) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
  const cuerpo = [cols.join(','), ...filas.map((l) => cols.map((c) => celdaCsv(c === 'creado' ? fecha(l.creado) : l[c])).join(','))].join('\r\n');
  return new Response('﻿' + cuerpo, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="leads-antidoto-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

// Equipo: solo el rol admin agrega o desactiva personas.
export async function listarUsuarios(db: DrizzleD1Database): Promise<Response> {
  return json({ usuarios: await db.select().from(usuarios).orderBy(usuarios.creado) });
}

export async function crearUsuario(req: Request, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  if (sesion.usuario.rol !== 'admin') return json({ error: 'rol' }, 403);
  const d = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
  const nombre = typeof d.nombre === 'string' ? d.nombre.trim().slice(0, 120) : '';
  const rol = ROLES.includes(d.rol as (typeof ROLES)[number]) ? (d.rol as (typeof ROLES)[number]) : 'equipo';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !nombre) return json({ errores: ['email', 'nombre'] }, 422);
  const [existe] = await db.select().from(usuarios).where(eq(usuarios.email, email));
  if (existe) return json({ error: 'existe' }, 409);
  await db.insert(usuarios).values({ id: uuid(), email, nombre, rol, activo: true, creado: ahora() });
  return listarUsuarios(db);
}

export async function editarUsuario(id: string, req: Request, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  if (sesion.usuario.rol !== 'admin') return json({ error: 'rol' }, 403);
  if (id === sesion.usuario.id) return json({ error: 'propio' }, 409);
  const d = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const set: Partial<typeof usuarios.$inferInsert> = {};
  if (typeof d.activo === 'boolean') set.activo = d.activo;
  if (ROLES.includes(d.rol as (typeof ROLES)[number])) set.rol = d.rol as (typeof ROLES)[number];
  if (!Object.keys(set).length) return json({ errores: ['vacio'] }, 422);
  await db.update(usuarios).set(set).where(eq(usuarios.id, id));
  return listarUsuarios(db);
}
