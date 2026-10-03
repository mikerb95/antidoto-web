// Suscripción a novedades con doble confirmación. Quien se suscribe (desde la home, el pie, el
// archivo de novedades, el cotizador o porque el equipo lo invitó) recibe un correo con un botón
// para confirmar; solo entonces queda "activo", la autorización queda confirmada y le llega la
// bienvenida. La baja es de un clic, incluida la de RFC 8058 (List-Unsubscribe-Post) que usan
// Gmail y Yahoo. Las páginas de confirmar, baja y preferencias viven en el sitio: aquí el GET
// redirige allá y el POST hace la acción y vuelve al sitio con el resultado.
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { contactos, consentimientosMarketing, envios, SERVICIOS, INVITADOS, type Contacto, type OrigenContacto, type ServicioId } from '../db/schema';
import { enviar } from '../correo';
import { aceptada, vigente, type Version } from '../consentimiento';
import type { Env } from '../env';
import { ahora, hashIp, uuid, json, token, escapar, DIA } from '../util';
import { enlace, paginaPreferencias, type Locale } from './enlaces';
import { enviarBienvenida } from './automaticos';
import { TIEMPO_MINIMO_MS } from '../validar';
import { dentroDelLimite } from '../limite';

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** No se reenvía la confirmación a la misma persona antes de esto. */
const ESPERA_CONFIRMACION = 10 * 60_000;
export const SUSCRIPCIONES_POR_HORA = 5;

export interface Solicitud {
  email: string;
  nombre?: string | null;
  empresa?: string | null;
  locale: 'es' | 'en';
  origen: OrigenContacto;
  intereses?: ServicioId[];
  leadId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  /** Versión de la autorización que aceptó; sin ella, la vigente. */
  autorizacion?: Version | null;
}

export const limpiarIntereses = (v: unknown): ServicioId[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is ServicioId => SERVICIOS.includes(x as ServicioId)))] : [];

export { enlaceBaja } from './enlaces';

/**
 * Registra (o reactiva) una suscripción y manda la confirmación. Nunca revela si el correo ya
 * estaba: a un contacto activo no se le manda nada, ni a uno con rebote, ni a quien marcó un
 * correo nuestro como spam.
 */
export async function suscribir(env: Env, db: DrizzleD1Database, s: Solicitud, appUrl: string): Promise<void> {
  const email = s.email.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return;
  const t = ahora();
  const intereses = limpiarIntereses(s.intereses);
  const [existe] = await db.select().from(contactos).where(eq(contactos.email, email));

  if (existe && (existe.estado === 'rebotado' || existe.estado === 'activo' || existe.motivoBaja === 'queja')) {
    // Activo: solo suma intereses y datos que falten. Rebotado: el correo no existe. Queja: pidió
    // no recibir más; volver a escribirle daña la reputación del dominio. En ambos, no se insiste.
    if (existe.estado === 'activo') {
      const union = [...new Set([...existe.intereses, ...intereses])];
      await db
        .update(contactos)
        .set({ intereses: union, nombre: existe.nombre ?? s.nombre ?? null, empresa: existe.empresa ?? s.empresa ?? null, actualizado: t })
        .where(eq(contactos.id, existe.id));
    }
    return;
  }

  let contacto: Contacto;
  if (existe) {
    if (existe.estado === 'pendiente' && existe.confirmacionEnviada && t - existe.confirmacionEnviada < ESPERA_CONFIRMACION) return;
    const cambios = {
      estado: 'pendiente' as const,
      // Lo que ya estaba no lo cambia un formulario público.
      nombre: existe.nombre ?? (s.nombre?.trim().slice(0, 120) || null),
      empresa: existe.empresa ?? (s.empresa?.trim().slice(0, 120) || null),
      locale: s.locale,
      intereses: [...new Set([...existe.intereses, ...intereses])],
      baja: null,
      motivoBaja: null,
      actualizado: t,
      confirmacionEnviada: t,
      // Quien se había dado de baja recibe un token nuevo: los enlaces de correos viejos (o
      // reenviados) no sirven para suscribirlo otra vez.
      token: existe.estado === 'baja' ? token() : existe.token,
    };
    await db.update(contactos).set(cambios).where(eq(contactos.id, existe.id));
    contacto = { ...existe, ...cambios };
  } else {
    contacto = {
      id: uuid(),
      email,
      nombre: s.nombre?.trim().slice(0, 120) || null,
      empresa: s.empresa?.trim().slice(0, 120) || null,
      locale: s.locale,
      estado: 'pendiente',
      origen: s.origen,
      intereses,
      token: token(),
      leadId: s.leadId ?? null,
      creado: t,
      actualizado: t,
      confirmacionEnviada: t,
      confirmado: null,
      baja: null,
      motivoBaja: null,
      recordatorio: null,
      bienvenida: null,
      pausaHasta: null,
    };
    await db.insert(contactos).values(contacto);
  }

  // Quien se suscribe por su cuenta acepta el texto ahora (y lo confirma por correo). A un
  // invitado por el equipo se le registra la autorización cuando confirma.
  if (!INVITADOS.includes(s.origen)) {
    const autorizacion = s.autorizacion ?? vigente('novedades');
    await db.insert(consentimientosMarketing).values({
      id: uuid(),
      contactoId: contacto.id,
      version: autorizacion.version,
      texto: autorizacion[s.locale],
      aceptado: t,
      confirmado: null,
      ipHash: s.ipHash ?? null,
      userAgent: s.userAgent?.slice(0, 300) ?? null,
      revocado: null,
    });
  }

  // El nombre solo va en el saludo si lo escribió el equipo: un formulario público no debe poder
  // meter texto propio en un correo que sale con nuestro dominio hacia cualquier dirección.
  const destinatario = { locale: contacto.locale, origen: s.origen, nombre: INVITADOS.includes(s.origen) ? contacto.nombre : null };
  await enviar(env, { para: email, ...correoConfirmacion(destinatario, enlace(appUrl, 'confirmar', contacto.token)) });
}

