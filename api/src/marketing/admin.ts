// API de email marketing para la bandeja: contactos (con importación), campañas (vista previa,
// prueba, audiencia, envío, programación, prueba A/B y duplicado), plantillas, correos automáticos
// y métricas de la lista. Todo pasa por una sesión válida (ver index.ts).
import { and, desc, eq, gte, inArray, isNull, like, lte, or, sql, type SQL } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  automaticos,
  campanas,
  contactos,
  plantillas,
  ORIGENES_CONTACTO,
  consentimientosMarketing,
  envios,
  ESTADOS_CONTACTO,
  SERVICIOS,
  type Campana,
  type Contacto,
  type EstadoContacto,
  type ServicioId,
} from '../db/schema';
import type { Sesion } from '../auth';
import type { Env } from '../env';
import { enviar } from '../correo';
import { renderizar } from './render';
import { suscribir, darDeBaja, EMAIL } from './suscripciones';
import { procesarEnvios, iniciarEnvio } from './envios';
import { enlaceWeb } from './enlaces';
import { automatico, renderAutomatico, esClave, localeDeClave, CLAVES_AUTOMATICOS } from './automaticos';
import { ahora, uuid, json, token, DIA } from '../util';

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
  // Quien se dio de baja (o se quejó) decidió no recibir más correos: el equipo no lo reinvita.
  // Si cambia de idea, se suscribe por su cuenta desde el sitio.
  const [previo] = await db.select({ estado: contactos.estado }).from(contactos).where(eq(contactos.email, email));
  if (previo?.estado === 'baja' || previo?.estado === 'rebotado') return json({ error: previo.estado }, 409);
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

/** Supresión (Ley 1581): borra los datos personales del contacto y deja el registro sin identificar. */
export async function suprimir(db: DrizzleD1Database, c: Contacto): Promise<void> {
  await darDeBaja(db, c, 'supresion');
  await db.batch([
    db
      .update(contactos)
      .set({ email: `suprimido+${c.id}@invalid`, nombre: null, empresa: null, token: token(), leadId: null, motivoBaja: 'supresion', actualizado: ahora() })
      .where(eq(contactos.id, c.id)),
    db.update(consentimientosMarketing).set({ ipHash: null, userAgent: null }).where(eq(consentimientosMarketing.contactoId, c.id)),
  ]);
}

export async function suprimirContacto(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(contactos).where(eq(contactos.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  await suprimir(db, c);
  return verContacto(id, db);
}

// Campañas -------------------------------------------------------------------------------

type CamposCampana = Pick<Campana, 'asunto' | 'preheader' | 'cuerpo' | 'locale' | 'intereses' | 'publica' | 'asuntoB' | 'abMuestra' | 'abHoras'>;

const entero = (v: unknown, min: number, max: number, defecto: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, n)) : defecto;
};

export function validarCampana(d: unknown): { ok: true; campos: CamposCampana } | { ok: false; errores: string[] } {
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
      publica: e.publica === true,
      // Prueba A/B: solo si hay un segundo asunto distinto del primero.
      ...(() => {
        const b = typeof e.asuntoB === 'string' ? e.asuntoB.trim().slice(0, 150) : '';
        return b && b !== asunto
          ? { asuntoB: b, abMuestra: entero(e.abMuestra, 10, 100, 20), abHoras: entero(e.abHoras, 1, 72, 4) }
          : { asuntoB: null, abMuestra: null, abHoras: null };
      })(),
    },
  };
}

