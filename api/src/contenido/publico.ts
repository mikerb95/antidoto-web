// Lecturas públicas del contenido publicado, para el build del sitio (src/lib/cms/ en la raíz):
//   GET /v1/contenido?tipo=blog   entradas publicadas de un tipo, con las URL de sus imágenes
//   GET /v1/medios/<id>           una imagen del bucket MEDIOS
//   GET /v1/ajustes               ajustes del sitio (regalo de bienvenida, video del hero)
// Solo sale lo publicado: la copia de trabajo y los borradores nunca.
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { contenido, medios } from '../db/schema';
import { leerAjustes } from '../configuracion';
import type { Env } from '../env';
import { json } from '../util';
import { TIPOS_CONTENIDO, mediosDe, type TipoContenido } from './esquemas';

const CACHE = { 'cache-control': 'public, max-age=60', 'access-control-allow-origin': '*' };

export async function contenidoPublicado(url: URL, db: DrizzleD1Database, appUrl: string): Promise<Response> {
  const tipo = url.searchParams.get('tipo');
  if (!TIPOS_CONTENIDO.includes(tipo as TipoContenido)) return json({ error: 'tipo' }, 422, CACHE);
  const filas = await db
    .select({ clave: contenido.clave, publicada: contenido.publicada, publicadaEn: contenido.publicadaEn })
    .from(contenido)
    .where(and(eq(contenido.tipo, tipo!), isNotNull(contenido.publicada), isNull(contenido.archivada)));
  const entradas = filas.map((f) => ({ clave: f.clave, datos: f.publicada!.datos, textos: f.publicada!.textos, version: f.publicada!.version, publicadaEn: f.publicadaEn }));
  const ids = [...new Set(entradas.flatMap((e) => mediosDe(tipo as TipoContenido, e)))];
  const imagenes = ids.length ? await db.select().from(medios).where(inArray(medios.id, ids)) : [];
  return json(
    {
      tipo,
      entradas,
      medios: Object.fromEntries(imagenes.map((m) => [m.id, { url: `${appUrl}/v1/medios/${m.id}`, mime: m.mime, ancho: m.ancho, alto: m.alto, nombre: m.nombre }])),
    },
    200,
    CACHE,
  );
}

export async function servirMedio(id: string, env: Env, db: DrizzleD1Database): Promise<Response> {
  const [m] = await db.select().from(medios).where(eq(medios.id, id));
  if (!m || !env.MEDIOS) return new Response('No existe', { status: 404 });
  const obj = await env.MEDIOS.get(m.claveR2);
  if (!obj) return new Response('No existe', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': m.mime,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
    },
  });
}

export async function ajustesSitio(db: DrizzleD1Database): Promise<Response> {
  const a = await leerAjustes(db, ['sitio.regalo_novedades', 'sitio.video_hero']);
  return json({ regaloNovedades: a['sitio.regalo_novedades'], videoHero: a['sitio.video_hero'] }, 200, CACHE);
}
