// Suscripción a novedades con doble confirmación. Quien se suscribe (desde el pie del sitio, el
// cotizador o porque el equipo lo invitó) recibe un correo con un botón para confirmar; solo
// entonces queda "activo" y la autorización queda confirmada. La baja es de un clic, incluida la
// de RFC 8058 (List-Unsubscribe-Post) que usan Gmail y Yahoo.
import { and, eq, gt, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { contactos, consentimientosMarketing, envios, SERVICIOS, type Contacto, type ServicioId } from '../db/schema';
import { enviar } from '../correo';
import { aceptada, vigente, type Version } from '../consentimiento';
import type { Env } from '../env';
import { ahora, hashIp, uuid, json, token, escapar, HORA } from '../util';
import { TIEMPO_MINIMO_MS } from '../validar';
import { dentroDelLimite } from '../limite';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** No se reenvía la confirmación a la misma persona antes de esto. */
const ESPERA_CONFIRMACION = 10 * 60_000;
export const SUSCRIPCIONES_POR_HORA = 5;

export interface Solicitud {
  email: string;
  nombre?: string | null;
  empresa?: string | null;
  locale: 'es' | 'en';
  origen: Contacto['origen'];
  intereses?: ServicioId[];
  leadId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  /** Versión de la autorización que aceptó; sin ella, la vigente. */
  autorizacion?: Version | null;
}

const limpiarIntereses = (v: unknown): ServicioId[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is ServicioId => SERVICIOS.includes(x as ServicioId)))] : [];

const enlace = (appUrl: string, accion: 'confirmar' | 'baja', t: string, campana?: string) =>
  `${appUrl}/v1/suscripcion/${accion}?t=${encodeURIComponent(t)}${campana ? `&c=${encodeURIComponent(campana)}` : ''}`;

export const enlaceBaja = (appUrl: string, t: string, campana?: string) => enlace(appUrl, 'baja', t, campana);

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
    };
    await db.insert(contactos).values(contacto);
  }

  // Quien se suscribe por su cuenta acepta el texto ahora (y lo confirma por correo). A un
  // invitado por el equipo se le registra la autorización cuando confirma.
  if (s.origen !== 'admin') {
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
  const destinatario = { locale: contacto.locale, origen: s.origen, nombre: s.origen === 'admin' ? contacto.nombre : null };
  await enviar(env, { para: email, ...correoConfirmacion(destinatario, enlace(appUrl, 'confirmar', contacto.token)) });
}

export function correoConfirmacion(c: Pick<Contacto, 'nombre' | 'locale' | 'origen'>, href: string) {
  const en = c.locale === 'en';
  const hola = c.nombre ? (en ? `Hi ${c.nombre},` : `Hola ${c.nombre},`) : en ? 'Hi,' : 'Hola,';
  const cuerpo = en
    ? c.origen === 'admin'
      ? 'The Antídoto team invites you to receive our news, content and offers by email. If you want to, confirm with the button.'
      : 'Confirm that you want to receive news, content and offers from Antídoto by email.'
    : c.origen === 'admin'
      ? 'El equipo de Antídoto te invita a recibir por correo nuestras novedades, contenidos y propuestas. Si quieres, confírmalo con el botón.'
      : 'Confirma que quieres recibir por correo novedades, contenidos y propuestas de Antídoto.';
  const boton = en ? 'Confirm subscription' : 'Confirmar suscripción';
  const nota = en ? 'If you did not ask for this, ignore this email: we will not write to you.' : 'Si no lo pediste, ignora este correo: no te vamos a escribir.';
  return {
    asunto: en ? 'Confirm your subscription · Antídoto' : 'Confirma tu suscripción · Antídoto',
    html: `<!doctype html><html><body style="margin:0;background:#F1EFE9;font-family:Helvetica,Arial,sans-serif;color:#0F181D"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px"><tr><td style="padding:28px;border-top:4px solid #3BC8F3;border-radius:14px;font-size:15px;line-height:1.55"><p style="margin:0 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0C5C7D">Antídoto</p><p style="margin:12px 0">${escapar(hola)}</p><p style="margin:0 0 8px">${escapar(cuerpo)}</p><p style="margin:20px 0"><a href="${escapar(href)}" style="display:inline-block;background:#0F181D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${escapar(boton)}</a></p><p style="margin:0;color:#5b6b70;font-size:13px">${escapar(nota)}</p></td></tr></table></td></tr></table></body></html>`,
    texto: `${hola}\n\n${cuerpo}\n\n${boton}: ${href}\n\n${nota}`,
  };
}