/** Contactos activos y sin pausa del idioma de la campaña y, si filtra, interesados en alguno de sus servicios. */
function audiencia(c: Pick<Campana, 'locale' | 'intereses'>): SQL {
  const base = and(eq(contactos.estado, 'activo'), eq(contactos.locale, c.locale), or(isNull(contactos.pausaHasta), lte(contactos.pausaHasta, ahora())))!;
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

/** Resultados por variante de una prueba A/B. */
async function porVariante(db: DrizzleD1Database, id: string) {
  return db
    .select({
      variante: envios.variante,
      enviados: sql<number>`sum(case when ${envios.estado} = 'enviado' then 1 else 0 end)`,
      abiertos: sql<number>`count(${envios.abierto})`,
      clics: sql<number>`count(${envios.clic})`,
    })
    .from(envios)
    .where(and(eq(envios.campanaId, id), sql`${envios.variante} is not null`))
    .groupBy(envios.variante);
}

export async function verCampana(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  const stats = (await estadisticas(db, [id])).get(id) ?? null;
  const editable = c.estado === 'borrador' || c.estado === 'programada';
  return json({
    campana: c,
    stats,
    audiencia: editable ? await contarAudiencia(db, c) : null,
    variantes: c.asuntoB && !editable ? await porVariante(db, id) : null,
  });
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
export async function vistaCampana(id: string, env: Env, db: DrizzleD1Database, appUrl: string): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return new Response('No existe', { status: 404 });
  const { html } = renderizar(c, { nombre: c.locale === 'en' ? 'Alex' : 'Laura' }, `${appUrl}/v1/suscripcion/baja?t=ejemplo`, {
    preferencias: `${appUrl}/v1/suscripcion/preferencias?t=ejemplo`,
    web: enlaceWeb(appUrl, c.id),
    responsable: env.MAIL_DIRECCION,
  });
  return vistaHtml(html);
}

export function vistaHtml(html: string): Response {
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
  // Con prueba A/B llegan las dos variantes, para ver ambos asuntos en la bandeja de entrada.
  const asuntos = c.asuntoB ? [c.asunto, c.asuntoB] : [c.asunto];
  let ok = true;
  for (const asunto of asuntos) {
    const r = renderizar({ ...c, asunto }, { nombre: sesion.usuario.nombre }, `${appUrl}/v1/suscripcion/baja?t=prueba`, {
      preferencias: `${appUrl}/v1/suscripcion/preferencias?t=prueba`,
      web: enlaceWeb(appUrl, c.id),
      responsable: env.MAIL_DIRECCION,
    });
    ok = (await enviar(env, { para: sesion.usuario.email, asunto: `[Prueba] ${r.asunto}`, html: r.html, texto: r.texto, de: env.MAIL_FROM_NOVEDADES || env.MAIL_FROM })) && ok;
  }
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

  if (!(await iniciarEnvio(env, c, appUrl))) return json({ error: 'estado' }, 409);

  // El primer lote sale ya; el resto lo toma el cron cada 5 minutos.
  diferir(procesarEnvios(env, db).catch((e) => console.error('[envios]', e)));
  return verCampana(id, db);
}

export async function cancelarCampana(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.estado !== 'enviando') return json({ error: 'estado' }, 409);
  await db.batch([
    db.update(envios).set({ estado: 'cancelado' }).where(and(eq(envios.campanaId, id), inArray(envios.estado, ['pendiente', 'espera']))),
    db.update(campanas).set({ estado: 'cancelada', terminada: ahora(), actualizada: ahora() }).where(eq(campanas.id, id)),
  ]);
  return verCampana(id, db);
}


/** Programa el envío para una fecha futura. La audiencia se cuenta de nuevo al salir. */
export async function programarCampana(id: string, req: Request, env: Env, db: DrizzleD1Database, appUrl: string): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.estado !== 'borrador') return json({ error: 'estado' }, 409);
  if (!env.RESEND_API_KEY) return json({ error: 'resend' }, 503);
  const d = (await req.json().catch(() => ({}))) as { fecha?: unknown };
  const fecha = Number(d.fecha);
  // Al menos 5 minutos en el futuro (el cron pasa cada 5) y como mucho a un año.
  if (!Number.isFinite(fecha) || fecha < ahora() + 5 * 60_000 || fecha > ahora() + 365 * DIA) return json({ errores: ['fecha'] }, 422);
  if (!(await contarAudiencia(db, c))) return json({ error: 'audiencia' }, 422);
  await db.update(campanas).set({ estado: 'programada', programada: fecha, baseUrl: appUrl, actualizada: ahora() }).where(and(eq(campanas.id, id), eq(campanas.estado, 'borrador')));
  return verCampana(id, db);
}

