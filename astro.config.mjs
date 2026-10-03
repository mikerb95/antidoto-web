// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import serviceWorker from './integraciones/service-worker.mjs';

// Fuera del sitemap: páginas con noindex (offline, los textos legales en borrador, las preferencias de
// novedades, que solo sirven con el token de un correo, y la documentación interna).
const FUERA_DEL_SITEMAP = ['/offline/', '/en/offline/', '/politica-de-datos/', '/en/data-policy/', '/novedades/preferencias/', '/en/news/preferences/', '/terminos-y-condiciones/', '/en/terms/', '/cookies/', '/en/cookies/'];

export default defineConfig({
  site: 'https://antidotocolombia.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'es', locales: { es: 'es-CO', en: 'en' } },
      filter: (url) => !FUERA_DEL_SITEMAP.some((r) => url.endsWith(r)) && !url.includes('/docs/'),
    }),
    serviceWorker(),
  ],
  vite: { plugins: [tailwindcss()] },
});
