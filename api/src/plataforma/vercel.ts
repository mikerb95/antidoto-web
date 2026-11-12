// La API en Vercel (Node, Fluid Compute): arma el Env con Turso, Blob y las variables del proyecto
// y llama a manejar() de src/index.ts. La función que la expone es entrada-node.ts.
import { join } from 'node:path';
// Cliente web (HTTP): sin binarios nativos; basta para Turso (libsql:// o https://).
import { createClient } from '@libsql/client/web';
import { waitUntil } from '@vercel/functions';
import { manejar } from '../index';
import type { Env } from '../env';
import { json } from '../util';
import { assetsDesdeDisco } from './assets-fs';
import { almacenBlob } from './blob';
import { subidaBlob } from './subida-blob';

/** Valores por defecto. Una variable de entorno con el mismo nombre los reemplaza. */
export const VARS = {
  ENTORNO: 'produccion',
  ORIGENES: 'https://antidotocolombia.com,https://antidoto-web.vercel.app',
  MAIL_FROM: 'Antídoto <hola@antidotocolombia.com>',
  MAIL_EQUIPO: 'antidoto.colombia@outlook.com',
  MAIL_FROM_NOVEDADES: 'Antídoto <novedades@antidotocolombia.com>',
  SITIO_URL: 'https://antidotocolombia.com',
  HORAS_SEGUIMIENTO: '24',
  ASESOR_TOPE_DIARIO_USD: '1',
  GITHUB_REPO: 'mikerb95/antidoto-web',
  GITHUB_REF: 'main',
} as const;

const OPCIONALES = [
  'APP_URL',
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'MAIL_DIRECCION',
  'SAL_IP',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_URL',
  'GITHUB_DISPATCH_TOKEN',
  'MISIONES_URL',
  'MISIONES_SECRETO',
] as const;

type Variables = Omit<Env, 'DB' | 'ASSETS' | 'MEDIOS' | 'ARCHIVOS' | 'SUBIDA'>;

/** Las variables de la API: los valores por defecto con lo que traiga el entorno encima. */
export function variables(p: NodeJS.ProcessEnv): Variables {
  const v: Variables = { ...VARS };
  for (const k of Object.keys(VARS) as (keyof typeof VARS)[]) if (p[k]) (v as unknown as Record<string, string>)[k] = p[k]!;
  for (const k of OPCIONALES) if (p[k]) v[k] = p[k];
  // El sitio y la API van en el mismo proyecto de Vercel: sin APP_URL ni SITIO_URL, los dos son el
  // dominio de producción del proyecto (el propio cuando se agregue, si no el *.vercel.app).
  const produccion = p.VERCEL_PROJECT_PRODUCTION_URL ? `https://${p.VERCEL_PROJECT_PRODUCTION_URL}` : '';
  if (produccion && !p.APP_URL) v.APP_URL = produccion;
  if (produccion && !p.SITIO_URL) v.SITIO_URL = produccion;
  return v;
}

let env: Env | null = null;

/** El Env se arma una vez por instancia: Fluid Compute reutiliza la instancia entre peticiones. */
export function entornoVercel(p: NodeJS.ProcessEnv = process.env): Env {
  if (env && p === process.env) return env;
  const url = p.TURSO_DATABASE_URL;
  if (!url) throw new Error('Falta TURSO_DATABASE_URL');
  const conBlob = !!(p.BLOB_STORE_ID || p.BLOB_READ_WRITE_TOKEN);
  const e: Env = {
    ...variables(p),
    DB: createClient({ url, authToken: p.TURSO_AUTH_TOKEN }),
    ASSETS: assetsDesdeDisco(join(process.cwd(), 'dist-admin')),
    MEDIOS: conBlob ? almacenBlob('medios') : undefined,
    ARCHIVOS: conBlob ? almacenBlob('archivos') : undefined,
    SUBIDA: conBlob ? subidaBlob : undefined,
  };
  if (p === process.env) env = e;
  return e;
}

export async function manejarVercel(req: Request): Promise<Response> {
  try {
    return await manejar(req, entornoVercel(), (p) => waitUntil(p));
  } catch (e) {
    console.error('[api] error sin manejar', e);
    return json({ ok: false, error: 'interno' }, 500);
  }
}
