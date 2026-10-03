// RSS del blog en este idioma, generado en el build con los artículos publicables.
import type { APIRoute } from 'astro';
import { obtenerArticulos, articuloPath } from '../../../data/contenido';
import { rssXml } from '../../../lib/publicaciones';
import { t, rutas } from '../../../i18n/ui';

export const GET: APIRoute = async () =>
  new Response(rssXml((await obtenerArticulos()).map((a) => ({ titulo: a.en.title, resumen: a.en.lead, ruta: articuloPath(a, 'en'), fecha: a.fecha })), {
    titulo: t('en').seo.blog[0],
    descripcion: t('en').seo.blog[1],
    ruta: rutas.blog.en,
    idioma: t('en').htmlLang,
  }), { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
