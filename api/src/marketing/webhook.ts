// POST /v1/resend/webhook: eventos de Resend (entregas, aperturas, clics, rebotes y quejas).
// Resend firma con Svix: HMAC-SHA256 de "id.timestamp.cuerpo" con el secreto whsec_ en base64.
// Un rebote permanente deja al contacto como "rebotado" y una queja lo da de baja: no se le
// vuelve a escribir. Los correos transaccionales (sin fila en envios) se ignoran.
import { eq, and, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { envios, contactos } from '../db/schema';
import { darDeBaja } from './suscripciones';
import type { Env } from '../env';
import { json } from '../util';

const TOLERANCIA_S = 5 * 60;

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Verifica la firma de Svix. Exportada para las pruebas. */
export async function firmaValida(secreto: string, id: string, ts: string, cuerpo: string, firmas: string, ahoraS = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!secreto || !id || !ts || !firmas) return false;
  const n = Number(ts);
  if (!Number.isFinite(n) || Math.abs(ahoraS - n) > TOLERANCIA_S) return false;
  const clave = await crypto.subtle.importKey('raw', b64(secreto.replace(/^whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`${id}.${ts}.${cuerpo}`)));
  const esperada = btoa(String.fromCharCode(...firma));
  // Puede venir más de una firma ("v1,xxx v1,yyy") durante una rotación de secreto.
  return firmas.split(' ').some((f) => {
    const [version, valor] = f.split(',');
    if (version !== 'v1' || !valor || valor.length !== esperada.length) return false;
    let diff = 0;
    for (let i = 0; i < valor.length; i++) diff |= valor.charCodeAt(i) ^ esperada.charCodeAt(i);
    return diff === 0;
  });
}

interface Evento {
  type: string;
  created_at?: string;
  data?: { email_id?: string; bounce?: { type?: string } };
}

export async function webhookResend(req: Request, env: Env, db: DrizzleD1Database): Promise<Response> {
  const cuerpo = await req.text();
  const h = req.headers;
  const valida = await firmaValida(env.RESEND_WEBHOOK_SECRET ?? '', h.get('svix-id') ?? '', h.get('svix-timestamp') ?? '', cuerpo, h.get('svix-signature') ?? '');
  if (!valida) return json({ ok: false }, 401);

  let ev: Evento;
  try {
    ev = JSON.parse(cuerpo);
  } catch {
    return json({ ok: false }, 400);
  }
  const resendId = ev.data?.email_id;
  if (!resendId) return json({ ok: true });
  const [envio] = await db.select().from(envios).where(eq(envios.resendId, resendId));
  if (!envio) return json({ ok: true });

  const t = ev.created_at ? Date.parse(ev.created_at) || Date.now() : Date.now();
  // Solo se guarda la primera vez de cada cosa (la primera apertura, el primer clic).
  const primera = <K extends 'entregado' | 'abierto' | 'clic' | 'rebote' | 'queja'>(campo: K) =>
    db.update(envios).set({ [campo]: t }).where(and(eq(envios.id, envio.id), isNull(envios[campo])));

  switch (ev.type) {
    case 'email.delivered':
      await primera('entregado');
      break;
    case 'email.opened':
      await primera('abierto');
      break;
    case 'email.clicked':
      await primera('clic');
      break;
    case 'email.bounced': {
      await primera('rebote');
      // Rebote permanente: la dirección no existe. Los temporales (buzón lleno) no dan de baja.
      if ((ev.data?.bounce?.type ?? 'Permanent') !== 'Transient') {
        const [c] = await db.select().from(contactos).where(eq(contactos.id, envio.contactoId));
        if (c && c.estado !== 'rebotado') await darDeBaja(db, c, 'rebote');
      }
      break;
    }
    case 'email.complained': {
      await primera('queja');
      const [c] = await db.select().from(contactos).where(eq(contactos.id, envio.contactoId));
      if (c && c.estado === 'activo') await darDeBaja(db, c, 'queja', envio.campanaId);
      break;
    }
  }
  return json({ ok: true });
}
