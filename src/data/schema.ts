// Datos estructurados (auditoria/01-auditoria-tecnica.md §1): la organización en la home y,
// en cada página de servicio, el Service y sus migas. Sin imports de Astro: se prueban en tests/.
import { SITE } from './site';
import { servicioPath, type Servicio } from '../lib/servicios';
import { t, type Locale } from '../i18n/ui';

const ORG_ID = `${SITE.url}/#org`;
const absoluta = (ruta: string) => new URL(ruta, SITE.url).href;

// Textos de la organización que no están en ui.ts.
const ORG_TXT = {
  es: { cargo: 'CEO y fundadora', catalogo: 'Servicios' },
  en: { cargo: 'CEO and founder', catalogo: 'Services' },
} as const;

/** La organización en el idioma de la página: descripción, cargo y servicios con sus URLs. */
export function organizationSchema(servicios: Servicio[], locale: Locale) {
  const txt = ORG_TXT[locale];
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': ORG_ID,
    name: SITE.name,
    url: `${SITE.url}/`,
    logo: `${SITE.url}/logo-512.png`,
    image: `${SITE.url}/og/antidoto-og.jpg`,
    description: t(locale).seo.inicio[1],
    telephone: SITE.phoneDisplay,
    email: SITE.email,
    foundingDate: String(SITE.foundingYear),
    founder: { '@type': 'Person', name: 'María Paula Ramos', jobTitle: txt.cargo },
    areaServed: { '@type': 'Country', name: 'Colombia' },
    knowsLanguage: ['es', 'pt', 'en'],
    sameAs: [SITE.instagram, SITE.linkedin],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: txt.catalogo,
      itemListElement: servicios.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s[locale].title, url: absoluta(servicioPath(s, locale)) },
      })),
    },
  };
}

/** Un servicio en un idioma. `imagen` es la ruta de la foto optimizada (relativa o absoluta). */
export function servicioSchema(servicio: Servicio, locale: Locale, imagen: string) {
  const txt = servicio[locale];
  const url = absoluta(servicioPath(servicio, locale));
  return {
    '@type': 'Service',
    '@id': `${url}#servicio`,
    name: txt.title,
    description: txt.lead,
    url,
    image: absoluta(imagen),
    inLanguage: t(locale).htmlLang,
    areaServed: { '@type': 'Country', name: 'Colombia' },
    provider: { '@type': 'ProfessionalService', '@id': ORG_ID, name: SITE.name, url: `${SITE.url}/` },
  };
}

/** Migas de pan: cada eslabón es [nombre, ruta]. El último es la página actual. */
export function migasSchema(migas: Array<[nombre: string, ruta: string]>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: migas.map(([name, ruta], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absoluta(ruta) })),
  };
}

/** Varios nodos en un solo bloque JSON-LD. */
export function grafo(...nodos: Record<string, unknown>[]) {
  return { '@context': 'https://schema.org', '@graph': nodos };
}