export async function desprogramarCampana(id: string, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.estado !== 'programada') return json({ error: 'estado' }, 409);
  await db.update(campanas).set({ estado: 'borrador', programada: null, actualizada: ahora() }).where(and(eq(campanas.id, id), eq(campanas.estado, 'programada')));
  return verCampana(id, db);
}

/** Copia una campaña (en cualquier estado) como borrador nuevo. */
export async function duplicarCampana(id: string, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  const [c] = await db.select().from(campanas).where(eq(campanas.id, id));
  if (!c) return json({ error: 'no existe' }, 404);
  const t = ahora();
  const nueva = uuid();
  const { asunto, preheader, cuerpo, locale, intereses, publica, asuntoB, abMuestra, abHoras } = c;
  await db.insert(campanas).values({ id: nueva, asunto, preheader, cuerpo, locale, intereses, publica, asuntoB, abMuestra, abHoras, estado: 'borrador', autor: sesion.usuario.email, creada: t, actualizada: t });
  return verCampana(nueva, db);
}

// Plantillas ------------------------------------------------------------------------------

export async function listarPlantillas(db: DrizzleD1Database): Promise<Response> {
  return json({ plantillas: await db.select().from(plantillas).orderBy(desc(plantillas.creada)).limit(100) });
}

export async function crearPlantilla(req: Request, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  const d = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = validarCampana(d);
  const nombre = typeof d.nombre === 'string' ? d.nombre.trim().slice(0, 80) : '';
  if (!r.ok || !nombre) return json({ errores: [...(r.ok ? [] : r.errores), ...(nombre ? [] : ['nombre'])] }, 422);
  const { asunto, preheader, cuerpo, locale } = r.campos;
  await db.insert(plantillas).values({ id: uuid(), nombre, asunto, preheader, cuerpo, locale, autor: sesion.usuario.email, creada: ahora() });
  return listarPlantillas(db);
}

export async function borrarPlantilla(id: string, db: DrizzleD1Database): Promise<Response> {
  await db.delete(plantillas).where(eq(plantillas.id, id));
  return listarPlantillas(db);
}

// Correos automáticos ---------------------------------------------------------------------

export async function listarAutomaticos(db: DrizzleD1Database): Promise<Response> {
  return json({ automaticos: await Promise.all(CLAVES_AUTOMATICOS.map(async (clave) => ({ clave, locale: localeDeClave(clave), ...(await automatico(db, clave)) }))) });
}

export async function guardarAutomatico(clave: string, req: Request, db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  if (!esClave(clave)) return json({ error: 'no existe' }, 404);
  const d = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = validarCampana({ ...d, locale: localeDeClave(clave) });
  if (!r.ok) return json({ errores: r.errores }, 422);
  const fila = { asunto: r.campos.asunto, preheader: r.campos.preheader, cuerpo: r.campos.cuerpo, activo: d.activo !== false, actualizado: ahora(), autor: sesion.usuario.email };
  await db.insert(automaticos).values({ clave, ...fila }).onConflictDoUpdate({ target: automaticos.clave, set: fila });
  return listarAutomaticos(db);
}

/** Vuelve al texto por defecto. */
export async function restaurarAutomatico(clave: string, db: DrizzleD1Database): Promise<Response> {
  if (!esClave(clave)) return json({ error: 'no existe' }, 404);
  await db.delete(automaticos).where(eq(automaticos.clave, clave));
  return listarAutomaticos(db);
}

