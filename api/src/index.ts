// Worker de la API de Antídoto. Rutas:
//   POST /v1/leads                  público (solo orígenes del sitio): guarda un lead
//   POST /v1/suscripciones          público (solo orígenes del sitio): suscripción a novedades
//   GET|POST /v1/asesor             público (solo orígenes del sitio): chat con IA (src/asesor/)
//   GET|POST /v1/suscripcion/confirmar|baja?t=   doble confirmación y baja (por token)
//   POST /v1/resend/webhook         eventos de Resend, firmados con Svix
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
import { crearSuscripcion, confirmar, baja } from './marketing/suscripciones';
import { webhookResend } from './marketing/webhook';
import { procesarEnvios } from './marketing/envios';
import * as mk from './marketing/admin';
import { rutaAsesor } from './asesor/ruta';
import { ADMIN_HTML, ADMIN_JS, ADMIN_CSS } from './admin-ui';
import { json } from './util';

// El admin no se incrusta en otros sitios ni carga nada de fuera.
const SEGURIDAD = {
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
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

  if (ruta === '/v1/leads' || ruta === '/v1/suscripciones') {
    const origen = req.headers.get('origin');
    if (!origenPermitido(origen, env, env.ENTORNO === 'local')) return json({ ok: false, error: 'origen' }, 403);
    const cors = cabecerasCors(origen!);
    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (metodo !== 'POST') return json({ ok: false }, 405, cors);
    return ruta === '/v1/leads' ? crearLead(req, env, db, appUrl, diferir, cors) : crearSuscripcion(req, env, db, appUrl, cors, diferir);
  }

  if (ruta === '/v1/asesor') {
    const origen = req.headers.get('origin');
    if (!origenPermitido(origen, env, env.ENTORNO === 'local')) return json({ ok: false, error: 'origen' }, 403);
    const cors = cabecerasCors(origen!);
    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
    return rutaAsesor(req, env, db, diferir, cors);
  }

  // Autorizadas por token o por firma, no por sesión: los proveedores de correo hacen el POST de
  // baja de un clic sin Origin, y Resend llama al webhook desde sus servidores.
  if (ruta === '/v1/suscripcion/confirmar' && (metodo === 'GET' || metodo === 'POST')) return confirmar(req, db, env);
  if (ruta === '/v1/suscripcion/baja' && (metodo === 'GET' || metodo === 'POST')) return baja(req, db);
  if (ruta === '/v1/resend/webhook' && metodo === 'POST') return webhookResend(req, env, db);

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

    // Email marketing
    if (ruta === '/admin/api/contactos' && metodo === 'GET') return mk.listarContactos(url, db);
    if (ruta === '/admin/api/contactos' && metodo === 'POST') return mk.invitarContacto(req, env, db, appUrl);
    const contacto = ruta.match(/^\/admin\/api\/contactos\/([0-9a-f-]{36})(\/baja|\/suprimir)?$/);
    if (contacto) {
      const [, id, accion] = contacto as unknown as [string, string, string | undefined];
      if (!accion && metodo === 'GET') return mk.verContacto(id, db);
      if (accion === '/baja' && metodo === 'POST') return mk.bajaContacto(id, db);
      if (accion === '/suprimir' && metodo === 'POST') return mk.suprimirContacto(id, db, sesion);
    }
    if (ruta === '/admin/api/campanas' && metodo === 'GET') return mk.listarCampanas(db);
    if (ruta === '/admin/api/campanas' && metodo === 'POST') return mk.crearCampana(req, db, sesion);
    const campana = ruta.match(/^\/admin\/api\/campanas\/([0-9a-f-]{36})(\/vista|\/prueba|\/enviar|\/cancelar)?$/);
    if (campana) {
      const [, id, accion] = campana as unknown as [string, string, string | undefined];
      if (!accion && metodo === 'GET') return mk.verCampana(id, db);
      if (!accion && metodo === 'PATCH') return mk.editarCampana(id, req, db);
      if (!accion && metodo === 'DELETE') return mk.borrarCampana(id, db);
      if (accion === '/vista' && metodo === 'GET') return mk.vistaCampana(id, db, appUrl);
      if (accion === '/prueba' && metodo === 'POST') return mk.probarCampana(id, env, db, sesion, appUrl);
      if (accion === '/enviar' && metodo === 'POST') return mk.enviarCampana(id, req, env, db, appUrl, diferir);
      if (accion === '/cancelar' && metodo === 'POST') return mk.cancelarCampana(id, db);
    }
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
  async scheduled(evento, env, ctx) {
    const db = drizzle(env.DB);
    // A la hora en punto se disparan los dos crons. Los lotes salen solo con el de cada 5 minutos:
    // dos corridas a la vez se pisan con el límite de Resend (2 por segundo) y gastan intentos.
    if (evento.cron === '*/5 * * * *') {
      ctx.waitUntil(procesarEnvios(env, db).then((r) => r.enviados + r.fallidos && console.log(`[envios] ${r.enviados} enviados, ${r.fallidos} fallidos`)));
    }
    if (evento.cron === '0 * * * *') {
      ctx.waitUntil(seguimiento(env, db).then((r) => console.log(`[seguimiento] ${r.avisados} leads avisados`)));
    }
  },
} satisfies ExportedHandler<Env>;