/** POST /v1/suscripciones desde el pie del sitio. Responde igual pase lo que pase. */
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
        origen: 'pie',
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

// Páginas de confirmación y baja -----------------------------------------------------------

const TEXTOS = {
  es: {
    confirmarT: 'Confirmar suscripción',
    confirmarP: 'Confirma que quieres recibir novedades de Antídoto por correo.',
    confirmarB: 'Confirmar',
    confirmadoT: 'Listo, ya estás suscrito',
    confirmadoP: 'Te escribiremos con novedades y contenidos. En cada correo hay un enlace para darte de baja.',
    bajaT: 'Darte de baja',
    bajaP: 'Dejarás de recibir novedades de Antídoto por correo. Las respuestas a tus solicitudes siguen llegando.',
    bajaB: 'Darme de baja',
    bajadoT: 'Listo, te diste de baja',
    bajadoP: 'No te enviaremos más novedades. Si fue un error, puedes suscribirte de nuevo desde el sitio.',
    invalidoT: 'Enlace no válido',
    invalidoP: 'Este enlace no existe o ya no sirve. Si necesitas ayuda, escríbenos.',
    volver: 'Ir al sitio',
  },
  en: {
    confirmarT: 'Confirm subscription',
    confirmarP: 'Confirm that you want to receive news from Antídoto by email.',
    confirmarB: 'Confirm',
    confirmadoT: 'Done, you are subscribed',
    confirmadoP: 'We will write with news and content. Every email has a link to unsubscribe.',
    bajaT: 'Unsubscribe',
    bajaP: 'You will stop receiving news from Antídoto by email. Replies to your requests will still reach you.',
    bajaB: 'Unsubscribe me',
    bajadoT: 'Done, you are unsubscribed',
    bajadoP: 'We will not send you more news. If it was a mistake, you can subscribe again on the site.',
    invalidoT: 'Invalid link',
    invalidoP: 'This link does not exist or no longer works. If you need help, write to us.',
    volver: 'Go to the site',
  },
};

const SITIO = { es: 'https://antidotocolombia.com/', en: 'https://antidotocolombia.com/en/' };

function pagina(locale: 'es' | 'en', titulo: string, parrafo: string, form?: { action: string; boton: string }, status = 200): Response {
  const x = TEXTOS[locale];
  const cuerpo = form
    ? `<form method="post" action="${escapar(form.action)}"><button class="btn" type="submit">${escapar(form.boton)}</button></form>`
    : `<p><a href="${SITIO[locale]}">${escapar(x.volver)}</a></p>`;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapar(titulo)} · Antídoto</title><link rel="stylesheet" href="/admin/app.css"></head>
<body class="entrar"><main class="caja"><p class="marca">Antídoto</p><h1>${escapar(titulo)}</h1><p class="suave">${escapar(parrafo)}</p>${cuerpo}</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'referrer-policy': 'no-referrer',
    },
  });
}

async function porToken(db: DrizzleD1Database, t: string | null): Promise<Contacto | null> {
  if (!t || t.length > 100) return null;
  const [c] = await db.select().from(contactos).where(eq(contactos.token, t));
  return c ?? null;
}

const localeDe = (req: Request): 'es' | 'en' => (/^en\b/i.test(req.headers.get('accept-language') ?? '') ? 'en' : 'es');

/**
 * GET muestra un botón (los filtros de correo abren los enlaces y no deben confirmar ni dar de
 * baja por su cuenta); POST hace la acción. La baja por POST también es la de un clic de RFC 8058.
 */
