// Motor de envío de campañas. Al enviar una campaña se crea una fila "pendiente" por contacto;
// el cron (cada 5 minutos) y el propio clic de enviar reclaman lotes y los mandan con la API de
// lotes de Resend (hasta 100 correos por llamada). Reclamar es un UPDATE condicional con un id de
// lote, así dos ejecuciones a la vez nunca mandan el mismo correo.
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { campanas, contactos, envios, type Campana, type Contacto } from '../db/schema';
import { renderizar } from './render';
import { enlaceBaja } from './suscripciones';
import type { Env } from '../env';
import { ahora, uuid } from '../util';

export const POR_LOTE = 100;
/** Lotes por ejecución: con el límite de Resend (2 por segundo) y el tiempo de un cron, sobra. */
export const LOTES_POR_CORRIDA = 5;
const MAX_INTENTOS = 3;
/** Pausa entre lotes de una corrida: Resend acepta 2 llamadas por segundo. */
const PAUSA_MS = 600;
/** Un lote reclamado que no terminó en este tiempo se da por perdido (se marca fallido, no se reintenta: pudo haber salido). */
const LOTE_PERDIDO_MS = 15 * 60_000;

/** Correo de una campaña para un contacto, con las cabeceras de baja de un clic. */
export function mensaje(env: Env, c: Campana, contacto: Pick<Contacto, 'email' | 'nombre' | 'token'>) {
  const baja = enlaceBaja(c.baseUrl ?? env.APP_URL ?? '', contacto.token, c.id);
  const r = renderizar(c, { nombre: contacto.nombre }, baja);
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

async function enviarLote(env: Env, cuerpos: unknown[]): Promise<{ ok: true; ids: string[] } | { ok: false; reintentar: boolean; error: string }> {
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

    const r = await enviarLote(env, filas.map((f) => mensaje(env, f.campana, f.contacto)));
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

  // Campañas sin nada pendiente ni en curso quedan como enviadas.
  await db
    .update(campanas)
    .set({ estado: 'enviada', terminada: ahora() })
    .where(
      and(
        eq(campanas.estado, 'enviando'),
        sql`not exists (select 1 from ${envios} where ${envios.campanaId} = ${campanas.id} and ${envios.estado} in ('pendiente', 'enviando'))`,
      ),
    );
  return { enviados, fallidos };
}
