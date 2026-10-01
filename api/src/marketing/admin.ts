// API de email marketing para la bandeja: contactos, campañas, vista previa, prueba, audiencia y
// envío. Todo pasa por una sesión válida (ver index.ts).
import { and, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  campanas,
  contactos,
  consentimientosMarketing,
  envios,
  ESTADOS_CONTACTO,
  SERVICIOS,
  type Campana,
  type EstadoContacto,
  type ServicioId,
} from '../db/schema';
import type { Sesion } from '../auth';
import type { Env } from '../env';
import { enviar } from '../correo';
import { renderizar } from './render';
import { suscribir, darDeBaja } from './suscripciones';
import { procesarEnvios } from './envios';
import { ahora, uuid, json, token } from '../util';

const POR_PAGINA = 50;
const intereses = (v: unknown): ServicioId[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is ServicioId => SERVICIOS.includes(x as ServicioId)))] : [];

// Contactos ------------------------------------------------------------------------------

export async function listarContactos(url: URL, db: DrizzleD1Database): Promise<Response> {
  const p = url.searchParams;
  const filtros: SQL[] = [];
  const estado = p.get('estado');
  if (estado && ESTADOS_CONTACTO.includes(estado as EstadoContacto)) filtros.push(eq(contactos.estado, estado as EstadoContacto));
  const q = p.get('q')?.trim().slice(0, 80);
  if (q) {
    const patron = `%${q.replace(/[%_]/g, '')}%`;
    filtros.push(or(like(contactos.email, patron), like(contactos.nombre, patron), like(contactos.empresa, patron))!);
  }
  const pagina = Math.max(0, Number(p.get('pagina')) || 0);
  const donde = filtros.length ? and(...filtros) : undefined;
  const [filas, [total], porEstado] = await Promise.all([
    db
      .select({
        id: contactos.id,
        email: contactos.email,
        nombre: contactos.nombre,
        empresa: contactos.empresa,
        locale: contactos.locale,
        estado: contactos.estado,
        origen: contactos.origen,
        intereses: contactos.intereses,
        creado: contactos.creado,
        confirmado: contactos.confirmado,
        baja: contactos.baja,
        motivoBaja: contactos.motivoBaja,
      })
      .from(contactos)
      .where(donde)
      .orderBy(desc(contactos.creado))
      .limit(POR_PAGINA)
      .offset(pagina * POR_PAGINA),
    db.select({ n: sql<number>`count(*)` }).from(contactos).where(donde),
    db.select({ estado: contactos.estado, n: sql<number>`count(*)` }).from(contactos).groupBy(contactos.estado),
  ]);
  const conteos = Object.fromEntries(ESTADOS_CONTACTO.map((e) => [e, 0])) as Record<EstadoContacto, number>;
  porEstado.forEach((f) => (conteos[f.estado] = f.n));
  return json({ contactos: filas, total: total?.n ?? 0, pagina, porPagina: POR_PAGINA, conteos });
}

export async function verContacto(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(contactos).where(eq(contactos.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  const [cons, hist] = await Promise.all([
    db
      .select({ version: consentimientosMarketing.version, texto: consentimientosMarketing.texto, aceptado: consentimientosMarketing.aceptado, confirmado: consentimientosMarketing.confirmado, revocado: consentimientosMarketing.revocado })
      .from(consentimientosMarketing)
      .where(eq(consentimientosMarketing.contactoId, id))
      .orderBy(desc(consentimientosMarketing.aceptado)),
    db
      .select({ campana: campanas.asunto, enviado: envios.enviado, abierto: envios.abierto, clic: envios.clic, estado: envios.estado })
      .from(envios)
      .innerJoin(campanas, eq(campanas.id, envios.campanaId))
      .where(eq(envios.contactoId, id))
      .orderBy(desc(envios.enviado))
      .limit(20),
  ]);
  const { token: _, ...visible } = c;
  return json({ contacto: visible, consentimientos: cons, envios: hist });
}

/** El equipo invita a alguien: queda pendiente hasta que confirme desde su correo. */
export async function invitarContacto(req: Request, env: Env, db: DrizzleD1Database, appUrl: string): Promise<Response> {
  const d = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ errores: ['email'] }, 422);
  await suscribir(
    env,
    db,
    {
      email,
      nombre: typeof d.nombre === 'string' ? d.nombre : null,
      empresa: typeof d.empresa === 'string' ? d.empresa : null,
      locale: d.locale === 'en' ? 'en' : 'es',
      origen: 'admin',
      intereses: intereses(d.intereses),
    },
    appUrl,
  );
  const [c] = await db.select({ id: contactos.id, estado: contactos.estado }).from(contactos).where(eq(contactos.email, email));
  return json({ ok: true, contacto: c });
}

