// Copia una sola vez las imágenes (MEDIOS) y los archivos de entregables (ARCHIVOS) de R2 al store
// privado de Vercel Blob, con las rutas que usa src/plataforma/blob-r2.ts (medios/<clave> y
// archivos/<clave>). Las claves salen de la base de Turso ya copiada.
// Uso (con wrangler autenticado en Cloudflare y el token del store de Blob):
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... BLOB_READ_WRITE_TOKEN=... node scripts/blob-copiar-r2.mjs
import { createClient } from '@libsql/client';
import { head, put } from '@vercel/blob';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!process.env.TURSO_DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Faltan TURSO_DATABASE_URL o BLOB_READ_WRITE_TOKEN');
  process.exit(1);
}
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const grupos = [
  { prefijo: 'medios', bucket: 'antidoto-medios', sql: 'select clave_r2 clave, mime from medios' },
  { prefijo: 'archivos', bucket: 'antidoto-archivos', sql: 'select clave_r2 clave, mime from entregable_archivos' },
];
const tmp = mkdtempSync(join(tmpdir(), 'antidoto-r2-'));
let copiados = 0;
let saltados = 0;
for (const g of grupos) {
  for (const { clave, mime } of (await db.execute(g.sql)).rows) {
    const ruta = `${g.prefijo}/${clave}`;
    // Se puede correr de nuevo: lo que ya está en Blob no se vuelve a subir.
    if (await head(ruta).then(() => true, () => false)) {
      saltados++;
      continue;
    }
    const archivo = join(tmp, 'objeto');
    execFileSync('npx', ['wrangler', 'r2', 'object', 'get', `${g.bucket}/${clave}`, '--remote', `--file=${archivo}`], { stdio: 'inherit' });
    await put(ruta, readFileSync(archivo), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: String(mime) });
    rmSync(archivo);
    copiados++;
    console.log(`Copiado ${ruta}`);
  }
}
console.log(`${copiados} copiados, ${saltados} ya estaban.`);
db.close();
