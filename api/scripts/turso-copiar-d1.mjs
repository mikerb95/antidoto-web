// Copia una sola vez la base D1 de producción a Turso, para pasar la API de Cloudflare a Vercel.
// La base de Turso debe estar VACÍA (sin migrar): el volcado trae las tablas, los datos y
// d1_migrations. Después, `npm run turso:migrar` no encuentra nada pendiente.
// Uso (con wrangler autenticado en la cuenta de Cloudflare):
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/turso-copiar-d1.mjs
import { createClient } from '@libsql/client';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('Falta TURSO_DATABASE_URL');
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const tablas = (await db.execute("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")).rows;
if (tablas.length) {
  console.error(`La base de Turso no está vacía (${tablas.map((t) => t.name).join(', ')}). Usa una base nueva.`);
  process.exit(1);
}
const archivo = join(mkdtempSync(join(tmpdir(), 'antidoto-d1-')), 'volcado.sql');
execFileSync('npx', ['wrangler', 'd1', 'export', 'antidoto', '--remote', `--output=${archivo}`], { stdio: 'inherit' });
await db.executeMultiple(readFileSync(archivo, 'utf8'));
for (const { name } of (await db.execute("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name")).rows) {
  const { rows } = await db.execute(`select count(*) n from "${name}"`);
  console.log(`${name}: ${rows[0].n}`);
}
db.close();