export async function bajaContacto(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(contactos).where(eq(contactos.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.estado === 'activo' || c.estado === 'pendiente') await darDeBaja(db, c, 'admin');
  return verContacto(id, db);
}

/** Supresión (Ley 1581): borra los datos personales y deja el registro sin identificar. */
export async function suprimirContacto(id: string, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  if (sesion.usuario.rol !== 'admin') return json({ error: 'rol' }, 403);
  const [c] = await db.select().from(contactos).where(eq(contactos.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  await darDeBaja(db, c, 'supresion');
  await db.batch([
    db
      .update(contactos)
      .set({ email: `suprimido+${c.id}@invalid`, nombre: null, empresa: null, token: token(), leadId: null, motivoBaja: 'supresion', actualizado: ahora() })
      .where(eq(contactos.id, id)),
    db.update(consentimientosMarketing).set({ ipHash: null, userAgent: null }).where(eq(consentimientosMarketing.contactoId, id)),
  ]);
  return verContacto(id, db);
}

// Campañas -------------------------------------------------------------------------------

export function validarCampana(d: unknown): { ok: true; campos: Pick<Campana, 'asunto' | 'preheader' | 'cuerpo' | 'locale' | 'intereses'> } | { ok: false; errores: string[] } {
  const e = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const errores: string[] = [];
  const asunto = typeof e.asunto === 'string' ? e.asunto.trim().slice(0, 150) : '';
  const cuerpo = typeof e.cuerpo === 'string' ? e.cuerpo.trim().slice(0, 50_000) : '';
  if (!asunto) errores.push('asunto');
  if (!cuerpo) errores.push('cuerpo');
  if (errores.length) return { ok: false, errores };
  return {
    ok: true,
    campos: {
      asunto,
      cuerpo,
      preheader: typeof e.preheader === 'string' ? e.preheader.trim().slice(0, 200) || null : null,
      locale: e.locale === 'en' ? 'en' : 'es',
      intereses: intereses(e.intereses),
    },
  };
}

/** Contactos activos del idioma de la campaña y, si filtra, interesados en alguno de sus servicios. */
function audiencia(c: Pick<Campana, 'locale' | 'intereses'>): SQL {
  const base = and(eq(contactos.estado, 'activo'), eq(contactos.locale, c.locale))!;
  if (!c.intereses.length) return base;
  const alguno = or(...c.intereses.map((i) => sql`exists (select 1 from json_each(${contactos.intereses}) where value = ${i})`))!;
  return and(base, alguno)!;
}

async function contarAudiencia(db: DrizzleD1Database, c: Pick<Campana, 'locale' | 'intereses'>): Promise<number> {
  const [f] = await db.select({ n: sql<number>`count(*)` }).from(contactos).where(audiencia(c));
  return f?.n ?? 0;
}

async function estadisticas(db: DrizzleD1Database, ids: string[]) {
  if (!ids.length) return new Map<string, Record<string, number>>();
  const filas = await db
    .select({
      campanaId: envios.campanaId,
      destinatarios: sql<number>`count(*)`,
      enviados: sql<number>`sum(case when ${envios.estado} = 'enviado' then 1 else 0 end)`,
      pendientes: sql<number>`sum(case when ${envios.estado} in ('pendiente', 'enviando') then 1 else 0 end)`,
      fallidos: sql<number>`sum(case when ${envios.estado} = 'fallido' then 1 else 0 end)`,
      entregados: sql<number>`count(${envios.entregado})`,
      abiertos: sql<number>`count(${envios.abierto})`,
      clics: sql<number>`count(${envios.clic})`,
      rebotes: sql<number>`count(${envios.rebote})`,
      quejas: sql<number>`count(${envios.queja})`,
      bajas: sql<number>`count(${envios.baja})`,
    })
    .from(envios)
    .where(inArray(envios.campanaId, ids))
    .groupBy(envios.campanaId);
  return new Map(filas.map(({ campanaId, ...resto }) => [campanaId, resto]));
}

export async function listarCampanas(db: DrizzleD1Database): Promise<Response> {
  const filas = await db.select().from(campanas).orderBy(desc(campanas.creada)).limit(100);
  const stats = await estadisticas(db, filas.map((c) => c.id));
  return json({ campanas: filas.map((c) => ({ ...c, cuerpo: undefined, stats: stats.get(c.id) ?? null })) });
}

export async function verCampana(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  const stats = (await estadisticas(db, [id])).get(id) ?? null;
  return json({ campana: c, stats, audiencia: c.estado === 'borrador' ? await contarAudiencia(db, c) : null });
}

export async function crearCampana(req: Request, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  const r = validarCampana(await req.json().catch(() => null));
  if (!r.ok) return json({ errores: r.errores }, 422);
  const t = ahora();
  const id = uuid();
  await db.insert(campanas).values({ id, ...r.campos, estado: 'borrador', autor: sesion.usuario.email, creada: t, actualizada: t });
  return verCampana(id, db);
}

export async function editarCampana(id: string, req: Request, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.estado !== 'borrador') return json({ error: 'estado' }, 409);
  const r = validarCampana(await req.json().catch(() => null));
  if (!r.ok) return json({ errores: r.errores }, 422);
  await db.update(campanas).set({ ...r.campos, actualizada: ahora() }).where(eq(campanas.id, id));
  return verCampana(id, db);
}

export async function borrarCampana(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.estado !== 'borrador') return json({ error: 'estado' }, 409);
  await db.delete(campanas).where(eq(campanas.id, id));
  return json({ ok: true });
}

/** Vista previa para el iframe de la bandeja, con un contacto de ejemplo. */
export async function vistaCampana(id: string, db: DrizzleD1Database, appUrl: string): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return new Response('No existe', { status: 404 });
  const { html } = renderizar(c, { nombre: c.locale === 'en' ? 'Alex' : 'Laura' }, `${appUrl}/v1/suscripcion/baja?t=ejemplo`);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      // Solo estilos en línea e imágenes https; nada de scripts. Solo la bandeja puede enmarcarla.
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; frame-ancestors 'self'; base-uri 'none'",
      'x-content-type-options': 'nosniff',
    },
  });
}

