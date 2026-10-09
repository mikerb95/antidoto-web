// Archivos del panel en Vercel: lee dist-admin/ del disco de la función (vercel.json lo incluye con
// includeFiles) detrás de la parte de Fetcher que usa src/panel.ts: fetch(Request) por ruta.
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

export function assetsDesdeDisco(raiz: string): Fetcher {
  const base = normalize(raiz) + sep;
  const fetcher = {
    async fetch(entrada: Request | string) {
      const ruta = decodeURIComponent(new URL(typeof entrada === 'string' ? entrada : entrada.url).pathname);
      const archivo = normalize(join(base, ruta));
      // Nada fuera de dist-admin/.
      if (!archivo.startsWith(base)) return new Response('No existe', { status: 404 });
      try {
        const datos = await readFile(archivo);
        return new Response(datos, { status: 200, headers: { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' } });
      } catch {
        return new Response('No existe', { status: 404 });
      }
    },
    connect() {
      throw new Error('connect no está disponible');
    },
  };
  return fetcher as unknown as Fetcher;
}
