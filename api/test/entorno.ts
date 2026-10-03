// D1 local de verdad (miniflare, vía getPlatformProxy) con las migraciones aplicadas, para
// probar la API de punta a punta sin Cloudflare.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import type { Env } from '../src/env';

export async function crearEntorno() {
  const proxy = await getPlatformProxy<Env>({ configPath: 'wrangler.toml', persist: false });
  // getPlatformProxy lee el .dev.vars de quien corre las pruebas (orígenes localhost, APP_URL,
  // claves): las pruebas fijan sus propias variables para dar lo mismo en cualquier PC y en CI.
  const env: Env = {
    DB: proxy.env.DB,
    ENTORNO: 'produccion',
    ORIGENES: 'https://antidotocolombia.com,https://antidoto-web.pages.dev',
    MAIL_FROM: 'Antídoto <hola@antidotocolombia.com>',
    MAIL_FROM_NOVEDADES: 'Antídoto <novedades@antidotocolombia.com>',
    MAIL_EQUIPO: 'equipo@antidoto.test',
    HORAS_SEGUIMIENTO: '24',
    SITIO_URL: 'https://antidotocolombia.com',
  };
  const dir = fileURLToPath(import.meta.resolve('../migraciones/'));
  for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sentencias = readFileSync(`${dir}${archivo}`, 'utf8').split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    await env.DB.batch(sentencias.map((s) => env.DB.prepare(s)));
  }
  return { env, cerrar: () => proxy.dispose() };
}
