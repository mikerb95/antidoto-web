// Qué se dibuja en cada PNG quieto: lo comparten el script que los escribe y la prueba.
import { PixelBuffer } from '../src/lib/pixel/buffer.ts';
import { Estudio } from '../src/lib/pixel/escenas/estudio.ts';
import { Sala } from '../src/lib/pixel/escenas/sala.ts';
import { png } from './png.mts';

export function posters(): Record<string, Buffer> {
  const e = new Estudio();
  e.update(0.5);
  const eb = new PixelBuffer(e.width, e.height);
  e.render(eb);

  const s = new Sala();
  s.cuadroQuieto();
  const sb = new PixelBuffer(s.width, s.height);
  s.render(sb);

  return {
    'estudio.png': png(eb, 1),
    'estudio@2x.png': png(eb, 2),
    'sala@2x.png': png(sb, 2),
  };
}
