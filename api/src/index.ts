// Worker de la API de Antídoto. Rutas:
//   POST /v1/leads                  público (solo orígenes del sitio): guarda un lead
//   POST /auth/enlace               pide el enlace de acceso por correo
//   GET|POST /auth/entrar           abre la sesión con el enlace
//   POST /auth/salir[?todas=1]      cierra la sesión (o todas las del usuario)
//   GET  /admin/                    bandeja (HTML + /admin/app.js + /admin/app.css)
//   /admin/api/*                    API de la bandeja, con sesión
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from './env';
import { crearLead } from './leads';
import { origenPermitido, cabecerasCors } from './cors';
import { pedirEnlace, paginaEntrar, entrar, sesionActual, salir, mismoOrigen } from './auth';
import { listarLeads, verLead, editarLead, anonimizarLead, metricas, exportarCsv, listarUsuarios, crearUsuario, editarUsuario } from './admin';
import { seguimiento } from './seguimiento';
import { ADMIN_HTML, ADMIN_JS, ADMIN_CSS } from './admin-ui';
import { json } from './util';

// El admin no se incrusta en otros sitios ni carga nada de fuera.
const SEGURIDAD = {
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

const estatico = (cuerpo: string, tipo: string) =>
  new Response(cuerpo, { headers: { 'content-type': `${tipo}; charset=utf-8`, 'cache-control': 'no-cache', ...SEGURIDAD } });

export async function manejar(req: Request, env: Env, diferir: (p: Promise<unknown>) => void): Promise<Response> {
  const url = new URL(req.url);
  const { pathname: ruta } = url;
  const metodo = req.method;
  const db = drizzle(env.DB);
  const appUrl = (env.APP_URL || url.origin).replace(/\/$/, '');

  if (ruta === '/v1/leads') {
    const origen = req.headers.get('origin');
    if (!origenPermitido(origen, env, env.ENTORNO === 'local')) return json({ ok: false, error: 'origen' }, 403);
    const cors = cabecerasCors(origen!);
    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (metodo !== 'POST') return json({ ok: false }, 405, cors);
    return crearLead(req, env, db, appUrl, diferir, cors);
  }

  if (ruta === '/salud') return json({ ok: true });

  if (ruta === '/admin') return Response.redirect(`${url.origin}/admin/`, 301);
  if (ruta === '/admin/' && metodo === 'GET') return estatico(ADMIN_HTML, 'text/html');
  if (ruta === '/admin/app.js') return estatico(ADMIN_JS, 'text/javascript');
  if (ruta === '/admin/app.css') return estatico(ADMIN_CSS, 'text/css');

  if (ruta === '/auth/entrar' && metodo === 'GET') return paginaEntrar(req);

  // De aquí en adelante, todo lo que cambia algo tiene que venir de la propia app.
  const cambia = metodo !== 'GET' && metodo !== 'HEAD';
  if (cambia && !mismoOrigen(req)) return json({ error: 'origen' }, 403);

  if (ruta === '/auth/enlace' && metodo === 'POST') return pedirEnlace(req, env, db, appUrl);
  if (ruta === '/auth/entrar' && metodo === 'POST') return entrar(req, db);

  if (ruta === '/auth/salir' || ruta.startsWith('/admin/api/') || ruta === '/admin/leads.csv') {
    const sesion = await sesionActual(req, db);
    if (!sesion) return json({ error: 'sesion' }, 401);

    if (ruta === '/auth/salir' && metodo === 'POST') return salir(db, sesion, url.searchParams.has('todas'));
    if (ruta === '/admin/leads.csv' && metodo === 'GET') return exportarCsv(db);
    if (ruta === '/admin/api/yo') {
      const { id, email, nombre, rol } = sesion.usuario;
      return json({ id, email, nombre, rol });
    }
    if (ruta === '/admin/api/leads' && metodo === 'GET') return listarLeads(url, db);
    if (ruta === '/admin/api/metricas' && metodo === 'GET') return metricas(url, db);
    if (ruta === '/admin/api/usuarios' && metodo === 'GET') return listarUsuarios(db);
    if (ruta === '/admin/api/usuarios' && metodo === 'POST') return crearUsuario(req, db, sesion);

    const lead = ruta.match(/^\/admin\/api\/leads\/([0-9a-f-]{36})(\/anonimizar)?$/);
    if (lead) {
      const id = lead[1]!;
      if (lead[2] && metodo === 'POST') return anonimizarLead(id, db, sesion);
      if (!lead[2] && metodo === 'GET') return verLead(id, db);
      if (!lead[2] && metodo === 'PATCH') return editarLead(id, req, db, sesion);
    }
    const usuario = ruta.match(/^\/admin\/api\/usuarios\/([0-9a-f-]{36})$/);
    if (usuario && metodo === 'PATCH') return editarUsuario(usuario[1]!, req, db, sesion);
  }

  return json({ error: 'no existe' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    try {
      return await manejar(req, env, (p) => ctx.waitUntil(p));
    } catch (e) {
      console.error('[api] error sin manejar', e);
      return json({ ok: false, error: 'interno' }, 500);
    }
  },
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(seguimiento(env, drizzle(env.DB)).then((r) => console.log(`[seguimiento] ${r.avisados} leads avisados`)));
  },
} satisfies ExportedHandler<Env>;
