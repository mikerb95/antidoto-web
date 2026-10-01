import { defineConfig } from 'vitest/config';

// La API (api/) tiene sus propias pruebas y su propio vitest.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
