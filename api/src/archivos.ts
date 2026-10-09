// Imágenes que sube el equipo: se acepta el tipo por sus primeros bytes (no por la extensión ni
// por lo que diga el navegador) y se leen ancho y alto de la cabecera. Nada de SVG: puede llevar
// scripts. Solo PNG, JPEG y WebP, que el build del sitio optimiza con astro:assets.
//
// Módulo PURO.

// 4 MB: una función de Vercel no recibe cuerpos de más de 4,5 MB (la imagen va en un formulario).
export const MAX_BYTES_IMAGEN = 4 * 1024 * 1024;
export type MimeImagen = 'image/png' | 'image/jpeg' | 'image/webp';
export const EXTENSION: Record<MimeImagen, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export interface InfoImagen {
  mime: MimeImagen;
  ancho: number;
  alto: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** Tipo y tamaño de una imagen, o null si no es PNG, JPEG ni WebP válido. */
export function leerImagen(b: Uint8Array): InfoImagen | null {
  // PNG: firma de 8 bytes y el bloque IHDR primero.
  if (b.length > 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    return dimensiones('image/png', u32be(b, 16), u32be(b, 20));
  }
  // JPEG: se recorren los segmentos hasta un SOF (marcador de inicio de cuadro).
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marcador = b[i + 1]!;
      if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
        i += 2;
        continue;
      }
      const largo = u16be(b, i + 2);
      const esSof = marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
      if (esSof) return dimensiones('image/jpeg', u16be(b, i + 7), u16be(b, i + 5));
      i += 2 + largo;
    }
    return null;
  }
  // WebP: RIFF....WEBP y un bloque VP8, VP8L o VP8X.
  if (b.length > 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const bloque = ascii(b, 12, 4);
    if (bloque === 'VP8 ') return dimensiones('image/webp', u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
    if (bloque === 'VP8L' && b[20] === 0x2f) {
      const v = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return dimensiones('image/webp', (v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1);
    }
    if (bloque === 'VP8X') return dimensiones('image/webp', u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  return null;
}

function dimensiones(mime: MimeImagen, ancho: number, alto: number): InfoImagen | null {
  return ancho > 0 && alto > 0 && ancho <= 12000 && alto <= 12000 ? { mime, ancho, alto } : null;
}

/** Nombre de archivo limpio para mostrar (sin rutas ni caracteres raros). */
export function nombreLimpio(nombre: string): string {
  return (
    nombre
      .split(/[\\/]/)
      .pop()!
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}._ -]+/gu, '')
      .trim()
      .slice(0, 120) || 'imagen'
  );
}
