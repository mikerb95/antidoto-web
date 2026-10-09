// Build de la API para Vercel con la Build Output API (v3): una sola función Node con todo el
// código empaquetado por esbuild, los archivos del panel (dist-admin/) a su lado, las rutas y los
// crons. Vercel publica .vercel/output tal cual. Lo corre `npm run vercel-build` (vercel.json),
// después de construir el panel y el conocimiento del asesor.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const salida = `${raiz}.vercel/output`;
const funcion = `${salida}/functions/index.func`;

// Migraciones de la base (Turso) solo en el despliegue de producción: las vistas previas no tocan
// la base de producción.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.TURSO_DATABASE_URL) throw new Error('Falta TURSO_DATABASE_URL en producción');
  execFileSync('node', [`${raiz}scripts/turso-migrar.mjs`], { stdio: 'inherit' });
}

rmSync(salida, { recursive: true, force: true });
mkdirSync(funcion, { recursive: true });
mkdirSync(`${salida}/static`, { recursive: true });

await build({
  entryPoints: [`${raiz}src/plataforma/entrada-node.ts`],
  outfile: `${funcion}/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: 'linked',
  // Algunas dependencias son CommonJS y usan require: en un módulo ES hay que dárselo.
  banner: { js: "import { createRequire as __crearRequire } from 'node:module'; const require = __crearRequire(import.meta.url);" },
  logLevel: 'warning',
});

cpSync(`${raiz}dist-admin`, `${funcion}/dist-admin`, { recursive: true });

writeFileSync(
  `${funcion}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, supportsResponseStreaming: true, maxDuration: 60 }, null, 2),
);
writeFileSync(`${funcion}/package.json`, JSON.stringify({ type: 'module' }));

// La API no tiene páginas propias para buscadores.
writeFileSync(`${salida}/static/robots.txt`, 'User-agent: *\nDisallow: /\n');

writeFileSync(
  `${salida}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        // Todo lo demás va a la función, con la ruta original en __ruta (src/plataforma/entrada-node.ts).
        { src: '^/(.*)$', dest: '/index?__ruta=$1' },
      ],
      // Los mismos crons de wrangler.toml. Cada 5 minutos exige el plan Pro de Vercel.
      crons: [
        { path: '/cron/cinco', schedule: '*/5 * * * *' },
        { path: '/cron/hora', schedule: '0 * * * *' },
      ],
    },
    null,
    2,
  ),
);

console.log('API lista para Vercel en .vercel/output');
