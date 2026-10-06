// Contexto común de las rutas del panel. Cada módulo de src/rutas/ recibe el contexto y devuelve
// una respuesta, o null si la ruta no es suya; manejar() (src/index.ts) los recorre en orden.
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Env } from '../env';
import type { Sesion } from '../auth';
import { puede, type Permiso } from '../permisos';
import { registrar } from '../auditoria';
import { hashIp, json } from '../util';

export interface Ctx {
  req: Request;
  url: URL;
  ruta: string;
  metodo: string;
  env: Env;
  db: DrizzleD1Database;
  sesion: Sesion;
  appUrl: string;
  diferir: (p: Promise<unknown>) => void;
}

export type Modulo = (c: Ctx) => Promise<Response | null> | Response | null;

/** 403 si el rol de la sesión no tiene el permiso; null si puede seguir. */
export const sinPermiso = (c: Ctx, p: Permiso): Response | null => (puede(c.sesion.usuario.rol, p) ? null : json({ error: 'permiso', permiso: p }, 403));

/**
 * Anota en la auditoría un cambio que salió bien (2xx) y devuelve la misma respuesta. Se escribe
 * en diferido: si la bitácora falla, el cambio ya está hecho y no se deshace.
 */
export function auditar(c: Ctx, res: Response, accion: string, entidad: string | null = null, id: string | null = null, detalle: Record<string, unknown> | null = null): Response {
  if (res.ok) {
    c.diferir(
      hashIp(c.req.headers.get('cf-connecting-ip'), c.env.SAL_IP)
        .then((ip) => registrar(c.db, c.sesion, accion, entidad, id, detalle, ip))
        .catch((e) => console.error('[auditoria] no se pudo registrar', accion, e)),
    );
  }
  return res;
}

/** Lee un cuerpo JSON sin consumir la petición original (las funciones de dominio lo leen después). */
export async function cuerpoJson(req: Request): Promise<Record<string, unknown>> {
  const d = await req.clone().json().catch(() => null);
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
}
