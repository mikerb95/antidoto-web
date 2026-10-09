// Solo el sitio (y sus vistas previas de rama en Cloudflare Pages y en Vercel) puede enviar leads.
import type { Env } from './env';

const PREVIEW = /^https:\/\/[a-z0-9-]+\.antidoto-web\.pages\.dev$/;
// Vercel: antidoto-web-<hash>-<equipo>.vercel.app y antidoto-web-git-<rama>-<equipo>.vercel.app.
const PREVIEW_VERCEL = /^https:\/\/antidoto-web-[a-z0-9-]+\.vercel\.app$/;
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

export function origenPermitido(origen: string | null, env: Pick<Env, 'ORIGENES'>, local = false): boolean {
  if (!origen) return false;
  const lista = env.ORIGENES.split(',').map((o) => o.trim()).filter(Boolean);
  return lista.includes(origen) || PREVIEW.test(origen) || PREVIEW_VERCEL.test(origen) || (local && LOCAL.test(origen));
}

export function cabecerasCors(origen: string): Record<string, string> {
  return {
    'access-control-allow-origin': origen,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
