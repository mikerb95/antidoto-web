// Acceso del equipo al admin con enlace mágico por correo: sin contraseñas que filtrar ni
// recuperar. Los tokens nunca se guardan en claro (solo su SHA-256), el enlace sirve una vez
// y vence rápido, y las sesiones se pueden revocar una a una o todas.
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from './db/conexion';
import { enlaces, sesiones, usuarios, type Usuario } from './db/schema';
import { enviar, correoEnlaceAcceso } from './correo';
import { dentroDelLimite } from './limite';
import { registrarAcceso } from './auditoria';
import type { Env } from './env';
import { ahora, sha256, token, json, uuid, hashIp, ipCliente, HORA, DIA } from './util';

export const COOKIE = '__Host-antidoto';
export const MINUTOS_ENLACE = 15;
export const DIAS_SESION = 30;
/** Sin usar el panel durante estos días, la sesión se cierra aunque no haya vencido. */
export const DIAS_INACTIVIDAD = 7;
/** Enlaces por persona y por IP, y en total por persona, cada hora. */
export const ENLACES_POR_HORA = 5;
export const ENLACES_POR_PERSONA = 20;
/** Pedidos de enlace por IP y hora, existan o no los correos. */
export const ENLACES_POR_IP = 10;

export interface Sesion {
  usuario: Usuario;
  hash: string;
  /** Id público de la sesión (null en sesiones anteriores a la migración 0005 que no se rellenaron). */
  id: string | null;
}

