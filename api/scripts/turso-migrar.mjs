// Aplica en Turso las migraciones de migraciones/ que falten, como `wrangler d1 migrations apply`:
// la misma tabla d1_migrations, así una base copiada desde D1 (turso-copiar-d1.mjs) ya sabe cuáles
// tiene. Lo corre el workflow de despliegue de la API en Vercel.
// Uso: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run turso:migrar
import { createClient } from '@libsql/client';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('Falta TURSO_DATABASE_URL');
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
await db.execute(
  'create table if not exists d1_migrations (id integer primary key autoincrement, name text unique, applied_at timestamp default current_timestamp not null)',
);
const hechas = new Set((await db.execute('select name from d1_migrations')).rows.map((f) => String(f.name)));
const dir = fileURLToPath(new URL('../migraciones/', import.meta.url));
const pendientes = readdirSync(dir).filter((f) => f.endsWith('.sql') && !hechas.has(f)).sort();
for (const archivo of pendientes) {
  const sentencias = readFileSync(`${dir}${archivo}`, 'utf8').split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
  // Una migración entera o nada, como en D1.
  await db.batch([...sentencias, { sql: 'insert into d1_migrations (name) values (?)', args: [archivo] }], 'write');
  console.log(`Aplicada ${archivo}`);
}
console.log(pendientes.length ? `${pendientes.length} migraciones aplicadas.` : 'Sin migraciones pendientes.');
db.close();