export async function confirmar(req: Request, db: DrizzleD1Database, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const c = await porToken(db, url.searchParams.get('t'));
  if (c?.estado === 'activo') return pagina(c.locale, TEXTOS[c.locale].confirmadoT, TEXTOS[c.locale].confirmadoP);
  // Solo se confirma lo pendiente. Quien se dio de baja vuelve a suscribirse desde el sitio, con
  // una confirmación nueva: el enlace de baja de un correo reenviado no sirve para reactivarlo.
  if (!c || c.estado !== 'pendiente') {
    const l = localeDe(req);
    return pagina(l, TEXTOS[l].invalidoT, TEXTOS[l].invalidoP, undefined, 404);
  }
  const x = TEXTOS[c.locale];
  if (req.method !== 'POST') return pagina(c.locale, x.confirmarT, x.confirmarP, { action: `${url.pathname}${url.search}`, boton: x.confirmarB });

  const t = ahora();
  const ipHash = await hashIp(req.headers.get('cf-connecting-ip'), env.SAL_IP);
  await db.update(contactos).set({ estado: 'activo', confirmado: t, baja: null, motivoBaja: null, actualizado: t }).where(eq(contactos.id, c.id));
  const [pendiente] = await db
    .select()
    .from(consentimientosMarketing)
    .where(and(eq(consentimientosMarketing.contactoId, c.id), sql`${consentimientosMarketing.confirmado} is null`, sql`${consentimientosMarketing.revocado} is null`))
    .orderBy(sql`${consentimientosMarketing.aceptado} desc`)
    .limit(1);
  if (pendiente) {
    await db.update(consentimientosMarketing).set({ confirmado: t }).where(eq(consentimientosMarketing.id, pendiente.id));
  } else {
    // Invitado por el equipo: la autorización nace aquí, con el texto vigente.
    const autorizacion = vigente('novedades');
    await db.insert(consentimientosMarketing).values({
      id: uuid(),
      contactoId: c.id,
      version: autorizacion.version,
      texto: autorizacion[c.locale],
      aceptado: t,
      confirmado: t,
      ipHash,
      userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      revocado: null,
    });
  }
  return pagina(c.locale, x.confirmadoT, x.confirmadoP);
}

export async function darDeBaja(db: DrizzleD1Database, c: Contacto, motivo: NonNullable<Contacto['motivoBaja']>, campanaId?: string | null): Promise<void> {
  const t = ahora();
  await db.batch([
    db.update(contactos).set({ estado: motivo === 'rebote' ? 'rebotado' : 'baja', baja: t, motivoBaja: motivo, actualizado: t }).where(eq(contactos.id, c.id)),
    db.update(consentimientosMarketing).set({ revocado: t }).where(and(eq(consentimientosMarketing.contactoId, c.id), sql`${consentimientosMarketing.revocado} is null`)),
    // Si quedaban envíos pendientes para este contacto, ya no salen.
    db.update(envios).set({ estado: 'cancelado' }).where(and(eq(envios.contactoId, c.id), eq(envios.estado, 'pendiente'))),
    ...(campanaId ? [db.update(envios).set({ baja: t }).where(and(eq(envios.contactoId, c.id), eq(envios.campanaId, campanaId)))] : []),
  ]);
}

export async function baja(req: Request, db: DrizzleD1Database): Promise<Response> {
  const url = new URL(req.url);
  const c = await porToken(db, url.searchParams.get('t'));
  if (!c) {
    const l = localeDe(req);
    return pagina(l, TEXTOS[l].invalidoT, TEXTOS[l].invalidoP, undefined, 404);
  }
  const x = TEXTOS[c.locale];
  if (c.estado === 'baja' || c.estado === 'rebotado') return pagina(c.locale, x.bajadoT, x.bajadoP);
  if (req.method !== 'POST') return pagina(c.locale, x.bajaT, x.bajaP, { action: `${url.pathname}${url.search}`, boton: x.bajaB });
  await darDeBaja(db, c, 'enlace', url.searchParams.get('c'));
  return pagina(c.locale, x.bajadoT, x.bajadoP);
}