/** Manda la campaña solo a quien la pide, marcada como prueba. */
export async function probarCampana(id: string, env: Env, db: DrizzleD1Database, sesion: Sesion, appUrl: string): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  const r = renderizar(c, { nombre: sesion.usuario.nombre }, `${appUrl}/v1/suscripcion/baja?t=prueba`);
  const ok = await enviar(env, { para: sesion.usuario.email, asunto: `[Prueba] ${r.asunto}`, html: r.html, texto: r.texto });
  return ok ? json({ ok: true, para: sesion.usuario.email }) : json({ error: 'correo' }, 502);
}

/**
 * Envía la campaña. Pide el número de destinatarios que vio quien envía: si cambió (alguien se
 * suscribió o se dio de baja mientras tanto) se rechaza y la bandeja muestra el número nuevo.
 */
export async function enviarCampana(id: string, req: Request, env: Env, db: DrizzleD1Database, appUrl: string, diferir: (p: Promise<unknown>) => void): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.estado !== 'borrador') return json({ error: 'estado' }, 409);
  if (!env.RESEND_API_KEY) return json({ error: 'resend' }, 503);
  const d = (await req.json().catch(() => ({}))) as { destinatarios?: unknown };
  const n = await contarAudiencia(db, c);
  if (!n) return json({ error: 'audiencia' }, 422);
  if (d.destinatarios !== n) return json({ error: 'audiencia_cambio', audiencia: n }, 409);

  const t = ahora();
  // Pasa a "enviando" solo si seguía en borrador: dos clics no crean dos envíos.
  const marcada = await db
    .update(campanas)
    .set({ estado: 'enviando', iniciada: t, actualizada: t, baseUrl: appUrl })
    .where(and(eq(campanas.id, id), eq(campanas.estado, 'borrador')))
    .returning({ id: campanas.id });
  if (!marcada.length) return json({ error: 'estado' }, 409);

  await env.DB.prepare(
    `insert or ignore into envios (id, campana_id, contacto_id, estado, intentos)
     select lower(hex(randomblob(16))), ?, c.id, 'pendiente', 0
     from contactos c
     where c.estado = 'activo' and c.locale = ?
       and (? = '[]' or exists (select 1 from json_each(c.intereses) i where i.value in (select value from json_each(?))))`,
  )
    .bind(id, c.locale, JSON.stringify(c.intereses), JSON.stringify(c.intereses))
    .run();

  // El primer lote sale ya; el resto lo toma el cron cada 5 minutos.
  diferir(procesarEnvios(env, db).catch((e) => console.error('[envios]', e)));
  return verCampana(id, db);
}

export async function cancelarCampana(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.estado !== 'enviando') return json({ error: 'estado' }, 409);
  await db.batch([
    db.update(envios).set({ estado: 'cancelado' }).where(and(eq(envios.campanaId, id), eq(envios.estado, 'pendiente'))),
    db.update(campanas).set({ estado: 'cancelada', terminada: ahora(), actualizada: ahora() }).where(eq(campanas.id, id)),
  ]);
  return verCampana(id, db);
}

