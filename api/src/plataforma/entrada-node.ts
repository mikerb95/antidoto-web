// Función de Vercel (Build Output API, launcherType Nodejs): pasa la petición de Node a Request y
// la Response de vuelta. scripts/vercel-build.mjs la empaqueta en .vercel/output/functions/index.func.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { manejarVercel } from './vercel';

/**
 * Ruta original: config.json reescribe todo a /index?__ruta=<ruta>. Si la plataforma ya entrega la
 * ruta original, se usa esa.
 */
export function urlOriginal(host: string, url: string): URL {
  const u = new URL(url, `https://${host}`);
  const ruta = u.searchParams.get('__ruta');
  u.searchParams.delete('__ruta');
  if (ruta !== null && (u.pathname === '/index' || u.pathname === '/')) u.pathname = `/${ruta}`;
  return u;
}

export default async function manejador(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = urlOriginal(String(req.headers.host ?? 'localhost'), req.url ?? '/');
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) for (const x of v) headers.append(k, x);
    else if (v !== undefined) headers.set(k, v);
  }
  const metodo = req.method ?? 'GET';
  const cuerpo = metodo === 'GET' || metodo === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream);
  const r = await manejarVercel(new Request(url, { method: metodo, headers, body: cuerpo, duplex: 'half' } as RequestInit));

  res.statusCode = r.status;
  const cookies = r.headers.getSetCookie();
  r.headers.forEach((v, k) => {
    if (k !== 'set-cookie') res.setHeader(k, v);
  });
  if (cookies.length) res.setHeader('set-cookie', cookies);
  if (!r.body || metodo === 'HEAD') {
    res.end();
    return;
  }
  await new Promise<void>((listo, fallo) => {
    Readable.fromWeb(r.body as import('node:stream/web').ReadableStream).on('error', fallo).pipe(res).on('finish', listo).on('error', fallo);
  });
}
