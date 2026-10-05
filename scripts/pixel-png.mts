// Renderiza las escenas pixel a PNG desde Node, para revisar el arte sin abrir el navegador.
// Uso: node scripts/pixel-png.mts [carpeta] [escala]
// Deja el estudio quieto, el recorrido por cada línea y la salida.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PixelBuffer, hex } from '../src/lib/pixel/buffer.ts';
import { Estudio, PUNTOS } from '../src/lib/pixel/escenas/estudio.ts';
import { Sala } from '../src/lib/pixel/escenas/sala.ts';
import { png } from './png.mts';

const [dir = 'capturas/pixel', escala = '3'] = process.argv.slice(2);
const k = Number(escala);
mkdirSync(dir, { recursive: true });
const fondo = hex('#15232a');

const e = new Estudio({ salio: (p) => console.log('salió en', p) });
const buf = new PixelBuffer(e.width, e.height);
const foto = (nombre: string) => {
  buf.clear();
  e.render(buf);
  writeFileSync(join(dir, `${nombre}.png`), png(buf, k, fondo));
};
const correr = (s: number) => {
  for (let t = 0; t < s; t += 1 / 30) e.update(1 / 30);
};

e.update(0.5);
foto('estudio-0');
for (const clave of Object.keys(PUNTOS)) {
  e.ir(clave);
  correr(6);
  foto(`estudio-${clave}`);
}
e.salir();
correr(1.2);
foto('estudio-salida-1');
correr(3);
foto('estudio-salida-2');

// Sala de la actividad: el cuadro quieto y una corrida completa del guion.
const s = new Sala({ di: (q, l) => console.log('dice', q, l) });
const sb = new PixelBuffer(s.width, s.height);
const fotoSala = (nombre: string) => {
  sb.clear();
  s.render(sb);
  writeFileSync(join(dir, `${nombre}.png`), png(sb, Math.max(1, k - 1), fondo));
};
fotoSala('sala-0');
s.llegar(true);
const correrSala = (seg: number) => {
  for (let t = 0; t < seg; t += 1 / 30) s.update(1 / 30);
};
for (const [n, seg] of [[1, 4], [2, 6], [3, 8], [4, 6], [5, 3], [6, 8]] as const) {
  correrSala(seg);
  fotoSala(`sala-${n}`);
}
const q = new Sala();
q.cuadroQuieto();
q.update(0.1);
const qb = new PixelBuffer(q.width, q.height);
q.render(qb);
writeFileSync(join(dir, 'sala-quieto.png'), png(qb, Math.max(1, k - 1), fondo));
