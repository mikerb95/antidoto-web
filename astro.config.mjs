// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import serviceWorker from './integraciones/service-worker.mjs';

// Fuera del sitemap: páginas con noindex (offline, la política que es borrador y la documentación interna).
const FUERA_DEL_SITEMAP = ['/offline/', '/en/offline/', '/politica-de-datos/', '/en/data-policy/'];

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
