// Correos automáticos de novedades:
// - Bienvenida: sale una vez, cuando la persona confirma. El equipo la edita en la bandeja
//   (Campañas > Correos automáticos); sin fila en la base sale el texto por defecto de aquí. Si
//   hay un regalo (una guía, por ejemplo), su enlace va en el cuerpo de la bienvenida.
// - Recordatorio: uno solo, a quien se suscribió en el sitio y no confirmó en 48 horas. A los
//   invitados por el equipo no: ellos no pidieron nada.
// - Invitaciones de contactos importados: salen por lotes con el cron, no al importar.
import { and, eq, gt, inArray, isNull, lt, notInArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { automaticos, contactos, INVITADOS, type Automatico, type Contacto } from '../db/schema';
import { enviar } from '../correo';
import type { Env } from '../env';
import { renderizar } from './render';
import { enlace, enlaceBaja, enlacePreferencias, sitioUrl, type Locale } from './enlaces';
import { correoConfirmacion } from './suscripciones';
import { enviarLote } from './envios';
import { ahora, HORA, DIA } from '../util';

export const CLAVES_AUTOMATICOS = ['bienvenida:es', 'bienvenida:en'] as const;
export type ClaveAutomatico = (typeof CLAVES_AUTOMATICOS)[number];

/** Horas que espera el recordatorio, y hasta cuándo se manda (después ya no tiene sentido). */
export const RECORDATORIO_TRAS = 48 * HORA;
const RECORDATORIO_HASTA = 7 * DIA;
const PAUSA_MS = 600;
/** D1 acepta como mucho 100 variables por consulta: el UPDATE del lote lleva una más que los ids. */
const LOTE_INVITACIONES = 90;

type Contenido = Pick<Automatico, 'asunto' | 'preheader' | 'cuerpo' | 'activo'>;

const POR_DEFECTO: Record<ClaveAutomatico, Contenido> = {
  'bienvenida:es': {
    asunto: 'Bienvenida a las novedades de Antídoto',
    preheader: 'Gracias por confirmar. Esto es lo que te va a llegar.',
    cuerpo: [
      '# Ya estás en la lista',
      'Gracias por confirmar. Desde ahora te escribimos con novedades, contenidos y propuestas para quienes forman, cuidan y celebran a sus equipos.',
      'Mientras tanto, conoce lo que hacemos:',
      '[[Ver servicios|{{sitio}}/servicios/]]',
      'Si algo de esto encaja con un reto de tu organización, responde este correo y te contamos cómo lo trabajamos.',
    ].join('\n\n'),
    activo: true,
  },
  'bienvenida:en': {
    asunto: 'Welcome to news from Antídoto',
    preheader: 'Thanks for confirming. Here is what you will get.',
    cuerpo: [
      '# You are on the list',
      'Thanks for confirming. From now on we will write with news, content and offers for people who train, care for and celebrate their teams.',
      'In the meantime, see what we do:',
      '[[See services|{{sitio}}/en/services/]]',
      'If any of this fits a challenge in your organization, reply to this email and we will tell you how we work on it.',
    ].join('\n\n'),
    activo: true,
  },
};

export const esClave = (v: string): v is ClaveAutomatico => (CLAVES_AUTOMATICOS as readonly string[]).includes(v);
export const localeDeClave = (c: ClaveAutomatico): Locale => (c.endsWith(':en') ? 'en' : 'es');

/** Contenido vigente: el editado en la bandeja o, si no hay, el de por defecto. */
export async function automatico(db: DrizzleD1Database, clave: ClaveAutomatico): Promise<Contenido & { personalizado: boolean }> {
  const [fila] = await db.select().from(automaticos).where(eq(automaticos.clave, clave));
  return fila ? { ...fila, personalizado: true } : { ...POR_DEFECTO[clave], personalizado: false };
}

/** {{sitio}} es la URL del sitio público, para que los enlaces sirvan en cualquier entorno. */
const conSitio = (texto: string, env: Pick<Env, 'SITIO_URL'>) => texto.replace(/\{\{\s*sitio\s*\}\}/g, sitioUrl(env));

export function renderAutomatico(env: Env, c: Contenido, locale: Locale, datos: { nombre?: string | null }, enlaces: { baja: string; preferencias?: string }) {
  return renderizar(
    { asunto: c.asunto, preheader: c.preheader, cuerpo: conSitio(c.cuerpo, env), locale },
    datos,
    enlaces.baja,
    { preferencias: enlaces.preferencias, responsable: env.MAIL_DIRECCION },
  );
}

/** Bienvenida al confirmar. Sale del remitente de novedades, con baja de un clic. */
export async function enviarBienvenida(env: Env, db: DrizzleD1Database, c: Contacto, appUrl: string): Promise<boolean> {
  const contenido = await automatico(db, `bienvenida:${c.locale}`);
  if (!contenido.activo) return false;
  const baja = enlaceBaja(appUrl, c.token);
  // El nombre solo si lo escribió el equipo (ver suscribir()).
  const r = renderAutomatico(env, contenido, c.locale, { nombre: INVITADOS.includes(c.origen) ? c.nombre : null }, { baja, preferencias: enlacePreferencias(appUrl, c.token) });
  const ok = await enviar(env, {
    para: c.email,
    asunto: r.asunto,
    html: r.html,
    texto: r.texto,
    de: env.MAIL_FROM_NOVEDADES || env.MAIL_FROM,
    responderA: env.MAIL_EQUIPO,
    cabeceras: { 'List-Unsubscribe': `<${baja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  });
  if (ok) await db.update(contactos).set({ bienvenida: ahora() }).where(eq(contactos.id, c.id));
  return ok;
}

/** Cron horario: un solo recordatorio a quien se suscribió en el sitio y no confirmó. */
export async function recordatorios(env: Env, db: DrizzleD1Database, appUrl: string): Promise<number> {
  const t = ahora();
  const filas = await db
    .select()
    .from(contactos)
    .where(
      and(
        eq(contactos.estado, 'pendiente'),
        notInArray(contactos.origen, [...INVITADOS]),
        isNull(contactos.recordatorio),
        lt(contactos.confirmacionEnviada, t - RECORDATORIO_TRAS),
        gt(contactos.confirmacionEnviada, t - RECORDATORIO_HASTA),
      ),
    )
    .limit(50);
  let enviados = 0;
  for (const [i, c] of filas.entries()) {
    if (i) await new Promise((r) => setTimeout(r, PAUSA_MS));
    const correo = correoConfirmacion({ ...c, nombre: null }, enlace(appUrl, 'confirmar', c.token), true);
    if (await enviar(env, { para: c.email, ...correo })) {
      await db.update(contactos).set({ recordatorio: ahora() }).where(eq(contactos.id, c.id));
      enviados++;
    }
  }
  return enviados;
}

/** Cron de 5 minutos: invitaciones de contactos importados, por lotes de la API de Resend. */
export async function invitaciones(env: Env, db: DrizzleD1Database, appUrl: string): Promise<number> {
  if (!env.RESEND_API_KEY) return 0;
  let enviados = 0;
  for (let i = 0; i < 5; i++) {
    if (i) await new Promise((r) => setTimeout(r, PAUSA_MS));
    const filas = await db
      .select()
      .from(contactos)
      .where(and(eq(contactos.estado, 'pendiente'), eq(contactos.origen, 'importado'), isNull(contactos.confirmacionEnviada)))
      .limit(LOTE_INVITACIONES);
    if (!filas.length) break;
    const r = await enviarLote(
      env,
      filas.map((c) => {
        const correo = correoConfirmacion(c, enlace(appUrl, 'confirmar', c.token));
        return { from: env.MAIL_FROM, to: [c.email], subject: correo.asunto, html: correo.html, text: correo.texto };
      }),
    );
    if (!r.ok) {
      console.error(`[invitaciones] ${r.error}`);
      break;
    }
    await db.update(contactos).set({ confirmacionEnviada: ahora() }).where(inArray(contactos.id, filas.map((c) => c.id)));
    enviados += filas.length;
  }
  return enviados;
}
