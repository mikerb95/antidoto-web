// Archivo público de novedades. El sitio (/novedades/) lista las campañas marcadas como públicas
// y cada una se lee en su versión web, que también es el "Ver en el navegador" de los correos. La
// versión web no lleva datos de nadie: sin nombre y sin enlaces personales de baja.
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { campanas } from '../db/schema';
import type { Env } from '../env';
import { renderizar } from './render';
import { paginaNovedades } from './enlaces';
import { json } from '../util';

/** GET /v1/novedades?locale=es: campañas públicas ya enviadas, de la más nueva a la más vieja. */
export async function listarPublicas(url: URL, db: DrizzleD1Database, cors: Record<string, string>): Promise<Response> {
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'es';
  const filas = await db
    .select({ id: campanas.id, asunto: campanas.asunto, preheader: campanas.preheader, fecha: campanas.iniciada })
    .from(campanas)
    .where(and(eq(campanas.publica, true), eq(campanas.estado, 'enviada'), eq(campanas.locale, locale)))
    .orderBy(desc(campanas.iniciada))
    .limit(60);
  return json({ novedades: filas }, 200, { ...cors, 'cache-control': 'public, max-age=300' });
}

/** GET /v1/novedades/<id>: versión web de una campaña que ya salió. */
export async function verPublica(id: string, env: Env, db: DrizzleD1Database): Promise<Response> {
  const [c] = await db.select().from(campanas).where(and(eq(campanas.id, id), inArray(campanas.estado, ['enviando', 'enviada'])));
  if (!c) return new Response('No existe', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { html } = renderizar(c, {}, paginaNovedades(env, c.locale), { modoWeb: true, responsable: env.MAIL_DIRECCION });
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      // Solo las públicas se pueden indexar; las demás existen para "Ver en el navegador".
      ...(c.publica ? {} : { 'x-robots-tag': 'noindex' }),
    },
  });
}