export async function vistaAutomatico(clave: string, env: Env, db: DrizzleD1Database, appUrl: string): Promise<Response> {
  if (!esClave(clave)) return new Response('No existe', { status: 404 });
  const locale = localeDeClave(clave);
  const { html } = renderAutomatico(env, await automatico(db, clave), locale, {}, { baja: `${appUrl}/v1/suscripcion/baja?t=ejemplo`, preferencias: `${appUrl}/v1/suscripcion/preferencias?t=ejemplo` });
  return vistaHtml(html);
}

export async function probarAutomatico(clave: string, env: Env, db: DrizzleD1Database, sesion: Sesion, appUrl: string): Promise<Response> {
  if (!esClave(clave)) return json({ error: 'no existe' }, 404);
  const r = renderAutomatico(env, await automatico(db, clave), localeDeClave(clave), {}, { baja: `${appUrl}/v1/suscripcion/baja?t=prueba`, preferencias: `${appUrl}/v1/suscripcion/preferencias?t=prueba` });
  const ok = await enviar(env, { para: sesion.usuario.email, asunto: `[Prueba] ${r.asunto}`, html: r.html, texto: r.texto, de: env.MAIL_FROM_NOVEDADES || env.MAIL_FROM });
  return ok ? json({ ok: true, para: sesion.usuario.email }) : json({ error: 'correo' }, 502);
}

// Importación -----------------------------------------------------------------------------

export const MAX_IMPORTACION = 1000;

/**
 * Importa contactos como invitaciones: quedan pendientes y el cron les manda la invitación por
 * lotes. Nadie queda suscrito sin confirmar, y quien ya estaba (en cualquier estado) no se toca:
 * así no se reinvita a quien se dio de baja o se quejó.
 */
export async function importarContactos(req: Request, db: DrizzleD1Database): Promise<Response> {
  const d = (await req.json().catch(() => ({}))) as { filas?: unknown };
  if (!Array.isArray(d.filas) || !d.filas.length) return json({ errores: ['filas'] }, 422);
  if (d.filas.length > MAX_IMPORTACION) return json({ errores: ['maximo'], maximo: MAX_IMPORTACION }, 413);
  const vistos = new Set<string>();
  const validas: { email: string; nombre: string | null; empresa: string | null; locale: 'es' | 'en'; intereses: ServicioId[] }[] = [];
  let invalidos = 0;
  for (const f of d.filas as Record<string, unknown>[]) {
    const email = typeof f?.email === 'string' ? f.email.trim().toLowerCase() : '';
    if (!EMAIL.test(email) || email.length > 200) {
      invalidos++;
      continue;
    }
    if (vistos.has(email)) continue;
    vistos.add(email);
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null);
    validas.push({ email, nombre: texto(f.nombre), empresa: texto(f.empresa), locale: f.locale === 'en' ? 'en' : 'es', intereses: intereses(f.intereses) });
  }
  // Los que ya existen se buscan por partes: D1 acepta como mucho 100 variables por consulta.
  const existentes = new Set<string>();
  for (let i = 0; i < validas.length; i += 90) {
    const parte = validas.slice(i, i + 90).map((v) => v.email);
    (await db.select({ email: contactos.email }).from(contactos).where(inArray(contactos.email, parte))).forEach((c) => existentes.add(c.email));
  }
  const t = ahora();
  const nuevas = validas.filter((v) => !existentes.has(v.email));
  const filas = nuevas.map((v) => ({
    id: uuid(),
    ...v,
    estado: 'pendiente' as const,
    origen: 'importado' as const,
    token: token(),
    creado: t,
    actualizado: t,
  }));
  // Unas 15 variables por fila: lotes de 6 filas para no pasar de 100 variables.
  for (let i = 0; i < filas.length; i += 6) await db.insert(contactos).values(filas.slice(i, i + 6));
  return json({ ok: true, creados: filas.length, existentes: existentes.size, invalidos });
}

// Métricas de la lista --------------------------------------------------------------------

const SEMANA = 7 * DIA;

