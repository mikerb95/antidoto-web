// Imágenes para compartir (og:image) de líneas, ofertas y soluciones, en los dos idiomas. Una
// solución usa la foto de la línea de su primera oferta recomendada. Ver src/lib/og.ts.
import type { APIRoute, GetStaticPaths, ImageMetadata } from 'astro';
import { join } from 'node:path';
import { imagenOg } from '../../../lib/og';
import { ogRuta, type TipoOg } from '../../../lib/og-rutas';
import { obtenerServicios } from '../../../data/servicios';
import { obtenerOfertas } from '../../../data/contenido';
import { SOLUCIONES } from '../../../data/soluciones';
import { SITE } from '../../../data/site';
import { LOCALES, t } from '../../../i18n/ui';

// Ruta real de cada foto: los metadatos de astro:assets no la exponen, así que se cruzan por `src`.
const fotos = import.meta.glob<ImageMetadata>('/src/assets/fotos/*', { eager: true, import: 'default' });
function archivoDe(imagen: ImageMetadata): string {
  const ruta = Object.entries(fotos).find(([, m]) => m.src === imagen.src)?.[0];
  if (!ruta) throw new Error(`La foto ${imagen.src} no está en src/assets/fotos/`);
  return join(process.cwd(), ruta);
}

type Props = {
  kicker: string;
  titulo: string;
  foto: string;
};

export const getStaticPaths = (async () => {
  const servicios = await obtenerServicios();
  const ofertas = await obtenerOfertas();
  const paginas: { tipo: TipoOg; clave: string; locale: (typeof LOCALES)[number]; props: Props }[] = [];
  for (const locale of LOCALES) {
    const s = t(locale);
    for (const sv of servicios) {
      paginas.push({ tipo: 'linea', clave: sv.id, locale, props: { kicker: s.nav.servicios, titulo: sv[locale].title, foto: archivoDe(sv.image) } });
    }
    for (const o of ofertas) {
      const linea = servicios.find((sv) => sv.id === o.linea)!;
      paginas.push({ tipo: 'oferta', clave: o.id, locale, props: { kicker: linea[locale].title, titulo: o[locale].title, foto: archivoDe(linea.image) } });
    }
    for (const sol of SOLUCIONES) {
      const linea = servicios.find((sv) => ofertas.find((o) => o.id === sol.ofertas[0])?.linea === sv.id) ?? servicios[0];
      paginas.push({ tipo: 'solucion', clave: sol.clave, locale, props: { kicker: s.nav.soluciones, titulo: s.inicio.paraQuien.perfiles[sol.perfil][0], foto: archivoDe(linea.image) } });
    }
  }
  return paginas.map(({ tipo, clave, locale, props }) => ({
    params: { locale, nombre: ogRuta(tipo, clave, locale).split('/').pop()!.replace(/\.jpg$/, '') },
    props,
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = async ({ props }) => {
  const jpeg = await imagenOg({ ...props, dominio: new URL(SITE.url).host });
  return new Response(new Uint8Array(jpeg), { headers: { 'content-type': 'image/jpeg' } });
};