export function correoConfirmacion(c: Pick<Contacto, 'nombre' | 'locale' | 'origen'>, href: string, recordatorio = false) {
  const en = c.locale === 'en';
  const invitado = INVITADOS.includes(c.origen);
  const hola = c.nombre ? (en ? `Hi ${c.nombre},` : `Hola ${c.nombre},`) : en ? 'Hi,' : 'Hola,';
  const cuerpo = en
    ? invitado
      ? 'The Antídoto team invites you to receive our news, content and offers by email. If you want to, confirm with the button.'
      : 'Confirm that you want to receive news, content and offers from Antídoto by email.'
    : invitado
      ? 'El equipo de Antídoto te invita a recibir por correo nuestras novedades, contenidos y propuestas. Si quieres, confírmalo con el botón.'
      : 'Confirma que quieres recibir por correo novedades, contenidos y propuestas de Antídoto.';
  const boton = en ? 'Confirm subscription' : 'Confirmar suscripción';
  const nota = recordatorio
    ? en
      ? 'This is the only reminder we will send. If you do not confirm, we will not write to you again.'
      : 'Es el único recordatorio que te enviamos. Si no confirmas, no te volvemos a escribir.'
    : en
      ? 'If you did not ask for this, ignore this email: we will not write to you.'
      : 'Si no lo pediste, ignora este correo: no te vamos a escribir.';
  const asunto = recordatorio
    ? en
      ? 'Reminder: confirm your subscription · Antídoto'
      : 'Recordatorio: confirma tu suscripción · Antídoto'
    : en
      ? 'Confirm your subscription · Antídoto'
      : 'Confirma tu suscripción · Antídoto';
  return {
    asunto,
    html: `<!doctype html><html><body style="margin:0;background:#F1EFE9;font-family:Helvetica,Arial,sans-serif;color:#0F181D"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px"><tr><td style="padding:28px;border-top:4px solid #3BC8F3;border-radius:14px;font-size:15px;line-height:1.55"><p style="margin:0 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0C5C7D">Antídoto</p><p style="margin:12px 0">${escapar(hola)}</p><p style="margin:0 0 8px">${escapar(cuerpo)}</p><p style="margin:20px 0"><a href="${escapar(href)}" style="display:inline-block;background:#0F181D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${escapar(boton)}</a></p><p style="margin:0;color:#5b6b70;font-size:13px">${escapar(nota)}</p></td></tr></table></td></tr></table></body></html>`,
    texto: `${hola}\n\n${cuerpo}\n\n${boton}: ${href}\n\n${nota}`,
  };
}

/** Formularios del sitio que pueden suscribir; cualquier otro valor cuenta como el pie. */
const ORIGENES_SITIO: OrigenContacto[] = ['pie', 'inicio', 'archivo'];

