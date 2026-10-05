// Imagen para compartir (Open Graph, 1200 x 630) de cada línea, oferta y solución: la tarjeta
// que muestran WhatsApp, LinkedIn y los chats al pegar un enlace. Se genera en el build: satori
// arma el SVG con el texto ya trazado (con las fuentes de marca) y sharp lo pasa a JPEG.
// Solo corre en Node (lee archivos); las rutas públicas están en og-rutas.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { WORDMARK, WORDMARK_VIEWBOX } from '../data/logo';

export const OG_ANCHO = 1200;
export const OG_ALTO = 630;

// TTF convertidos de los WOFF2 de public/fonts (satori no lee WOFF2). Mismo subconjunto latino.
// Desde la raíz del proyecto: en el build este módulo corre empaquetado, lejos de src/.
const fuente = (archivo: string) => readFileSync(join(process.cwd(), 'src/assets/og', archivo));
let fuentes: Parameters<typeof satori>[1]['fonts'] | undefined;
const cargarFuentes = () =>
  (fuentes ??= [
    { name: 'Cal Sans', data: fuente('cal-sans-400.ttf'), weight: 400, style: 'normal' },
    { name: 'Poppins', data: fuente('poppins-500.ttf'), weight: 500, style: 'normal' },
    { name: 'Poppins', data: fuente('poppins-600.ttf'), weight: 600, style: 'normal' },
  ]);

const COLOR = { ink: '#0f181d', cian: '#3bc8f3', mid: '#1c99ca', glow: '#80dcff', blanco: '#ffffff', suave: '#a7b6ba' };
const FOTO = { ancho: 460, alto: 550 };

const logo = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK_VIEWBOX}"><g fill="${COLOR.cian}">${WORDMARK}</g></svg>`,
).toString('base64')}`;
const [, , logoW, logoH] = WORDMARK_VIEWBOX.split(' ').map(Number);

/** Tamaño del título según su largo: que quepa en tres líneas a la izquierda de la foto. */
export function tamanoTitulo(titulo: string): number {
  if (titulo.length <= 18) return 76;
  if (titulo.length <= 30) return 66;
  if (titulo.length <= 44) return 56;
  return 48;
}

type Nodo = { type: string; props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Nodo => ({
  type,
  props: { style, children, ...extra },
});

export interface DatosOg {
  /** Etiqueta sobre el título: la línea de una oferta, "Servicios" o "Soluciones". */
  kicker: string;
  titulo: string;
  /** Ruta absoluta de la foto original. */
  foto: string;
  dominio: string;
}

export async function imagenOg({ kicker, titulo, foto, dominio }: DatosOg): Promise<Buffer> {
  const recorte = await sharp(foto).resize(FOTO.ancho, FOTO.alto, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
  const arbol = h(
    'div',
    { width: OG_ANCHO, height: OG_ALTO, display: 'flex', position: 'relative', background: COLOR.ink, fontFamily: 'Poppins' },
    [
      h('div', { display: 'flex', flexDirection: 'column', width: 640, padding: '64px 0 0 72px', height: '100%' }, [
        h('img', { width: 216, height: (216 * logoH) / logoW }, undefined, { src: logo, width: 216, height: (216 * logoH) / logoW }),
        h('div', { display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 'auto', gap: 18 }, [
          h('div', { display: 'flex', alignItems: 'center', gap: 12, color: COLOR.cian, fontSize: 22, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase' }, [
            h('div', { width: 12, height: 12, borderRadius: 6, background: COLOR.cian }),
            kicker,
          ]),
          h('div', { display: 'flex', color: COLOR.blanco, fontFamily: 'Cal Sans', fontSize: tamanoTitulo(titulo), lineHeight: 1.08, letterSpacing: -1 }, titulo),
        ]),
        h('div', { display: 'flex', color: COLOR.suave, fontSize: 22, fontWeight: 500, marginBottom: 58 }, dominio),
      ]),
      h('img', { position: 'absolute', top: 40, right: 48, width: FOTO.ancho, height: FOTO.alto, borderRadius: 28, objectFit: 'cover' }, undefined, {
        src: `data:image/jpeg;base64,${recorte.toString('base64')}`,
        width: FOTO.ancho,
        height: FOTO.alto,
      }),
      // Nivel de líquido al pie, como el frasco del logo (el mismo del cierre de las páginas).
      h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, backgroundImage: `linear-gradient(90deg, ${COLOR.mid}, ${COLOR.cian}, ${COLOR.glow})` }),
    ],
  );
  const svg = await satori(arbol as never, { width: OG_ANCHO, height: OG_ALTO, fonts: cargarFuentes() });
  return sharp(Buffer.from(svg)).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}
