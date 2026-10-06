// Resumen de Inicio y buscador global del panel. Cada bloque solo sale si el rol lo puede ver.
import { and, desc, eq, gte, inArray, like, lt, or, sql } from 'drizzle-orm';
import { leads, contactos, campanas, gastoAsesor, usuarios, conversaciones, mensajesConversacion, proyectos, organizaciones, entregables } from '../db/schema';
import { ajustesAsesor, hoyBogota } from '../asesor/presupuesto';
import { puede } from '../permisos';
import { ahora, json, DIA, HORA } from '../util';
import type { Ctx } from './contexto';

export interface Resultado {
  tipo: string;
  id: string;
  titulo: string;
  detalle?: string | null;
  href: string;
}

const POR_TIPO = 5;
const ESTADO_CAMPANA: Record<string, string> = { borrador: 'Borrador', programada: 'Programada', enviando: 'Enviando', enviada: 'Enviada', cancelada: 'Cancelada' };

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
          r.asesor = {
            configurado: !!env.ANTHROPIC_API_KEY,
            activo,
            tope,
            gastoHoy: hoy?.usd ?? 0,
            conversacionesHoy: hoy?.conversaciones ?? 0,
            preguntasHoy: hoy?.preguntas ?? 0,
            derivacionesHoy: hoy?.derivaciones ?? 0,
          };
        } catch {
          r.asesor = null;
        }
      })(),
    );
  }

  if (puede(rol, 'proyectos.ver')) {
    tareas.push(
      (async () => {
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(t));
        const semana = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(t + 7 * DIA));
        const [[activos], proximos] = await Promise.all([
          db.select({ n: sql<number>`count(*)` }).from(proyectos).where(inArray(proyectos.estado, ['planeado', 'en_curso', 'en_pausa'])),
          db
            .select({ id: entregables.id, titulo: entregables.titulo, vence: entregables.vence, estado: entregables.estado, proyectoId: proyectos.id, proyecto: proyectos.nombre, codigo: proyectos.codigo })
            .from(entregables)
            .innerJoin(proyectos, eq(proyectos.id, entregables.proyectoId))
            .where(and(sql`${entregables.estado} <> 'aprobado'`, sql`${entregables.vence} is not null`, sql`${entregables.vence} <= ${semana}`, inArray(proyectos.estado, ['planeado', 'en_curso', 'en_pausa'])))
            .orderBy(entregables.vence)
            .limit(8),
        ]);
        r.proyectos = { activos: activos?.n ?? 0, hoy, proximos };
      })(),
    );
  }

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
        .then((f) => f.map((x) => ({ tipo: 'campana', id: x.id, titulo: x.asunto, detalle: ESTADO_CAMPANA[x.estado], href: `/admin/campanas/${x.id}` }))),
    );
  }
  if (puede(rol, 'asesor.ver'))
    grupos.push(
      db
        .select({ id: conversaciones.id, texto: mensajesConversacion.texto, creada: conversaciones.creada })
        .from(mensajesConversacion)
        .innerJoin(conversaciones, eq(conversaciones.id, mensajesConversacion.conversacionId))
        .where(and(eq(mensajesConversacion.rol, 'usuario'), like(mensajesConversacion.texto, patron)))
        .orderBy(desc(conversaciones.actualizada))
        .limit(POR_TIPO * 3)
        .then((f) => f.filter((x, i) => f.findIndex((y) => y.id === x.id) === i).slice(0, POR_TIPO))
        .then((f) => f.map((x) => ({ tipo: 'conversacion', id: x.id, titulo: x.texto.slice(0, 90), detalle: new Date(x.creada).toISOString().slice(0, 10), href: `/admin/conversaciones/${x.id}` }))),
    );
  if (puede(rol, 'proyectos.ver')) {
    grupos.push(
      db
        .select({ id: proyectos.id, nombre: proyectos.nombre, codigo: proyectos.codigo, org: organizaciones.nombre })
        .from(proyectos)
        .innerJoin(organizaciones, eq(organizaciones.id, proyectos.organizacionId))
        .where(or(like(proyectos.nombre, patron), like(proyectos.codigo, patron), like(organizaciones.nombre, patron)))
        .orderBy(desc(proyectos.actualizado))
        .limit(POR_TIPO)
        .then((f) => f.map((x) => ({ tipo: 'proyecto', id: x.id, titulo: x.nombre, detalle: `${x.codigo} · ${x.org}`, href: `/admin/proyectos/${x.id}` }))),
    );
    grupos.push(
      db
        .select({ id: organizaciones.id, nombre: organizaciones.nombre, sector: organizaciones.sector })
        .from(organizaciones)
        .where(or(like(organizaciones.nombre, patron), like(organizaciones.nit, patron)))
        .limit(POR_TIPO)
        .then((f) => f.map((x) => ({ tipo: 'organizacion', id: x.id, titulo: x.nombre, detalle: x.sector, href: `/admin/organizaciones/${x.id}` }))),
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
  return json({ resultados: (await Promise.all(grupos)).flat() });
}
