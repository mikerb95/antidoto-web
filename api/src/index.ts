// Worker de la API de Antídoto. Rutas:
//   POST /v1/leads                  público (solo orígenes del sitio): guarda un lead
//   POST /v1/suscripciones          público (solo orígenes del sitio): suscripción a novedades
//   GET|POST /v1/asesor             público (solo orígenes del sitio): chat con IA (src/asesor/)
//   POST /v1/asesor/borrar          público (solo orígenes del sitio): el visitante borra su conversación
//   GET|POST /v1/suscripcion/confirmar|baja|preferencias?t=   por token: el GET lleva a la página
//                                   del sitio y el POST hace la acción (la baja de un clic, también)
//   GET  /v1/suscripcion/datos?t=   público (solo orígenes del sitio): datos para la página de preferencias
//   GET  /v1/novedades[?locale=]    archivo público de campañas (JSON)
//   GET  /v1/novedades/<id>         versión web de una campaña enviada
//   POST /v1/resend/webhook         eventos de Resend, firmados con Svix
//   GET  /v1/contenido?tipo=        contenido publicado desde el panel, para el build del sitio
//   GET  /v1/medios/<id>            imágenes de ese contenido (R2)
//   GET  /v1/ajustes                ajustes del sitio (regalo de bienvenida, video del hero)
//   POST /auth/enlace               pide el enlace de acceso por correo
//   GET|POST /auth/entrar           abre la sesión con el enlace
//   POST /auth/salir[?todas=1]      cierra la sesión (o todas las del usuario)
//   GET  /admin/*                   panel en Preact (dist-admin/, binding ASSETS; ver src/panel.ts)
//   /admin/api/*                    API del panel, con sesión y permisos por rol (src/rutas/)
//   GET  /portal/*                  portal de proyectos para clientes (misma app de Vite, portal.html)
//   /portal/auth/*, /portal/api/*   acceso y API del portal, con su propia sesión (src/portal/)
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from './env';
import { crearLead } from './leads';
import { origenPermitido, cabecerasCors } from './cors';
import { pedirEnlace, paginaEntrar, entrar, sesionActual, mismoOrigen } from './auth';
import { seguimiento } from './seguimiento';
import { crearSuscripcion, confirmar, baja, preferencias, datosPreferencias } from './marketing/suscripciones';
import { listarPublicas, verPublica } from './marketing/publico';
import { recordatorios, invitaciones } from './marketing/automaticos';
import { webhookResend } from './marketing/webhook';
import { procesarEnvios, arrancarProgramadas, decidirPruebas } from './marketing/envios';
import type { Ctx, Modulo } from './rutas/contexto';
import { rutasLeads } from './rutas/leads';
import { rutasMarketing } from './rutas/marketing';
import { rutasEquipo } from './rutas/equipo';
import { rutasInicio } from './rutas/inicio';
import { rutasConversaciones } from './rutas/conversaciones';
import { rutasContenido } from './rutas/contenido';
import { rutasProyectos } from './rutas/proyectos';
import { contenidoPublicado, servirMedio, ajustesSitio } from './contenido/publico';
import { reintentarPublicaciones } from './publicacion';
import { rutaAsesor, rutaBorrar } from './asesor/ruta';
import { limpiarConversaciones } from './asesor/guardado';
import { esRutaPanel, esRutaPortal, servirPanel } from './panel';
import { pedirEnlaceCliente, paginaEntrarCliente, entrarCliente, sesionCliente } from './portal/auth';
import { rutasPortal } from './portal/rutas';
import { rutasAccesos } from './rutas/accesos';
import { rutasSistema, anotarCron } from './rutas/sistema';
import { rutasExportar } from './rutas/exportar';
import { json } from './util';

