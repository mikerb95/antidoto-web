// Datos estructurados de la organización (auditoria/01-auditoria-tecnica.md §1).
import { SITE } from './site';
import type { Servicio } from '../lib/servicios';

export function organizationSchema(servicios: Servicio[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${SITE.url}/#org`,
    name: SITE.name,
    url: `${SITE.url}/`,
    logo: `${SITE.url}/logo-512.png`,
    image: `${SITE.url}/og/antidoto-og.jpg`,
    description:
      'Estudio creativo empresarial: formaciones vivenciales, producción audiovisual, catering corporativo y diseño de productos y experiencias.',
    telephone: SITE.phoneDisplay,
    email: SITE.email,
    foundingDate: String(SITE.foundingYear),
    founder: { '@type': 'Person', name: 'María Paula Ramos', jobTitle: 'CEO y fundadora' },
    areaServed: { '@type': 'Country', name: 'Colombia' },
    knowsLanguage: ['es', 'pt', 'en'],
    sameAs: [SITE.instagram, SITE.linkedin],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Servicios',
      itemListElement: servicios.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.es.title, url: `${SITE.url}/servicios/${s.es.slug}/` },
      })),
    },
  };
}
