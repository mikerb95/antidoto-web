// POST /v1/leads: guarda lo que pidió alguien en el cotizador, con su consentimiento, y avisa.
// El sitio lo envía con fetch keepalive (text/plain, sin preflight) justo antes de abrir WhatsApp,
// así que la respuesta casi nunca se lee: el cotizador funciona igual si esto falla.
import { and, eq, gt, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { leads, consentimientos, eventos, type Lead } from './db/schema';
import { validarLead } from './validar';
import { enviar, correoLeadEquipo, correoLeadCliente } from './correo';
import consentimiento from '../../src/data/consentimiento.json';
import type { Env } from './env';
import { ahora, hashIp, uuid, json, HORA } from './util';

/** Envíos por IP y hora antes de responder 429. */
export const LIMITE_POR_HORA = 5;
const MAX_CUERPO = 16 * 1024;

export async function crearLead(
  req: Request,
  env: Env,
  db: DrizzleD1Database,
  appUrl: string,
  diferir: (p: Promise<unknown>) => void,
  cors: Record<string, string>,
): Promise<Response> {
  const bruto = await req.text();
  if (bruto.length > MAX_CUERPO) return json({ ok: false, error: 'cuerpo' }, 413, cors);
  let datos: unknown;
  try {
    datos = JSON.parse(bruto);
  } catch {
    return json({ ok: false, error: 'json' }, 400, cors);
  }

  const r = validarLead(datos);
  // A un bot se le responde como si todo hubiera salido bien, para no enseñarle nada.
  if (!r.ok && r.bot) return json({ ok: true }, 202, cors);
  if (!r.ok) return json({ ok: false, errores: r.errores }, 422, cors);

  const t = ahora();
  const ipHash = await hashIp(req.headers.get('cf-connecting-ip'), env.SAL_IP, t);
  if (ipHash) {
    const [fila] = await db
      .select({ n: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.ipHash, ipHash), gt(leads.creado, t - HORA)));
    if ((fila?.n ?? 0) >= LIMITE_POR_HORA) return json({ ok: false, error: 'limite' }, 429, cors);
  }

  const lead: Lead = {
    ...r.lead,
    id: uuid(),
    creado: t,
    actualizado: t,
    estado: 'nuevo',
    valorEstimado: null,
    motivoPerdida: null,
    notas: null,
    primeraRespuesta: null,
    avisoSeguimiento: null,
    anonimizado: null,
    ipHash,
  };

  await db.batch([
    db.insert(leads).values(lead),
    db.insert(consentimientos).values({
      id: uuid(),
      leadId: lead.id,
      version: consentimiento.version,
      texto: consentimiento[lead.locale],
      aceptado: t,
      ipHash,
      userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      revocado: null,
    }),
    db.insert(eventos).values({ id: uuid(), leadId: lead.id, creado: t, tipo: 'creado', detalle: null, autor: null }),
  ]);

  // Los correos salen después de responder; si Resend falla, el lead ya quedó guardado.
  diferir(
    Promise.all([
      enviar(env, { para: env.MAIL_EQUIPO, ...correoLeadEquipo(lead, appUrl) }),
      lead.email ? enviar(env, { para: lead.email, ...correoLeadCliente(lead, env.MAIL_EQUIPO) }) : null,
    ]),
  );

  return json({ ok: true, id: lead.id }, 201, cors);
}