/** POST /v1/suscripciones desde los formularios del sitio. Responde igual pase lo que pase. */
export async function crearSuscripcion(req: Request, env: Env, db: DrizzleD1Database, appUrl: string, cors: Record<string, string>, diferir: (p: Promise<unknown>) => void) {
  const ok = json({ ok: true }, 202, cors);
  const bruto = await req.text();
  if (bruto.length > 4096) return json({ ok: false }, 413, cors);
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(bruto);
  } catch {
    return json({ ok: false }, 400, cors);
  }
  if (typeof d.web === 'string' && d.web.trim()) return ok;
  if (typeof d.t !== 'number' || d.t < TIEMPO_MINIMO_MS) return ok;
  const email = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email)) return json({ ok: false, errores: ['email'] }, 422, cors);
  const autorizacion = aceptada('novedades', d.consentimiento);
  if (!autorizacion) return json({ ok: false, errores: ['consentimiento'] }, 422, cors);

  const ipHash = await hashIp(req.headers.get('cf-connecting-ip'), env.SAL_IP);
  if (ipHash && !(await dentroDelLimite(db, `suscripcion:${ipHash}`, SUSCRIPCIONES_POR_HORA))) return json({ ok: false, error: 'limite' }, 429, cors);

  diferir(
    suscribir(
      env,
      db,
      {
        email,
        nombre: typeof d.nombre === 'string' ? d.nombre : null,
        locale: d.locale === 'en' ? 'en' : 'es',
        origen: ORIGENES_SITIO.includes(d.origen as OrigenContacto) ? (d.origen as OrigenContacto) : 'pie',
        intereses: limpiarIntereses(d.intereses),
        ipHash,
        userAgent: req.headers.get('user-agent'),
        autorizacion,
      },
      appUrl,
    ).catch((e) => console.error('[suscripcion]', e)),
  );
  return ok;
}

// Confirmación, baja y preferencias ---------------------------------------------------------

async function porToken(db: DrizzleD1Database, t: string | null): Promise<Contacto | null> {
  if (!t || t.length > 100) return null;
  const [c] = await db.select().from(contactos).where(eq(contactos.token, t));
  return c ?? null;
}

const localeDe = (req: Request): Locale => (/^en\b/i.test(req.headers.get('accept-language') ?? '') ? 'en' : 'es');

