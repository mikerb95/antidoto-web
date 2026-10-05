// Genera los PNG quietos de las escenas pixel (src/assets/pixel/): son el primer pintado del
// hero y de la sala, y lo que se ve sin JS o con movimiento reducido. Uso: npm run pixel:posters
// tests/pixel.test.ts falla si quedan distintos a lo que dibuja el código.
import { writeFileSync } from 'node:fs';
import { posters } from './posters.mts';

for (const [archivo, datos] of Object.entries(posters())) {
  writeFileSync(new URL(`../src/assets/pixel/${archivo}`, import.meta.url), datos);
  console.log(`src/assets/pixel/${archivo}: ${datos.length} bytes`);
}
