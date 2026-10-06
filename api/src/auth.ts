// Acceso del equipo al admin con enlace mágico por correo: sin contraseñas que filtrar ni
// recuperar. Los tokens nunca se guardan en claro (solo su SHA-256), el enlace sirve una vez
// y vence rápido, y las sesiones se pueden revocar una a una o todas.
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { enlaces, sesiones, usuarios, type Usuario } from './db/schema';
import { enviar, correoEnlaceAcceso } from './correo';
import { dentroDelLimite } from './limite';
import type { Env } from './env';
import { ahora, sha256, token, json, uuid, HORA, DIA } from './util';

export const COOKIE = '__Host-antidoto';
export const MINUTOS_ENLACE = 15;
export const DIAS_SESION = 30;
export const ENLACES_POR_HORA = 5;

export interface Sesion {
  usuario: Usuario;
  hash: string;
  /** Id público de la sesión (null en sesiones anteriores a la migración 0005 que no se rellenaron). */
  id: string | null;
}

const leerCookie = (req: Request, nombre: string): string | null => {
  const c = req.headers.get('cookie') ?? '';
  for (const parte of c.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return v.join('=') || null;
  }
  return null;
};

export const cookieSesion = (valor: string, maxAge: number) =>
  `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** Las peticiones que cambian algo deben venir de la propia app (defensa contra CSRF). */
export function mismoOrigen(req: Request): boolean {
  return req.headers.get('origin') === new URL(req.url).origin;
}

async function leerEmail(req: Request): Promise<string> {
  const tipo = req.headers.get('content-type') ?? '';
  if (tipo.includes('application/json')) {
    const d = (await req.json().catch(() => ({}))) as { email?: unknown };
    return typeof d.email === 'string' ? d.email : '';
  }
  const f = await req.formData().catch(() => null);
  return String(f?.get('email') ?? '');
}

/** POST /auth/enlace. Responde lo mismo exista o no el correo, para no revelar quién es del equipo. */
export async function pedirEnlace(req: Request, env: Env, db: DrizzleD1Database, appUrl: string): Promise<Response> {
  const email = (await leerEmail(req)).trim().toLowerCase().slice(0, 200);
  const respuesta = json({ ok: true });
  if (!email) return respuesta;

  const [u] = await db.select().from(usuarios).where(and(eq(usuarios.email, email), eq(usuarios.activo, true)));
  if (!u) return respuesta;

  const t = ahora();
  if (!(await dentroDelLimite(db, `enlace:${u.id}`, ENLACES_POR_HORA, t))) return respuesta;

  const secreto = token();
  await db.insert(enlaces).values({ hash: await sha256(secreto), usuarioId: u.id, creado: t, expira: t + MINUTOS_ENLACE * 60_000, usado: null });
  await enviar(env, { para: u.email, ...correoEnlaceAcceso(`${appUrl}/auth/entrar?t=${encodeURIComponent(secreto)}`, MINUTOS_ENLACE) });
  return respuesta;
}

/**
 * GET /auth/entrar: no consume el enlace. Redirige al panel con el token en el fragmento
 * (#t=...), donde un botón hace el POST. Los filtros de correo (Outlook Safe Links, por ejemplo)
 * abren los enlaces para revisarlos y gastarían el de un solo uso; el fragmento, además, no
 * viaja al servidor ni queda en el Referer.
 */
export function paginaEntrar(req: Request): Response {
  const t = new URL(req.url).searchParams.get('t') ?? '';
  return new Response(null, { status: 303, headers: { location: `/admin/entrar#t=${encodeURIComponent(t)}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}

