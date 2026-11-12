// Acceso de desarrollo con GitHub (rol dev). Solo entran las cuentas de GITHUB_DEV_IDS, por su id
// numérico (el nombre de usuario se puede cambiar; el id no). La primera vez se crea su usuario del
// panel, así que no depende del correo ni de crear-admin. Flujo OAuth de una OAuth App de GitHub:
//   GET /auth/github           lleva a GitHub con un `state` que también va en una cookie
//   GET /auth/github/callback  comprueba el state, cambia el código por un token, lee /user y abre la sesión
// No se pide ningún scope: basta el perfil público, y el token se descarta al terminar.
import { eq } from 'drizzle-orm';
import type { Db } from './db/conexion';
import { usuarios } from './db/schema';
import { abrirSesion, leerCookie } from './auth';
import { registrarAcceso } from './auditoria';
import type { Env } from './env';
import { ahora, token, uuid } from './util';

const COOKIE_ESTADO = '__Host-antidoto-gh';
const MINUTOS_ESTADO = 10;
const ESPERA_MS = 8000;

const cookieEstado = (valor: string, maxAge: number) => `${COOKIE_ESTADO}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** Ids numéricos de las cuentas de GitHub que entran como dev. */
export const idsDev = (env: Env): number[] =>
  (env.GITHUB_DEV_IDS ?? '')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

export const githubConfigurado = (env: Env): boolean => !!env.GITHUB_OAUTH_ID && !!env.GITHUB_OAUTH_SECRET && idsDev(env).length > 0;

const retorno = (appUrl: string) => `${appUrl}/auth/github/callback`;

const fallo = (extra: Record<string, string> = {}) =>
  new Response(null, { status: 303, headers: { location: '/admin/?error=github', 'cache-control': 'no-store', 'set-cookie': cookieEstado('', 0), ...extra } });

export function irAGithub(env: Env, appUrl: string): Response {
  if (!githubConfigurado(env)) return fallo();
  const estado = token();
  const destino = new URL('https://github.com/login/oauth/authorize');
  destino.searchParams.set('client_id', env.GITHUB_OAUTH_ID!);
  destino.searchParams.set('redirect_uri', retorno(appUrl));
  destino.searchParams.set('state', estado);
  destino.searchParams.set('allow_signup', 'false');
  return new Response(null, { status: 303, headers: { location: destino.href, 'cache-control': 'no-store', 'set-cookie': cookieEstado(estado, MINUTOS_ESTADO * 60) } });
}

interface PerfilGithub {
  id: number;
  login: string;
  name: string | null;
}

/** Cambia el código por un token y lee el perfil. null si GitHub no lo acepta o no responde. */
async function perfilDe(env: Env, codigo: string, appUrl: string): Promise<PerfilGithub | null> {
  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_OAUTH_ID, client_secret: env.GITHUB_OAUTH_SECRET, code: codigo, redirect_uri: retorno(appUrl) }),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    const { access_token: acceso } = (await r.json()) as { access_token?: unknown };
    if (!r.ok || typeof acceso !== 'string' || !acceso) return null;
    const u = await fetch('https://api.github.com/user', {
      headers: { authorization: `Bearer ${acceso}`, accept: 'application/vnd.github+json', 'user-agent': 'panel' },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!u.ok) return null;
    const p = (await u.json()) as Partial<PerfilGithub>;
    if (typeof p.id !== 'number' || !Number.isInteger(p.id) || typeof p.login !== 'string') return null;
    return { id: p.id, login: p.login, name: typeof p.name === 'string' ? p.name : null };
  } catch (e) {
    console.error('[github] no respondió', e);
    return null;
  }
}

export async function volverDeGithub(req: Request, env: Env, db: Db, appUrl: string): Promise<Response> {
  const rechazar = async () => {
    await registrarAcceso(db, req, env.SAL_IP, 'sesion.fallida', null, 'github');
    return fallo();
  };
  if (!githubConfigurado(env)) return fallo();

  // El state de la URL tiene que ser el de la cookie de este navegador: sin eso, otra persona
  // podría hacerle terminar a alguien un inicio de sesión que no empezó.
  const p = new URL(req.url).searchParams;
  const estado = p.get('state') ?? '';
  const codigo = p.get('code') ?? '';
  const guardado = leerCookie(req, COOKIE_ESTADO);
  if (!codigo || !estado || !guardado || estado !== guardado) return rechazar();

  const perfil = await perfilDe(env, codigo, appUrl);
  if (!perfil || !idsDev(env).includes(perfil.id)) return rechazar();

  const t = ahora();
  let [u] = await db.select().from(usuarios).where(eq(usuarios.githubId, perfil.id));
  if (!u) {
    // Primera vez: se crea con el correo sin respuesta de GitHub, que es único por cuenta y no
    // obliga a pedir el scope de correos.
    const email = `${perfil.id}+${perfil.login}@users.noreply.github.com`.toLowerCase();
    const nombre = (perfil.name?.trim() || perfil.login).slice(0, 120);
    await db
      .insert(usuarios)
      .values({ id: uuid(), email, nombre, rol: 'dev', activo: true, creado: t, githubId: perfil.id })
      .onConflictDoUpdate({ target: usuarios.email, set: { githubId: perfil.id, rol: 'dev' } });
    [u] = await db.select().from(usuarios).where(eq(usuarios.githubId, perfil.id));
  }
  if (!u || !u.activo) return rechazar();
  return abrirSesion(req, env, db, u, t, [cookieEstado('', 0)]);
}
