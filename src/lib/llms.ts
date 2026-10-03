// /llms.txt (formato de llmstxt.org): un resumen en Markdown de Antídoto para asistentes de IA,
// armado con los mismos datos del sitio (servicios publicables, clientes, contacto y rutas).
// Sin imports de Astro en tiempo de ejecución para poder probarlo en tests/.
import { SITE } from '../data/site';
import { servicioPath, type Servicio } from './servicios';
import { t, rutas, type Locale, type Pagina } from '../i18n/ui';

const url = (ruta: string) => new URL(ruta, SITE.url).href;

const PAGINAS: Pagina[] = ['inicio', 'servicios', 'clientes', 'nosotros', 'contacto'];

function paginas(locale: Locale): string[] {
  const seo = t(locale).seo;
  return PAGINAS.map((p) => `- [${seo[p][0]}](${url(rutas[p][locale])}): ${seo[p][1]}`);
}

export function llmsTxt(servicios: Servicio[], clientes: string[]): string {
  return [
    `# ${SITE.name}`,
    '',
    `> ${t('es').seo.inicio[1]}`,
    '',
    `Antídoto es un estudio creativo empresarial colombiano fundado en ${SITE.foundingYear} por María Paula Ramos. Trabaja con empresas y colegios en Colombia. Las cotizaciones se piden por WhatsApp (${SITE.phoneDisplay}) o con el cotizador de ${url(rutas.contacto.es)}.`,
    '',
    '## Servicios',
    '',
    ...servicios.flatMap((s) => {
      const es = s.es;
      const incluye = es.includes.filter((i) => !es.facts.includes(i));
      return [
        `- [${es.title}](${url(servicioPath(s, 'es'))}): ${es.lead}`,
        `  - ${es.facts.join('. ')}.`,
        ...(incluye.length ? [`  - Incluye: ${incluye.join(', ')}.`] : []),
      ];
    }),
    '',
    '## Clientes',
    '',
    `Han trabajado con Antídoto: ${clientes.join(', ')}.`,
    '',
    '## Páginas',
    '',
    ...paginas('es'),
    '',
    '## Contacto',
    '',
    `- WhatsApp y teléfono: ${SITE.phoneDisplay}`,
    `- Correo: ${SITE.email}`,
    `- Instagram: ${SITE.instagram}`,
    `- LinkedIn: ${SITE.linkedin}`,
    '',
    '## Optional',
    '',
    ...paginas('en'),
    ...servicios.map((s) => `- [${s.en.title}](${url(servicioPath(s, 'en'))}): ${s.en.lead}`),
    '',
  ].join('\n');
}
