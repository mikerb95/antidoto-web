// La API en Vercel (Node, Fluid Compute): arma el mismo Env que tendría el Worker de Cloudflare con
// los adaptadores de esta carpeta y llama a manejar() de src/index.ts. Así el código de la API es
// uno solo para las dos plataformas. La función que la expone es api/index.ts (vercel.json).
import { join } from 'node:path';
// Cliente web (HTTP): sin binarios nativos; basta para Turso (libsql:// o https://).
import { createClient } from '@libsql/client/web';
import { waitUntil } from '@vercel/functions';
import { cronCinco, cronHora, manejar } from '../index';
import type { Env } from '../env';
import { json } from '../util';
import { assetsDesdeDisco } from './assets-fs';
import { r2DesdeBlob } from './blob-r2';
import { subidaBlob } from './subida-blob';
import { d1DesdeLibsql } from './libsql-d1';

/** Los [vars] de wrangler.toml. Las variables de entorno de Vercel con el mismo nombre ganan. */
export const VARS = {
  ENTORNO: 'produccion',
  ORIGENES: 'https://antidotocolombia.com,https://antidoto-web.vercel.app,https://antidoto-web.pages.dev',
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
] as const;

let env: Env | null = null;

/** El Env se arma una vez por instancia: Fluid Compute reutiliza la instancia entre peticiones. */
export function entornoVercel(p: NodeJS.ProcessEnv = process.env): Env {
  if (env && p === process.env) return env;
  const url = p.TURSO_DATABASE_URL;
  if (!url) throw new Error('Falta TURSO_DATABASE_URL');
  const conBlob = !!(p.BLOB_STORE_ID || p.BLOB_READ_WRITE_TOKEN);
  const e: Env = {
    ...VARS,
    DB: d1DesdeLibsql(createClient({ url, authToken: p.TURSO_AUTH_TOKEN })),
    ASSETS: assetsDesdeDisco(join(process.cwd(), 'dist-admin')),
    MEDIOS: conBlob ? r2DesdeBlob('medios') : undefined,
    ARCHIVOS: conBlob ? r2DesdeBlob('archivos') : undefined,
    SUBIDA: conBlob ? subidaBlob : undefined,
  };
  for (const k of Object.keys(VARS) as (keyof typeof VARS)[]) if (p[k]) (e as unknown as Record<string, string>)[k] = p[k]!;
  for (const k of OPCIONALES) if (p[k]) e[k] = p[k];
  if (p === process.env) env = e;
  return e;
}

/**
 * Los handlers de la API leen la IP de cf-connecting-ip (la pone Cloudflare). En Vercel la IP real
 * viene en x-real-ip, que pone la plataforma; se copia encima de lo que haya mandado el cliente.
 */
export function conIpDeVercel(req: Request): Request {
  const h = new Headers(req.headers);
  h.delete('cf-connecting-ip');
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip) h.set('cf-connecting-ip', ip);
  // duplex: Node lo pide para reenviar un cuerpo en stream.
  return new Request(req, { headers: h, duplex: 'half' } as RequestInit);
}

const CRONS: Record<string, (env: Env) => Promise<void>> = { '/cron/cinco': cronCinco, '/cron/hora': cronHora };

export async function manejarVercel(req: Request): Promise<Response> {
  try {
    const cron = CRONS[new URL(req.url).pathname];
    if (cron) {
      // Vercel Cron manda Authorization: Bearer <CRON_SECRET>. Sin el secreto, nadie corre los crons.
      const secreto = process.env.CRON_SECRET;
      if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) return json({ error: 'no autorizado' }, 401);
      await cron(entornoVercel());
      return json({ ok: true });
    }
    return await manejar(conIpDeVercel(req), entornoVercel(), (p) => waitUntil(p));
  } catch (e) {
    console.error('[api] error sin manejar', e);
    return json({ ok: false, error: 'interno' }, 500);
  }
}