/** GET: lleva al sitio. Es un 302 para que el navegador no lo recuerde. */
const ir = (url: string) => new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
/** POST de un formulario del sitio: vuelve al sitio con el resultado (303 lo convierte en GET). */
const volver = (url: string) => new Response(null, { status: 303, headers: { location: url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });

type Diferir = (p: Promise<unknown>) => void;

/**
 * GET lleva al botón del sitio (los filtros de correo abren los enlaces y no deben confirmar por
 * su cuenta); POST confirma, registra la autorización, manda la bienvenida y vuelve al sitio.
 */
export async function confirmar(req: Request, db: DrizzleD1Database, env: Env, appUrl: string, diferir: Diferir): Promise<Response> {
  const url = new URL(req.url);
  const t = url.searchParams.get('t');
  const c = await porToken(db, t);
  const locale = c?.locale ?? localeDe(req);
  const responder = req.method === 'POST' ? volver : ir;
  if (c?.estado === 'activo') return responder(paginaPreferencias(env, locale, { estado: 'confirmado' }));
  // Solo se confirma lo pendiente. Quien se dio de baja vuelve a suscribirse desde el sitio, con
  // una confirmación nueva: el enlace de baja de un correo reenviado no sirve para reactivarlo.
  if (!c || c.estado !== 'pendiente') return responder(paginaPreferencias(env, locale, { estado: 'invalido' }));
  if (req.method !== 'POST') return ir(paginaPreferencias(env, locale, { accion: 'confirmar', t: t! }));

  const ahoraMs = ahora();
  const ipHash = await hashIp(req.headers.get('cf-connecting-ip'), env.SAL_IP);
  await db.update(contactos).set({ estado: 'activo', confirmado: ahoraMs, baja: null, motivoBaja: null, actualizado: ahoraMs }).where(eq(contactos.id, c.id));
  const [pendiente] = await db
    .select()
    .from(consentimientosMarketing)
    .where(and(eq(consentimientosMarketing.contactoId, c.id), sql`${consentimientosMarketing.confirmado} is null`, sql`${consentimientosMarketing.revocado} is null`))
    .orderBy(sql`${consentimientosMarketing.aceptado} desc`)
    .limit(1);
  if (pendiente) {
    await db.update(consentimientosMarketing).set({ confirmado: ahoraMs }).where(eq(consentimientosMarketing.id, pendiente.id));
  } else {
    // Invitado por el equipo: la autorización nace aquí, con el texto vigente.
    const autorizacion = vigente('novedades');
    await db.insert(consentimientosMarketing).values({
      id: uuid(),
      contactoId: c.id,
      version: autorizacion.version,
      texto: autorizacion[c.locale],
      aceptado: ahoraMs,
      confirmado: ahoraMs,
      ipHash,
      userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      revocado: null,
    });
  }
  if (!c.bienvenida) diferir(enviarBienvenida(env, db, { ...c, estado: 'activo' }, appUrl).catch((e) => console.error('[bienvenida]', e)));
  return volver(paginaPreferencias(env, c.locale, { estado: 'confirmado' }));
}

export async function darDeBaja(db: DrizzleD1Database, c: Contacto, motivo: NonNullable<Contacto['motivoBaja']>, campanaId?: string | null): Promise<void> {
  const t = ahora();
  await db.batch([
    db.update(contactos).set({ estado: motivo === 'rebote' ? 'rebotado' : 'baja', baja: t, motivoBaja: motivo, actualizado: t }).where(eq(contactos.id, c.id)),
    db.update(consentimientosMarketing).set({ revocado: t }).where(and(eq(consentimientosMarketing.contactoId, c.id), sql`${consentimientosMarketing.revocado} is null`)),
    // Si quedaban envíos pendientes (o en espera de una prueba A/B) para este contacto, ya no salen.
    db.update(envios).set({ estado: 'cancelado' }).where(and(eq(envios.contactoId, c.id), inArray(envios.estado, ['pendiente', 'espera']))),
    ...(campanaId ? [db.update(envios).set({ baja: t }).where(and(eq(envios.contactoId, c.id), eq(envios.campanaId, campanaId)))] : []),
  ]);
}

/**
 * GET lleva al botón de baja del sitio. POST da de baja: si es la baja de un clic de RFC 8058
 * (el proveedor de correo, sin navegador) responde 200; si viene del sitio, vuelve a él.
 */
export async function baja(req: Request, db: DrizzleD1Database, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const t = url.searchParams.get('t');
  const c = await porToken(db, t);
  const locale = c?.locale ?? localeDe(req);
  const unClic = req.method === 'POST' && (await req.text()).includes('List-Unsubscribe=One-Click');
  const responder = unClic ? () => new Response(c ? 'ok' : 'no existe', { status: c ? 200 : 404 }) : req.method === 'POST' ? volver : ir;
  if (!c) return responder(paginaPreferencias(env, locale, { estado: 'invalido' }));
  if (c.estado === 'baja' || c.estado === 'rebotado') return responder(paginaPreferencias(env, locale, { estado: 'baja' }));
  if (req.method !== 'POST') {
    const campana = url.searchParams.get('c');
    return ir(paginaPreferencias(env, locale, { accion: 'baja', t: t!, ...(campana ? { c: campana } : {}) }));
  }
  await darDeBaja(db, c, 'enlace', url.searchParams.get('c'));
  return responder(paginaPreferencias(env, locale, { estado: 'baja' }));
}

/** Pausas que ofrece la página de preferencias, en días. */
export const PAUSAS = [0, 30, 90, 180] as const;

/** Correo enmascarado para la página de preferencias: confirma a quién se edita sin exponerlo entero. */
export const enmascarar = (email: string) => {
  const [usuario = '', dominio = ''] = email.split('@');
  return `${usuario.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(6, usuario.length - 2)))}@${dominio}`;
};

/** GET /v1/suscripcion/datos?t=: lo que la página de preferencias necesita para pintar el formulario. */
export async function datosPreferencias(req: Request, db: DrizzleD1Database, cors: Record<string, string>): Promise<Response> {
  const c = await porToken(db, new URL(req.url).searchParams.get('t'));
  if (!c || c.motivoBaja === 'supresion') return json({ ok: false }, 404, cors);
  return json(
    {
      ok: true,
      email: enmascarar(c.email),
      estado: c.estado,
      locale: c.locale,
      intereses: c.intereses,
      pausaHasta: c.pausaHasta && c.pausaHasta > ahora() ? c.pausaHasta : null,
    },
    200,
    cors,
  );
}

/**
 * /v1/suscripcion/preferencias?t=. GET lleva a la página del sitio. POST (formulario del sitio)
 * guarda temas, idioma y pausa de un contacto activo, y vuelve al sitio.
 */
export async function preferencias(req: Request, db: DrizzleD1Database, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const t = url.searchParams.get('t');
  const c = await porToken(db, t);
  const locale = c?.locale ?? localeDe(req);
  if (!c || c.motivoBaja === 'supresion') return (req.method === 'POST' ? volver : ir)(paginaPreferencias(env, locale, { estado: 'invalido' }));
  if (req.method !== 'POST') return ir(paginaPreferencias(env, locale, { accion: 'preferencias', t: t! }));
  if (c.estado !== 'activo') return volver(paginaPreferencias(env, locale, { estado: c.estado === 'pendiente' ? 'invalido' : 'baja' }));

  const f = await req.formData().catch(() => new FormData());
  const nuevoLocale: Locale = f.get('locale') === 'en' ? 'en' : f.get('locale') === 'es' ? 'es' : c.locale;
  const dias = Number(f.get('pausa'));
  const pausa = PAUSAS.includes(dias as (typeof PAUSAS)[number]) ? dias : 0;
  const momento = ahora();
  await db
    .update(contactos)
    .set({
      intereses: limpiarIntereses(f.getAll('intereses')),
      locale: nuevoLocale,
      pausaHasta: pausa ? momento + pausa * DIA : null,
      actualizado: momento,
    })
    .where(eq(contactos.id, c.id));
  return volver(paginaPreferencias(env, nuevoLocale, { estado: 'actualizado', t: t! }));
}
