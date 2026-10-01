// D1 local de verdad (miniflare, vía getPlatformProxy) con las migraciones aplicadas, para
// probar la API de punta a punta sin Cloudflare.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import type { Env } from '../src/env';

export async function crearEntorno() {
  const proxy = await getPlatformProxy<Env>({ configPath: 'wrangler.toml', persist: false });
  const env = { ...proxy.env, ENTORNO: 'produccion' } as Env;
  const dir = fileURLToPath(import.meta.resolve('../migraciones/'));
  for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sentencias = readFileSync(`${dir}${archivo}`, 'utf8').split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    await env.DB.batch(sentencias.map((s) => env.DB.prepare(s)));
  }
  return { env, cerrar: () => proxy.dispose() };
}
