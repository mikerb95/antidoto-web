// RSS del blog en este idioma, generado en el build con los artículos publicables.
import type { APIRoute } from 'astro';
import { obtenerArticulos, articuloPath } from '../../data/contenido';
import { rssXml } from '../../lib/publicaciones';
import { t, rutas } from '../../i18n/ui';

export const GET: APIRoute = async () =>
  new Response(rssXml((await obtenerArticulos()).map((a) => ({ titulo: a.es.title, resumen: a.es.lead, ruta: articuloPath(a, 'es'), fecha: a.fecha })), {
    titulo: t('es').seo.blog[0],
    descripcion: t('es').seo.blog[1],
    ruta: rutas.blog.es,
    idioma: t('es').htmlLang,
  }), { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
