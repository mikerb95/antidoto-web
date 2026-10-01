// Empaqueta la interfaz de la bandeja (src/admin-ui/) en un módulo que el Worker sirve tal cual.
// Corre antes de dev, deploy, check y test; el archivo generado no se versiona.
import { readFileSync, writeFileSync } from 'node:fs';

const leer = (f) => readFileSync(new URL(`../src/admin-ui/${f}`, import.meta.url), 'utf8');
const salida = `// Generado por scripts/empaquetar-ui.mjs desde src/admin-ui/. No editar.
export const ADMIN_HTML = ${JSON.stringify(leer('index.html'))};
export const ADMIN_JS = ${JSON.stringify(leer('app.js'))};
export const ADMIN_CSS = ${JSON.stringify(leer('app.css'))};
`;
writeFileSync(new URL('../src/admin-ui.ts', import.meta.url), salida);
