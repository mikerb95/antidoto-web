// Motor de envío de campañas. Al enviar una campaña se crea una fila "pendiente" por contacto;
// el cron (cada 5 minutos) y el propio clic de enviar reclaman lotes y los mandan con la API de
// lotes de Resend (hasta 100 correos por llamada). Reclamar es un UPDATE condicional con un id de
// lote, así dos ejecuciones a la vez nunca mandan el mismo correo.
//
// Prueba A/B de asunto: al arrancar, una muestra de la audiencia se parte en dos mitades (asunto A
// y asunto B) y el resto queda "en espera". Pasadas las horas de la prueba, el cron elige la
// variante con más clics (o aperturas, si no hay clics) y el resto recibe esa.
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { campanas, contactos, envios, type Campana, type Contacto } from '../db/schema';
import { renderizar } from './render';
import { enlaceBaja, enlacePreferencias, enlaceWeb } from './enlaces';
import type { Env } from '../env';
import { ahora, uuid, HORA } from '../util';

export const POR_LOTE = 100;
/** Lotes por ejecución: con el límite de Resend (2 por segundo) y el tiempo de un cron, sobra. */
export const LOTES_POR_CORRIDA = 5;
const MAX_INTENTOS = 3;
/** Pausa entre lotes de una corrida: Resend acepta 2 llamadas por segundo. */
const PAUSA_MS = 600;
/** Un lote reclamado que no terminó en este tiempo se da por perdido (se marca fallido, no se reintenta: pudo haber salido). */
const LOTE_PERDIDO_MS = 15 * 60_000;

