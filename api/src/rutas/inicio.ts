// Resumen de Inicio y buscador global del panel. Cada bloque solo sale si el rol lo puede ver.
import { and, desc, eq, gte, inArray, like, lt, or, sql } from 'drizzle-orm';
import { leads, contactos, campanas, gastoAsesor, usuarios } from '../db/schema';
import { ajustesAsesor, hoyBogota } from '../asesor/presupuesto';
import { puede, type Permiso } from '../permisos';
import { ahora, json, DIA, HORA } from '../util';
import type { Ctx } from './contexto';

/** Bloques extra de Inicio que suman otros módulos (conversaciones, proyectos...). */
export type BloqueInicio = (c: Ctx) => Promise<Record<string, unknown> | null>;
const BLOQUES: BloqueInicio[] = [];
export const sumarBloqueInicio = (b: BloqueInicio) => BLOQUES.push(b);

export type Buscador = (c: Ctx, patron: string) => Promise<Resultado[]>;
export interface Resultado {
  tipo: string;
  id: string;
  titulo: string;
  detalle?: string | null;
  href: string;
}
const BUSCADORES: { permiso: Permiso; buscar: Buscador }[] = [];
export const sumarBuscador = (permiso: Permiso, buscar: Buscador) => BUSCADORES.push({ permiso, buscar });

const POR_TIPO = 5;

export async function rutasInicio(c: Ctx): Promise<Response | null> {
  if (c.ruta === '/admin/api/inicio' && c.metodo === 'GET') return inicio(c);
  if (c.ruta === '/admin/api/buscar' && c.metodo === 'GET') return buscar(c);
  return null;
}

async function inicio(c: Ctx): Promise<Response> {
  const { db, env, sesion } = c;
  const rol = sesion.usuario.rol;
  const t = ahora();
  const r: Record<string, unknown> = {};
  const tareas: Promise<void>[] = [];

  if (puede(rol, 'leads.ver')) {
    const horas = Number(env.HORAS_SEGUIMIENTO) || 24;
    tareas.push(
      (async () => {
        const [sinRespuesta, semana, recientes, [abiertos]] = await Promise.all([
          db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.estado, 'nuevo'), lt(leads.creado, t - horas * HORA), sql`${leads.anonimizado} is null`)),
          db.select({ n: sql<number>`count(*)` }).from(leads).where(gte(leads.creado, t - 7 * DIA)),
          db
            .select({ id: leads.id, nombre: leads.nombre, empresa: leads.empresa, servicio: leads.servicio, estado: leads.estado, creado: leads.creado, anonimizado: leads.anonimizado })
            .from(leads)
            .orderBy(desc(leads.creado))
            .limit(6),
          db.select({ n: sql<number>`count(*)` }).from(leads).where(inArray(leads.estado, ['nuevo', 'contactado', 'cotizado'])),
        ]);
        r.leads = { sinRespuesta: sinRespuesta[0]?.n ?? 0, horasSeguimiento: horas, semana: semana[0]?.n ?? 0, abiertos: abiertos?.n ?? 0, recientes };
      })(),
    );
  }

  if (puede(rol, 'marketing.ver')) {
    tareas.push(
      (async () => {
        const [[activos], enCurso] = await Promise.all([
          db.select({ n: sql<number>`count(*)` }).from(contactos).where(eq(contactos.estado, 'activo')),
          db
            .select({ id: campanas.id, asunto: campanas.asunto, estado: campanas.estado, programada: campanas.programada })
            .from(campanas)
            .where(inArray(campanas.estado, ['programada', 'enviando']))
            .orderBy(campanas.programada)
            .limit(5),
        ]);
        r.novedades = { activos: activos?.n ?? 0, enCurso };
      })(),
    );
  }

  if (puede(rol, 'asesor.ver')) {
    tareas.push(
      (async () => {
        try {
          const [{ tope, activo }, [hoy]] = await Promise.all([ajustesAsesor(db, env.ASESOR_TOPE_DIARIO_USD), db.select().from(gastoAsesor).where(eq(gastoAsesor.dia, hoyBogota(t)))]);
          r.asesor = { configurado: !!env.ANTHROPIC_API_KEY, activo, tope, gastoHoy: hoy?.usd ?? 0, ...(hoy ? { hoy } : {}) };
        } catch {
          r.asesor = null;
        }
      })(),
    );
  }

  for (const b of BLOQUES) tareas.push(b(c).then((x) => void (x && Object.assign(r, x))));
  await Promise.all(tareas);
  return json(r);
}

async function buscar(c: Ctx): Promise<Response> {
  const q = (c.url.searchParams.get('q') ?? '').trim().slice(0, 80).replace(/[%_]/g, '');
  if (q.length < 2) return json({ resultados: [] });
  const patron = `%${q}%`;
  const rol = c.sesion.usuario.rol;
  const { db } = c;
  const grupos: Promise<Resultado[]>[] = [];

  if (puede(rol, 'leads.ver'))
    grupos.push(
      db
        .select({ id: leads.id, nombre: leads.nombre, empresa: leads.empresa, email: leads.email })
        .from(leads)
        .where(or(like(leads.nombre, patron), like(leads.empresa, patron), like(leads.email, patron), like(leads.telefono, patron)))
        .orderBy(desc(leads.creado))
        .limit(POR_TIPO)
        .then((f) => f.map((l) => ({ tipo: 'lead', id: l.id, titulo: l.nombre ?? 'Solicitud', detalle: [l.empresa, l.email].filter(Boolean).join(' · '), href: `/admin/solicitudes/${l.id}` }))),
    );
  if (puede(rol, 'marketing.ver')) {
    grupos.push(
      db
        .select({ id: contactos.id, email: contactos.email, nombre: contactos.nombre, empresa: contactos.empresa })
        .from(contactos)
        .where(or(like(contactos.email, patron), like(contactos.nombre, patron), like(contactos.empresa, patron)))
        .orderBy(desc(contactos.creado))
        .limit(POR_TIPO)
        .then((f) => f.map((x) => ({ tipo: 'contacto', id: x.id, titulo: x.nombre || x.email, detalle: x.nombre ? x.email : x.empresa, href: `/admin/contactos/${x.id}` }))),
    );
    grupos.push(
      db
        .select({ id: campanas.id, asunto: campanas.asunto, estado: campanas.estado })
        .from(campanas)
        .where(like(campanas.asunto, patron))
        .orderBy(desc(campanas.creada))
        .limit(POR_TIPO)
        .then((f) => f.map((x) => ({ tipo: 'campana', id: x.id, titulo: x.asunto, detalle: x.estado, href: `/admin/campanas/${x.id}` }))),
    );
  }
  grupos.push(
    db
      .select({ id: usuarios.id, nombre: usuarios.nombre, email: usuarios.email })
      .from(usuarios)
      .where(or(like(usuarios.nombre, patron), like(usuarios.email, patron)))
      .limit(POR_TIPO)
      .then((f) => f.map((u) => ({ tipo: 'usuario', id: u.id, titulo: u.nombre, detalle: u.email, href: '/admin/equipo' }))),
  );
  for (const b of BUSCADORES) if (puede(rol, b.permiso)) grupos.push(b.buscar(c, patron));
  return json({ resultados: (await Promise.all(grupos)).flat() });
}
