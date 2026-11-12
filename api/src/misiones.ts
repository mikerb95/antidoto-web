// Puente con la plataforma de misiones (proyecto aparte, Next.js con su propia base): el panel
// firma pases con un secreto compartido. Un pase de entrada abre allá la sesión de quien lo pide,
// sin otra contraseña; uno de API autoriza las lecturas de servidor a servidor. El formato lo
// verifica src/lib/panel-pass.ts en ese proyecto: si cambia aquí, cambia allá.
import type { Env } from './env';
import { ahora, token } from './util';

export const SEGUNDOS_PASE = 60;
const SECRETO_MINIMO = 32;
const ESPERA_MS = 8000;

export type UsoPase = 'entrar' | 'api';

export interface ResumenMisiones {
  empresas: number;
  actividades: { activas: number; pausadas: number; vencidas: number };
  participantes: number;
  completaron: number;
  /** Participantes nuevos por semana, de la más vieja a la actual. */
  semanas: number[];
  enMarcha: { id: number; codigo: string; actividad: string; empresaId: number; empresa: string; expira: string | null; participantes: number; completaron: number; avance: number }[];
}

export interface EmpresaMisiones {
  id: number;
  nombre: string;
  archivada: boolean;
  actividades: number;
  participantes: number;
}

export interface ActividadMisiones {
  id: number;
  codigo: string;
  actividad: string;
  estado: 'activo' | 'pausado' | 'vencido';
  expira: string | null;
  participantes: number;
  completaron: number;
  avance: number;
}

export const urlMisiones = (env: Env): string => (env.MISIONES_URL ?? '').replace(/\/+$/, '');

export const misionesConfiguradas = (env: Env): boolean => /^https?:\/\//.test(urlMisiones(env)) && (env.MISIONES_SECRETO?.length ?? 0) >= SECRETO_MINIMO;

const base64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** "v1.<datos>.<HMAC-SHA256 de 'v1.<datos>'>", todo en base64url. */
export async function firmarPase(secreto: string, uso: UsoPase, datos: Record<string, unknown> = {}, t = ahora()): Promise<string> {
  const cuerpo = base64url(new TextEncoder().encode(JSON.stringify({ ...datos, uso, exp: t + SEGUNDOS_PASE * 1000, jti: token() })));
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`v1.${cuerpo}`));
  return `v1.${cuerpo}.${base64url(new Uint8Array(firma))}`;
}

/** Solo rutas del portal de misiones; cualquier otra cosa lleva a su portada. */
export function destinoSeguro(v: unknown): string {
  return typeof v === 'string' && v.length <= 200 && /^\/admin(\/[A-Za-z0-9/_-]*)?$/.test(v) && !v.includes('//') ? v : '/admin';
}

/** Enlace de un solo uso que abre la plataforma de misiones con la sesión de esta persona. */
export async function enlaceEntrada(env: Env, persona: { email: string; nombre: string }, destino: unknown): Promise<string> {
  const pase = await firmarPase(env.MISIONES_SECRETO!, 'entrar', { email: persona.email, nombre: persona.nombre, destino: destinoSeguro(destino) });
  return `${urlMisiones(env)}/admin/entrar?pase=${encodeURIComponent(pase)}`;
}

export class ErrorMisiones extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
  ) {
    super(mensaje);
  }
}

/** Llama a la API de la plataforma de misiones. Lanza ErrorMisiones si no responde bien o tarda. */
export async function pedirMisiones<T>(env: Env, ruta: string, cuerpo?: unknown): Promise<T> {
  if (!misionesConfiguradas(env)) throw new ErrorMisiones('sin_configurar', 503);
  const pase = await firmarPase(env.MISIONES_SECRETO!, 'api');
  let res: Response;
  try {
    res = await fetch(`${urlMisiones(env)}${ruta}`, {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${pase}`, ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch {
    throw new ErrorMisiones('sin_respuesta', 0);
  }
  if (!res.ok) throw new ErrorMisiones('respuesta', res.status);
  return (await res.json()) as T;
}