/** Correo de una campaña para un contacto, con las cabeceras de baja de un clic. */
export function mensaje(env: Env, c: Campana, contacto: Pick<Contacto, 'email' | 'nombre' | 'token'>, variante?: 'a' | 'b' | null) {
  const base = c.baseUrl ?? env.APP_URL ?? '';
  const baja = enlaceBaja(base, contacto.token, c.id);
  const asunto = variante === 'b' && c.asuntoB ? c.asuntoB : c.asunto;
  const r = renderizar({ ...c, asunto }, { nombre: contacto.nombre }, baja, {
    preferencias: enlacePreferencias(base, contacto.token),
    web: enlaceWeb(base, c.id),
    responsable: env.MAIL_DIRECCION,
  });
  return {
    from: env.MAIL_FROM_NOVEDADES || env.MAIL_FROM,
    to: [contacto.email],
    subject: r.asunto,
    html: r.html,
    text: r.texto,
    reply_to: env.MAIL_EQUIPO,
    headers: {
      'List-Unsubscribe': `<${baja}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [{ name: 'campana', value: c.id }],
  };
}

export async function enviarLote(env: Env, cuerpos: unknown[]): Promise<{ ok: true; ids: string[] } | { ok: false; reintentar: boolean; error: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, reintentar: false, error: 'Falta RESEND_API_KEY' };
  try {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpos),
    });
    const texto = await res.text();
    if (!res.ok) return { ok: false, reintentar: res.status === 429 || res.status >= 500, error: `Resend ${res.status}: ${texto.slice(0, 300)}` };
    const datos = JSON.parse(texto) as { data?: { id: string }[] };
    return { ok: true, ids: (datos.data ?? []).map((d) => d.id) };
  } catch (e) {
    return { ok: false, reintentar: true, error: `Red: ${String(e).slice(0, 200)}` };
  }
}

/** Procesa hasta LOTES_POR_CORRIDA lotes pendientes de campañas en envío. */
export async function procesarEnvios(env: Env, db: DrizzleD1Database): Promise<{ enviados: number; fallidos: number }> {
  const t = ahora();
  let enviados = 0;
  let fallidos = 0;

  // Lotes que quedaron a medias (el Worker se cortó): no se sabe si salieron, así que no se reintentan.
  await db
    .update(envios)
    .set({ estado: 'fallido', error: 'Lote interrumpido' })
    .where(and(eq(envios.estado, 'enviando'), lt(envios.reclamado, t - LOTE_PERDIDO_MS)));

  for (let i = 0; i < LOTES_POR_CORRIDA; i++) {
    if (i) await new Promise((r) => setTimeout(r, PAUSA_MS));
    const lote = uuid();
    const reclamados = await db
      .update(envios)
      .set({ estado: 'enviando', lote, reclamado: ahora(), intentos: sql`${envios.intentos} + 1` })
      .where(
        inArray(
          envios.id,
          db
            .select({ id: envios.id })
            .from(envios)
            .innerJoin(campanas, eq(campanas.id, envios.campanaId))
            .where(and(eq(envios.estado, 'pendiente'), eq(campanas.estado, 'enviando')))
            .limit(POR_LOTE),
        ),
      )
      .returning({ id: envios.id });
    if (!reclamados.length) break;

    // Todo se consulta y actualiza por id de lote: D1 acepta como mucho 100 variables por consulta.
    const delLote = eq(envios.lote, lote);
    // Quien se dio de baja entre el clic de enviar y este lote ya no recibe nada.
    await db
      .update(envios)
      .set({ estado: 'cancelado' })
      .where(and(delLote, sql`${envios.contactoId} in (select ${contactos.id} from ${contactos} where ${contactos.estado} != 'activo')`));
    const filas = await db
      .select({ envio: envios, campana: campanas, contacto: contactos })
      .from(envios)
      .innerJoin(campanas, eq(campanas.id, envios.campanaId))
      .innerJoin(contactos, eq(contactos.id, envios.contactoId))
      .where(and(delLote, eq(envios.estado, 'enviando')))
      .orderBy(envios.id);
    if (!filas.length) continue;

    const r = await enviarLote(env, filas.map((f) => mensaje(env, f.campana, f.contacto, f.envio.variante)));
    const ahoraMs = ahora();
    if (r.ok) {
      const [primero, ...resto] = filas.map((f, k) =>
        db.update(envios).set({ estado: 'enviado', enviado: ahoraMs, resendId: r.ids[k] ?? null, error: null }).where(eq(envios.id, f.envio.id)),
      );
      await db.batch([primero!, ...resto]);
      enviados += filas.length;
    } else {
      const enCurso = and(delLote, eq(envios.estado, 'enviando'));
      if (r.reintentar) {
        await db.update(envios).set({ estado: 'pendiente', lote: null, error: r.error }).where(and(enCurso, lt(envios.intentos, MAX_INTENTOS)));
      }
      const finales = await db.update(envios).set({ estado: 'fallido', error: r.error }).where(enCurso).returning({ id: envios.id });
      fallidos += finales.length;
      console.error(`[envios] ${r.error}`);
      if (r.reintentar) break; // Resend limitado o caído: se sigue en la próxima corrida.
    }
  }

  // Campañas sin nada pendiente, en curso ni en espera de la prueba A/B quedan como enviadas.
  await db
    .update(campanas)
    .set({ estado: 'enviada', terminada: ahora() })
    .where(
      and(
        eq(campanas.estado, 'enviando'),
        sql`not exists (select 1 from ${envios} where ${envios.campanaId} = ${campanas.id} and ${envios.estado} in ('pendiente', 'enviando', 'espera'))`,
      ),
    );
  return { enviados, fallidos };
}

/** Audiencia de una campaña en SQL crudo (para el INSERT ... SELECT): activos del idioma, sin pausa y, si filtra, con algún interés. */
const AUDIENCIA_SQL = `c.estado = 'activo' and c.locale = ?1
  and (c.pausa_hasta is null or c.pausa_hasta <= ?2)
  and (?3 = '[]' or exists (select 1 from json_each(c.intereses) i where i.value in (select value from json_each(?3))))`;

/**
 * Pasa la campaña a "enviando" y crea un envío por destinatario, en una sola transacción: solo
 * si seguía en borrador o programada (dos clics no crean dos envíos), y los envíos se crean solo
 * si esta llamada fue la que la marcó. Con prueba A/B, reparte la muestra y deja el resto en espera.
 */
export async function iniciarEnvio(env: Env, c: Campana, appUrl: string): Promise<boolean> {
  const t = ahora();
  const ab = !!c.asuntoB;
  const [marcada] = await env.DB.batch([
    env.DB.prepare(
      `update campanas set estado = 'enviando', iniciada = ?1, actualizada = ?1, base_url = ?2, programada = null, ab_decision = ?3
       where id = ?4 and estado in ('borrador', 'programada') returning id`,
    ).bind(t, appUrl, ab ? t + Math.max(1, c.abHoras ?? 4) * HORA : null, c.id),
    env.DB.prepare(
      `insert or ignore into envios (id, campana_id, contacto_id, estado, intentos)
       select lower(hex(randomblob(16))), ?4, c.id, ?5, 0
       from contactos c
       where ${AUDIENCIA_SQL}
         and exists (select 1 from campanas where id = ?4 and estado = 'enviando' and iniciada = ?2)`,
    ).bind(c.locale, t, JSON.stringify(c.intereses), c.id, ab ? 'espera' : 'pendiente'),
  ]);
  if (!marcada?.results.length) return false;
  if (ab) {
    const { n } = (await env.DB.prepare(`select count(*) n from envios where campana_id = ?`).bind(c.id).first<{ n: number }>()) ?? { n: 0 };
    const muestra = Math.min(n, Math.max(2, Math.round((n * Math.min(100, Math.max(10, c.abMuestra ?? 20))) / 100)));
    const mitad = Math.ceil(muestra / 2);
    const tomar = (variante: 'a' | 'b', cuantos: number) =>
      env.DB.prepare(
        `update envios set estado = 'pendiente', variante = ?1
         where id in (select id from envios where campana_id = ?2 and estado = 'espera' order by random() limit ?3)`,
      ).bind(variante, c.id, cuantos);
    await env.DB.batch([tomar('a', mitad), tomar('b', muestra - mitad)]);
  }
  return true;
}

/** Cron: arranca las campañas programadas cuya hora ya llegó. */
export async function arrancarProgramadas(env: Env, db: DrizzleD1Database): Promise<number> {
  const listas = await db
    .select()
    .from(campanas)
    .where(and(eq(campanas.estado, 'programada'), lt(campanas.programada, ahora() + 1)));
  let n = 0;
  for (const c of listas) if (await iniciarEnvio(env, c, c.baseUrl ?? (env.APP_URL ?? '').replace(/\/$/, ''))) n++;
  return n;
}

/** Variante ganadora: más clics; si nadie hizo clic, más aperturas; empate, la A. Función pura. */
export function ganadora(a: { clics: number; abiertos: number }, b: { clics: number; abiertos: number }): 'a' | 'b' {
  if (a.clics !== b.clics) return b.clics > a.clics ? 'b' : 'a';
  return b.abiertos > a.abiertos ? 'b' : 'a';
}

/** Cron: cierra las pruebas A/B vencidas y libera el resto de la audiencia con la ganadora. */
export async function decidirPruebas(env: Env, db: DrizzleD1Database): Promise<number> {
  const vencidas = await db
    .select()
    .from(campanas)
    .where(and(eq(campanas.estado, 'enviando'), sql`${campanas.abDecision} is not null`, lt(campanas.abDecision, ahora() + 1), sql`${campanas.abGanador} is null`));
  for (const c of vencidas) {
    const filas = await db
      .select({ variante: envios.variante, clics: sql<number>`count(${envios.clic})`, abiertos: sql<number>`count(${envios.abierto})` })
      .from(envios)
      .where(and(eq(envios.campanaId, c.id), sql`${envios.variante} is not null`))
      .groupBy(envios.variante);
    const de = (v: 'a' | 'b') => filas.find((f) => f.variante === v) ?? { clics: 0, abiertos: 0 };
    const g = ganadora(de('a'), de('b'));
    await db.batch([
      db.update(campanas).set({ abGanador: g, actualizada: ahora() }).where(eq(campanas.id, c.id)),
      db.update(envios).set({ estado: 'pendiente', variante: g }).where(and(eq(envios.campanaId, c.id), eq(envios.estado, 'espera'))),
    ]);
  }
  return vencidas.length;
}
