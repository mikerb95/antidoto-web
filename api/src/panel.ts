// Archivos del panel (Preact, construido por Vite en dist-admin/admin/) servidos con el binding
// ASSETS. El Worker corre primero en todas las rutas (run_worker_first) para poner la CSP y
// decidir qué es archivo y qué es API.
import type { Env } from './env';

// El panel no se incrusta en otros sitios ni carga nada de fuera. Sin scripts ni estilos en línea:
// Vite emite todo como archivos con hash. frame-src 'self' es para la vista previa de los correos.
// connect-src suma Vercel Blob: en Vercel los archivos de entregables suben directo del navegador.
export const CSP_PANEL =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com; frame-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

export const SEGURIDAD = {
  'content-security-policy': CSP_PANEL,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

/** ¿Es una ruta de la interfaz del panel (no de su API ni del CSV)? */
export const esRutaPanel = (ruta: string) => ruta.startsWith('/admin/') && !ruta.startsWith('/admin/api/') && ruta !== '/admin/leads.csv';
/** ¿Es una ruta de la interfaz del portal de clientes? Comparte los archivos del panel. */
export const esRutaPortal = (ruta: string) => ruta.startsWith('/portal/') && !ruta.startsWith('/portal/api/') && !ruta.startsWith('/portal/auth/');

export async function servirPanel(req: Request, env: Env, ruta: string, pagina: 'index.html' | 'portal.html' = 'index.html'): Promise<Response> {
  if (!env.ASSETS) return new Response('El panel no está construido (npm run admin:build).', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', ...SEGURIDAD } });
  const origen = new URL(req.url).origin;
  if (ruta.startsWith('/admin/assets/')) {
    const r = await env.ASSETS.fetch(new Request(`${origen}${ruta}`));
    if (!r.ok) return new Response('No existe', { status: 404, headers: SEGURIDAD });
    const h = new Headers(r.headers);
    for (const [k, v] of Object.entries(SEGURIDAD)) h.set(k, v);
    // Los nombres llevan hash: se pueden guardar para siempre.
    h.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(r.body, { status: 200, headers: h });
  }
  // Cualquier otra ruta del panel es la misma página: el ruteo lo hace el navegador.
  const r = await env.ASSETS.fetch(new Request(`${origen}/admin/${pagina}`));
  if (!r.ok) return new Response('El panel no está construido (npm run admin:build).', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', ...SEGURIDAD } });
  return new Response(r.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', ...SEGURIDAD } });
}
