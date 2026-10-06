// Panel de administración (Preact). Se construye a ../dist-admin/admin/ y el Worker lo sirve con el
// binding ASSETS (ver wrangler.toml y src/panel.ts), con la misma CSP estricta de siempre: ningún
// script ni estilo en línea, todo desde /admin/assets/ con hash.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/admin/',
  publicDir: false,
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  resolve: { alias: { '@api': fileURLToPath(new URL('../src', import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL('../dist-admin/admin', import.meta.url)),
    emptyOutDir: true,
    assetsDir: 'assets',
    manifest: true,
    target: 'es2022',
    // Nada en línea: la CSP solo deja cargar archivos del mismo origen.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
});