// Rutas del panel por módulo (src/rutas/), todas con sesión. Cada una exige su permiso.
const MODULOS: Modulo[] = [rutasEquipo, rutasInicio, rutasLeads, rutasMarketing, rutasConversaciones, rutasContenido, rutasProyectos, rutasAccesos, rutasSistema, rutasExportar];

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

  if (ruta === '/v1/asesor' || ruta === '/v1/asesor/borrar') {
    const origen = req.headers.get('origin');
    if (!origenPermitido(origen, env, env.ENTORNO === 'local')) return json({ ok: false, error: 'origen' }, 403);
    const cors = cabecerasCors(origen!);
    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
    return ruta === '/v1/asesor' ? rutaAsesor(req, env, db, diferir, cors) : rutaBorrar(req, db, cors);
  }

  // Lecturas públicas para el sitio: CORS solo para sus orígenes.
  if (ruta === '/v1/suscripcion/datos' || ruta === '/v1/novedades') {
    const origen = req.headers.get('origin');
    const cors = origenPermitido(origen, env, env.ENTORNO === 'local') ? { ...cabecerasCors(origen!), 'access-control-allow-methods': 'GET, OPTIONS' } : {};
    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (metodo !== 'GET') return json({ ok: false }, 405, cors);
    if (ruta === '/v1/novedades') return listarPublicas(url, db, cors);
    if (!origen || !Object.keys(cors).length) return json({ ok: false, error: 'origen' }, 403);
    return datosPreferencias(req, db, cors);
  }
  // Contenido publicado para el build del sitio (sin CORS restringido: es público).
  if (metodo === 'GET' && ruta === '/v1/contenido') return contenidoPublicado(url, db, appUrl);
  if (metodo === 'GET' && ruta === '/v1/ajustes') return ajustesSitio(db);
  const medio = ruta.match(/^\/v1\/medios\/([0-9a-f-]{36})$/);
  if (medio && metodo === 'GET') return servirMedio(medio[1]!, env, db);

  const publica = ruta.match(/^\/v1\/novedades\/([0-9a-f-]{36})$/);
  if (publica && metodo === 'GET') return verPublica(publica[1]!, env, db);

  // Autorizadas por token o por firma, no por sesión: los proveedores de correo hacen el POST de
  // baja de un clic sin Origin, el sitio envía formularios normales (sin fetch) y Resend llama al
  // webhook desde sus servidores.
  if (ruta === '/v1/suscripcion/confirmar' && (metodo === 'GET' || metodo === 'POST')) return confirmar(req, db, env, appUrl, diferir);
  if (ruta === '/v1/suscripcion/baja' && (metodo === 'GET' || metodo === 'POST')) return baja(req, db, env);
  if (ruta === '/v1/suscripcion/preferencias' && (metodo === 'GET' || metodo === 'POST')) return preferencias(req, db, env);
  if (ruta === '/v1/resend/webhook' && metodo === 'POST') return webhookResend(req, env, db);

  if (ruta === '/salud') return json({ ok: true });

  if (ruta === '/admin') return Response.redirect(`${url.origin}/admin/`, 301);
  if (esRutaPanel(ruta) && (metodo === 'GET' || metodo === 'HEAD')) return servirPanel(req, env, ruta);
  if (ruta === '/portal') return Response.redirect(`${url.origin}/portal/`, 301);
  // El portal usa los archivos del panel (/admin/assets/) con su propia página de entrada.
  if (esRutaPortal(ruta) && (metodo === 'GET' || metodo === 'HEAD')) return servirPanel(req, env, ruta, 'portal.html');
  if (ruta === '/portal/auth/entrar' && metodo === 'GET') return paginaEntrarCliente(req);

  if (ruta === '/auth/entrar' && metodo === 'GET') return paginaEntrar(req);

  // De aquí en adelante, todo lo que cambia algo tiene que venir de la propia app.
  const cambia = metodo !== 'GET' && metodo !== 'HEAD';
  if (cambia && !mismoOrigen(req)) return json({ error: 'origen' }, 403);

  if (ruta === '/auth/enlace' && metodo === 'POST') return pedirEnlace(req, env, db, appUrl);
  if (ruta === '/portal/auth/enlace' && metodo === 'POST') return pedirEnlaceCliente(req, env, db, appUrl);
  if (ruta === '/portal/auth/entrar' && metodo === 'POST') return entrarCliente(req, db);
  if (ruta === '/portal/auth/salir' || ruta.startsWith('/portal/api/')) {
    const sesion = await sesionCliente(req, db);
    if (!sesion) return json({ error: 'sesion' }, 401);
    return rutasPortal({ req, ruta, metodo, env, db, sesion, appUrl, diferir });
  }
  if (ruta === '/auth/entrar' && metodo === 'POST') return entrar(req, db);

  if (ruta === '/auth/salir' || ruta.startsWith('/admin/api/') || ruta === '/admin/leads.csv') {
    const sesion = await sesionActual(req, db);
    if (!sesion) return json({ error: 'sesion' }, 401);
    const ctx: Ctx = { req, url, ruta, metodo, env, db, sesion, appUrl, diferir };
    for (const modulo of MODULOS) {
      const res = await modulo(ctx);
      if (res) return res;
    }
  }

  return json({ error: 'no existe' }, 404);
}

// Crons: en Cloudflare los dispara `scheduled` (wrangler.toml); en Vercel, /cron/<nombre> (vercel.json).
// A la hora en punto se disparan los dos. Los lotes salen solo con el de cada 5 minutos:
// dos corridas a la vez se pisan con el límite de Resend (2 por segundo) y gastan intentos.
export async function cronCinco(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const appUrl = (env.APP_URL ?? '').replace(/\/$/, '');
  // Primero arrancan las programadas y se deciden las pruebas A/B: así sus envíos salen en esta misma corrida.
  const arrancadas = await arrancarProgramadas(env, db);
  const decididas = await decidirPruebas(env, db);
  const r = await procesarEnvios(env, db);
  const inv = await invitaciones(env, db, appUrl);
  const pub = await reintentarPublicaciones(db, env).catch((e) => (console.error('[publicacion] reintentos', e), 0));
  await anotarCron(db, 'cinco', { programadas: arrancadas, pruebasAb: decididas, enviados: r.enviados, fallidos: r.fallidos, invitaciones: inv, publicaciones: pub });
  if (arrancadas + decididas + r.enviados + r.fallidos + inv)
    console.log(`[envios] ${arrancadas} programadas arrancadas, ${decididas} pruebas A/B decididas, ${r.enviados} enviados, ${r.fallidos} fallidos, ${inv} invitaciones`);
}

export async function cronHora(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const appUrl = (env.APP_URL ?? '').replace(/\/$/, '');
  const [s, rec, borradas] = await Promise.all([
    seguimiento(env, db).catch((e) => (console.error('[seguimiento]', e), { avisados: -1 })),
    recordatorios(env, db, appUrl).catch((e) => (console.error('[recordatorios]', e), -1)),
    limpiarConversaciones(db, Date.now()).catch((e) => (console.error('[asesor] limpieza de conversaciones', e), -1)),
  ]);
  if (s.avisados || rec || borradas) console.log(`[hora] ${s.avisados} leads avisados, ${rec} recordatorios, ${borradas} conversaciones vencidas borradas`);
  await anotarCron(db, 'hora', { leadsAvisados: s.avisados, recordatorios: rec, conversacionesBorradas: borradas });
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
    if (evento.cron === '*/5 * * * *') ctx.waitUntil(cronCinco(env));
    if (evento.cron === '0 * * * *') ctx.waitUntil(cronHora(env));
  },
} satisfies ExportedHandler<Env>;