export const leerCookie = (req: Request, nombre: string): string | null => {
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

/**
 * ¿Se manda otro enlace? Por IP cuenta todo pedido (exista o no el correo); por persona, sus
 * enlaces desde esa IP y, más alto, el total. Así alguien que pide enlaces con el correo de otra
 * persona gasta su propio cupo y no el de ella, que entra desde su IP. Sin IP (local, pruebas)
 * queda solo el cupo por persona. Lo usa también el portal (src/portal/auth.ts).
 */
export async function puedeMandarEnlace<U extends { id: string }>(db: Db, prefijo: string, ipHash: string | null, buscar: () => Promise<U | undefined>, t = ahora()): Promise<U | null> {
  if (ipHash && !(await dentroDelLimite(db, `${prefijo}-ip:${ipHash}`, ENLACES_POR_IP, t))) return null;
  const u = await buscar();
  if (!u) return null;
  if (!(await dentroDelLimite(db, `${prefijo}:${u.id}:${ipHash ?? 'sin-ip'}`, ENLACES_POR_HORA, t))) return null;
  if (!(await dentroDelLimite(db, `${prefijo}:${u.id}`, ENLACES_POR_PERSONA, t))) return null;
  return u;
}

/**
 * POST /auth/enlace. Responde de inmediato y lo mismo exista o no el correo: la búsqueda y el envío
 * van después de responder, para que ni el cuerpo ni el tiempo revelen quién es del equipo.
 */
export async function pedirEnlace(req: Request, env: Env, db: Db, appUrl: string, diferir: (p: Promise<unknown>) => void): Promise<Response> {
  const email = (await leerEmail(req)).trim().toLowerCase().slice(0, 200);
  if (!email) return json({ ok: true });
  const ip = ipCliente(req);

  diferir(
    (async () => {
      const t = ahora();
      const buscar = async () => (await db.select().from(usuarios).where(and(eq(usuarios.email, email), eq(usuarios.activo, true), isNull(usuarios.githubId))))[0];
      const u = await puedeMandarEnlace(db, 'enlace', await hashIp(ip, env.SAL_IP, t), buscar, t);
      if (!u) return;
      const secreto = token();
      await db.insert(enlaces).values({ hash: await sha256(secreto), usuarioId: u.id, creado: t, expira: t + MINUTOS_ENLACE * 60_000, usado: null });
      await enviar(env, { para: u.email, ...correoEnlaceAcceso(`${appUrl}/auth/entrar?t=${encodeURIComponent(secreto)}`, MINUTOS_ENLACE) });
    })().catch((e) => console.error('[auth] enlace', e)),
  );
  return json({ ok: true });
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

/** POST /auth/entrar: gasta el enlace y abre la sesión. Los accesos y los intentos fallidos quedan en la auditoría. */
export async function entrar(req: Request, env: Env, db: Db): Promise<Response> {
  const f = await req.formData().catch(() => null);
  const secreto = String(f?.get('t') ?? '');
  const volver = async (motivo: string) => {
    await registrarAcceso(db, req, env.SAL_IP, 'sesion.fallida', null);
    return Response.redirect(`${new URL(req.url).origin}/admin/?error=${motivo}`, 303);
  };
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

  // Una cuenta ligada a GitHub no entra con enlace, aunque le quede uno pedido antes de ligarla.
  const [u] = await db.select().from(usuarios).where(and(eq(usuarios.id, usuarioId), eq(usuarios.activo, true), isNull(usuarios.githubId)));
  if (!u) return volver('enlace');
  return abrirSesion(req, env, db, u, t);
}

/** Crea la sesión de alguien que ya probó quién es (enlace por correo o GitHub) y lo lleva al panel. */
export async function abrirSesion(req: Request, env: Env, db: Db, u: Usuario, t = ahora(), cookiesExtra: string[] = []): Promise<Response> {
  const secretoSesion = token();
  const idSesion = uuid();
  await db.insert(sesiones).values({
    hash: await sha256(secretoSesion),
    id: idSesion,
    usuarioId: u.id,
    creada: t,
    expira: t + DIAS_SESION * DIA,
    ultimoUso: t,
    userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    revocada: null,
  });
  await registrarAcceso(db, req, env.SAL_IP, 'sesion.entrar', u, 'sesion', idSesion);
  const headers = new Headers({ location: '/admin/', 'cache-control': 'no-store' });
  for (const c of [cookieSesion(secretoSesion, DIAS_SESION * 86_400), ...cookiesExtra]) headers.append('set-cookie', c);
  return new Response(null, { status: 303, headers });
}

/** Una sesión sigue abierta si no venció, no se revocó y se usó en los últimos DIAS_INACTIVIDAD días. */
const abierta = (t: number) => and(isNull(sesiones.revocada), gt(sesiones.expira, t), gt(sesiones.ultimoUso, t - DIAS_INACTIVIDAD * DIA));

/** Cuándo se cierra una sesión si nadie la usa: lo primero entre su vencimiento y la inactividad. */
export const cierre = (s: { expira: number; ultimoUso: number }) => Math.min(s.expira, s.ultimoUso + DIAS_INACTIVIDAD * DIA);

/** Sesión vigente de la petición, o null. Renueva el último uso como mucho una vez por hora. */
export async function sesionActual(req: Request, db: Db): Promise<Sesion | null> {
  const secreto = leerCookie(req, COOKIE);
  if (!secreto) return null;
  const hash = await sha256(secreto);
  const t = ahora();
  const [fila] = await db
    .select({ s: sesiones, u: usuarios })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(and(eq(sesiones.hash, hash), abierta(t), eq(usuarios.activo, true)));
  if (!fila) return null;
  if (t - fila.s.ultimoUso > HORA) await db.update(sesiones).set({ ultimoUso: t }).where(eq(sesiones.hash, hash));
  return { usuario: fila.u, hash, id: fila.s.id };
}

/** GET /admin/api/yo/sesiones: las sesiones abiertas de quien pregunta, la actual marcada. */
export async function listarSesiones(db: Db, sesion: Sesion): Promise<Response> {
  const t = ahora();
  const filas = await db
    .select({ id: sesiones.id, creada: sesiones.creada, ultimoUso: sesiones.ultimoUso, expira: sesiones.expira, userAgent: sesiones.userAgent, hash: sesiones.hash })
    .from(sesiones)
    .where(and(eq(sesiones.usuarioId, sesion.usuario.id), abierta(t)))
    .orderBy(desc(sesiones.ultimoUso));
  return json({ sesiones: filas.map(({ hash, ...f }) => ({ ...f, expira: cierre(f), actual: hash === sesion.hash })) });
}

/** POST /admin/api/yo/sesiones/<id>/revocar: solo las propias; la de otra persona responde 404. */
export async function revocarSesion(db: Db, sesion: Sesion, id: string): Promise<Response> {
  const r = await db
    .update(sesiones)
    .set({ revocada: ahora() })
    .where(and(eq(sesiones.id, id), eq(sesiones.usuarioId, sesion.usuario.id), isNull(sesiones.revocada)))
    .returning({ id: sesiones.id });
  if (!r.length) return json({ error: 'no existe' }, 404);
  return listarSesiones(db, sesion);
}

export async function salir(db: Db, sesion: Sesion, todas: boolean): Promise<Response> {
  const t = ahora();
  await db
    .update(sesiones)
    .set({ revocada: t })
    .where(and(todas ? eq(sesiones.usuarioId, sesion.usuario.id) : eq(sesiones.hash, sesion.hash), isNull(sesiones.revocada)));
  return json({ ok: true }, 200, { 'set-cookie': cookieSesion('', 0) });
}