/** Altas, confirmaciones y bajas por semana, tamaño de la lista y confirmación por origen. */
export async function metricasMarketing(url: URL, db: DrizzleD1Database): Promise<Response> {
  const semanas = Math.min(52, Math.max(4, Number(url.searchParams.get('semanas')) || 12));
  const fin = ahora();
  const desde = fin - semanas * SEMANA;
  const porSemana = (col: typeof contactos.creado | typeof contactos.confirmado | typeof contactos.baja) =>
    db
      .select({ semana: sql<number>`cast((${col} - ${desde}) / ${SEMANA} as integer)`, n: sql<number>`count(*)` })
      .from(contactos)
      .where(and(gte(col, desde), lte(col, fin)))
      .groupBy(sql`1`);
  const [altas, confirmados, bajas, porEstado, origenes, pausados, campanasEnviadas] = await Promise.all([
    porSemana(contactos.creado),
    porSemana(contactos.confirmado),
    porSemana(contactos.baja),
    db.select({ estado: contactos.estado, n: sql<number>`count(*)` }).from(contactos).groupBy(contactos.estado),
    db
      .select({ origen: contactos.origen, total: sql<number>`count(*)`, confirmados: sql<number>`count(${contactos.confirmado})` })
      .from(contactos)
      .where(gte(contactos.creado, fin - 365 * DIA))
      .groupBy(contactos.origen),
    db.select({ n: sql<number>`count(*)` }).from(contactos).where(and(eq(contactos.estado, 'activo'), sql`${contactos.pausaHasta} > ${fin}`)),
    db
      .select({ enviados: sql<number>`count(*)`, abiertos: sql<number>`count(${envios.abierto})`, clics: sql<number>`count(${envios.clic})` })
      .from(envios)
      .where(and(eq(envios.estado, 'enviado'), gte(envios.enviado, desde))),
  ]);
  const serie = (filas: { semana: number; n: number }[]) => {
    const v = Array<number>(semanas).fill(0);
    filas.forEach((f) => f.semana >= 0 && f.semana < semanas && (v[f.semana] = f.n));
    return v;
  };
  const conteos = Object.fromEntries(['pendiente', 'activo', 'baja', 'rebotado'].map((e) => [e, 0])) as Record<string, number>;
  porEstado.forEach((f) => (conteos[f.estado] = f.n));
  return json({
    semanas: Array.from({ length: semanas }, (_, i) => desde + i * SEMANA),
    altas: serie(altas),
    confirmados: serie(confirmados),
    bajas: serie(bajas),
    conteos,
    pausados: pausados[0]?.n ?? 0,
    origenes: ORIGENES_CONTACTO.map((o) => origenes.find((f) => f.origen === o) ?? { origen: o, total: 0, confirmados: 0 }).filter((f) => f.total),
    campanas: campanasEnviadas[0] ?? { enviados: 0, abiertos: 0, clics: 0 },
  });
}

// Ficha del lead --------------------------------------------------------------------------

/** Suscripción de quien pidió un lead: por el lead que la originó o por su correo. */
export async function suscripcionDeLead(db: DrizzleD1Database, lead: { id: string; email: string | null }) {
  const [c] = await db
    .select()
    .from(contactos)
    .where(lead.email ? or(eq(contactos.leadId, lead.id), eq(contactos.email, lead.email.toLowerCase())) : eq(contactos.leadId, lead.id))
    .limit(1);
  if (!c) return null;
  const [st] = await db
    .select({
      recibidas: sql<number>`count(*)`,
      abiertas: sql<number>`count(${envios.abierto})`,
      clics: sql<number>`count(${envios.clic})`,
      ultimoClic: sql<number | null>`max(${envios.clic})`,
      ultimaApertura: sql<number | null>`max(${envios.abierto})`,
    })
    .from(envios)
    .where(and(eq(envios.contactoId, c.id), eq(envios.estado, 'enviado')));
  return { id: c.id, estado: c.estado, confirmado: c.confirmado, intereses: c.intereses, pausaHasta: c.pausaHasta, ...(st ?? {}) };
}
