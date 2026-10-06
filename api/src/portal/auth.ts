// Acceso de los clientes al portal de proyectos, con enlace mágico como el del equipo (src/auth.ts)
// pero separado: otra tabla de usuarios, otros enlaces, otras sesiones y otra cookie. Una sesión
// del equipo no abre el portal ni al revés. Cookie SameSite=Strict: el portal no se abre desde
// enlaces de otros sitios con la sesión puesta.
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { enlacesCliente, sesionesCliente, usuariosCliente, organizaciones, type UsuarioCliente } from '../db/schema';
import { enviar, correoEnlacePortal } from '../correo';
import { dentroDelLimite } from '../limite';
import type { Env } from '../env';
import { ahora, sha256, token, json, HORA, DIA } from '../util';

export const COOKIE_CLIENTE = '__Host-antidoto-cliente';
export const MINUTOS_ENLACE_CLIENTE = 15;
export const DIAS_SESION_CLIENTE = 14;

export interface SesionCliente {
  usuario: UsuarioCliente;
  organizacion: { id: string; nombre: string };
  hash: string;
}

const leerCookie = (req: Request, nombre: string): string | null => {
  for (const parte of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return v.join('=') || null;
  }
  return null;
};

export const cookieCliente = (valor: string, maxAge: number) => `${COOKIE_CLIENTE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

/** POST /portal/auth/enlace. Responde lo mismo exista o no el correo. */
export async function pedirEnlaceCliente(req: Request, env: Env, db: DrizzleD1Database, appUrl: string): Promise<Response> {
  const d = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof d.email === 'string' ? d.email.trim().toLowerCase().slice(0, 200) : '';
  const respuesta = json({ ok: true });
  if (!email) return respuesta;
  const [u] = await db.select().from(usuariosCliente).where(and(eq(usuariosCliente.email, email), eq(usuariosCliente.activo, true)));
  if (!u) return respuesta;
  const t = ahora();
  if (!(await dentroDelLimite(db, `enlace-cliente:${u.id}`, 5, t))) return respuesta;
  const secreto = token();
  await db.insert(enlacesCliente).values({ hash: await sha256(secreto), usuarioId: u.id, creado: t, expira: t + MINUTOS_ENLACE_CLIENTE * 60_000, usado: null });
  await enviar(env, { para: u.email, ...correoEnlacePortal(`${appUrl}/portal/auth/entrar?t=${encodeURIComponent(secreto)}`, MINUTOS_ENLACE_CLIENTE) });
  return respuesta;
}

/** GET /portal/auth/entrar: no gasta el enlace, lleva al portal con el token en el fragmento. */
export function paginaEntrarCliente(req: Request): Response {
  const t = new URL(req.url).searchParams.get('t') ?? '';
  return new Response(null, { status: 303, headers: { location: `/portal/entrar#t=${encodeURIComponent(t)}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}

/** POST /portal/auth/entrar: gasta el enlace y abre la sesión del cliente. */
export async function entrarCliente(req: Request, db: DrizzleD1Database): Promise<Response> {
  const f = await req.formData().catch(() => null);
  const secreto = String(f?.get('t') ?? '');
  const volver = () => Response.redirect(`${new URL(req.url).origin}/portal/?error=enlace`, 303);
  if (!secreto) return volver();
  const t = ahora();
  const usados = await db
    .update(enlacesCliente)
    .set({ usado: t })
    .where(and(eq(enlacesCliente.hash, await sha256(secreto)), isNull(enlacesCliente.usado), gt(enlacesCliente.expira, t)))
    .returning({ usuarioId: enlacesCliente.usuarioId });
  const usuarioId = usados[0]?.usuarioId;
  if (!usuarioId) return volver();
  const [u] = await db.select().from(usuariosCliente).where(and(eq(usuariosCliente.id, usuarioId), eq(usuariosCliente.activo, true)));
  if (!u) return volver();
  const sesion = token();
  await db.batch([
    db.insert(sesionesCliente).values({ hash: await sha256(sesion), usuarioId: u.id, creada: t, expira: t + DIAS_SESION_CLIENTE * DIA, ultimoUso: t, userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null, revocada: null }),
    db.update(usuariosCliente).set({ ultimoAcceso: t }).where(eq(usuariosCliente.id, u.id)),
  ]);
  return new Response(null, { status: 303, headers: { location: '/portal/', 'set-cookie': cookieCliente(sesion, DIAS_SESION_CLIENTE * 86_400), 'cache-control': 'no-store' } });
}

export async function sesionCliente(req: Request, db: DrizzleD1Database): Promise<SesionCliente | null> {
  const secreto = leerCookie(req, COOKIE_CLIENTE);
  if (!secreto) return null;
  const hash = await sha256(secreto);
  const t = ahora();
  const [fila] = await db
    .select({ s: sesionesCliente, u: usuariosCliente, o: { id: organizaciones.id, nombre: organizaciones.nombre } })
    .from(sesionesCliente)
    .innerJoin(usuariosCliente, eq(usuariosCliente.id, sesionesCliente.usuarioId))
    .innerJoin(organizaciones, eq(organizaciones.id, usuariosCliente.organizacionId))
    .where(and(eq(sesionesCliente.hash, hash), isNull(sesionesCliente.revocada), gt(sesionesCliente.expira, t), eq(usuariosCliente.activo, true)));
  if (!fila) return null;
  if (t - fila.s.ultimoUso > HORA) await db.update(sesionesCliente).set({ ultimoUso: t }).where(eq(sesionesCliente.hash, hash));
  return { usuario: fila.u, organizacion: fila.o, hash };
}

export async function salirCliente(db: DrizzleD1Database, s: SesionCliente): Promise<Response> {
  await db.update(sesionesCliente).set({ revocada: ahora() }).where(eq(sesionesCliente.hash, s.hash));
  return json({ ok: true }, 200, { 'set-cookie': cookieCliente('', 0) });
}