/** POST /auth/entrar: gasta el enlace y abre la sesión. */
export async function entrar(req: Request, db: DrizzleD1Database): Promise<Response> {
  const f = await req.formData().catch(() => null);
  const secreto = String(f?.get('t') ?? '');
  const volver = (motivo: string) => Response.redirect(`${new URL(req.url).origin}/admin/?error=${motivo}`, 303);
  if (!secreto) return volver('enlace');

  const t = ahora();
  const hash = await sha256(secreto);
  // El UPDATE condicional hace el enlace de un solo uso aunque lleguen dos clics a la vez.
  const usados = await db
    .update(enlaces)
    .set({ usado: t })
    .where(and(eq(enlaces.hash, hash), isNull(enlaces.usado), gt(enlaces.expira, t)))
    .returning({ usuarioId: enlaces.usuarioId });
  const usuarioId = usados[0]?.usuarioId;
  if (!usuarioId) return volver('enlace');

  const [u] = await db.select().from(usuarios).where(and(eq(usuarios.id, usuarioId), eq(usuarios.activo, true)));
  if (!u) return volver('enlace');

  const secretoSesion = token();
  await db.insert(sesiones).values({
    hash: await sha256(secretoSesion),
    id: uuid(),
    usuarioId: u.id,
    creada: t,
    expira: t + DIAS_SESION * DIA,
    ultimoUso: t,
    userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    revocada: null,
  });
  return new Response(null, {
    status: 303,
    headers: { location: '/admin/', 'set-cookie': cookieSesion(secretoSesion, DIAS_SESION * 86_400), 'cache-control': 'no-store' },
  });
}

/** Sesión vigente de la petición, o null. Renueva el último uso como mucho una vez por hora. */
export async function sesionActual(req: Request, db: DrizzleD1Database): Promise<Sesion | null> {
  const secreto = leerCookie(req, COOKIE);
  if (!secreto) return null;
  const hash = await sha256(secreto);
  const t = ahora();
  const [fila] = await db
    .select({ s: sesiones, u: usuarios })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(and(eq(sesiones.hash, hash), isNull(sesiones.revocada), gt(sesiones.expira, t), eq(usuarios.activo, true)));
  if (!fila) return null;
  if (t - fila.s.ultimoUso > HORA) await db.update(sesiones).set({ ultimoUso: t }).where(eq(sesiones.hash, hash));
  return { usuario: fila.u, hash, id: fila.s.id };
}

/** GET /admin/api/yo/sesiones: las sesiones abiertas de quien pregunta, la actual marcada. */
export async function listarSesiones(db: DrizzleD1Database, sesion: Sesion): Promise<Response> {
  const t = ahora();
  const filas = await db
    .select({ id: sesiones.id, creada: sesiones.creada, ultimoUso: sesiones.ultimoUso, expira: sesiones.expira, userAgent: sesiones.userAgent, hash: sesiones.hash })
    .from(sesiones)
    .where(and(eq(sesiones.usuarioId, sesion.usuario.id), isNull(sesiones.revocada), gt(sesiones.expira, t)))
    .orderBy(desc(sesiones.ultimoUso));
  return json({ sesiones: filas.map(({ hash, ...f }) => ({ ...f, actual: hash === sesion.hash })) });
}

/** POST /admin/api/yo/sesiones/<id>/revocar: solo las propias; la de otra persona responde 404. */
export async function revocarSesion(db: DrizzleD1Database, sesion: Sesion, id: string): Promise<Response> {
  const r = await db
    .update(sesiones)
    .set({ revocada: ahora() })
    .where(and(eq(sesiones.id, id), eq(sesiones.usuarioId, sesion.usuario.id), isNull(sesiones.revocada)))
    .returning({ id: sesiones.id });
  if (!r.length) return json({ error: 'no existe' }, 404);
  return listarSesiones(db, sesion);
}

export async function salir(db: DrizzleD1Database, sesion: Sesion, todas: boolean): Promise<Response> {
  const t = ahora();
  await db
    .update(sesiones)
    .set({ revocada: t })
    .where(and(todas ? eq(sesiones.usuarioId, sesion.usuario.id) : eq(sesiones.hash, sesion.hash), isNull(sesiones.revocada)));
  return json({ ok: true }, 200, { 'set-cookie': cookieSesion('', 0) });
}
