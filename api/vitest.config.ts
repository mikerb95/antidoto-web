import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    projects: [
      // API: Node con una D1 local (miniflare).
      { test: { name: 'api', include: ['test/**/*.test.ts'], testTimeout: 20000, hookTimeout: 60000 } },
      // Panel: componentes de Preact en happy-dom.
      {
        oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
        resolve: { alias: { '@api': fileURLToPath(new URL('./src', import.meta.url)) } },
        test: { name: 'panel', include: ['admin/test/**/*.test.{ts,tsx}'], environment: 'happy-dom' },
      },
    ],
  },
});
