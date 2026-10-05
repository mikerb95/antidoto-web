// Paracaídas del paseo: el facilitador salta del estudio, lo abre y baja colgado hasta la sala.
// Cúpula a rayas cian y blanco (los colores de la marca) con contorno oscuro, la franja de abajo
// en sombra y los cordones hasta las manos. `apertura` va de 0 (el bulto cerrado en la espalda) a
// 1 (abierto); `colapso` de 0 a 1 lo desinfla hacia un lado al aterrizar. Sin DOM.

import { mix, type PixelBuffer } from './buffer.ts';
import { STAND, type Pose } from './avatar.ts';
import { C } from './cuarto.ts';

/** Colgado de los cordones: brazos arriba y piernas sueltas que se mecen un poco. */
export function poseColgado(t: number): Pose {
  const s = Math.sin(t * 2.4);
  return { ...STAND, lean: 0, armN: 168, foreN: 176, armF: 162, foreF: 172, thighN: 8 + 6 * s, shinN: -4 + 8 * s, thighF: -6 - 6 * s, shinF: -10 - 6 * s, headTilt: -10 };
}

/** En el aire antes de abrir: brazos y piernas abiertos. */
export const CAIDA: Pose = { ...STAND, lean: 0, armN: 120, foreN: 150, armF: 110, foreF: 140, thighN: 24, shinN: -20, thighF: -18, shinF: -26, headTilt: -14 };

/** Al tocar el piso: rodillas dobladas para amortiguar. */
export const ATERRIZA: Pose = { ...STAND, lean: 14, thighN: 44, shinN: -30, thighF: 30, shinF: -40, armN: 50, foreN: 70, armF: 40, foreF: 60, headTilt: 6 };

const ANCHO = 27;
const ALTO = 15;
/** Distancia de las manos al borde de la cúpula. */
const CORDON = 22;

/**
 * Dibuja la cúpula sobre las manos (`manos` es el punto medio entre ellas, en px del buffer).
 * Se pinta antes que el avatar: los cordones quedan detrás de los brazos.
 */
export function drawParacaidas(buf: PixelBuffer, manos: { x: number; y: number }, apertura: number, colapso = 0, piso?: number) {
  if (apertura <= 0) return;
  const a = Math.min(1, apertura);
  // Al abrir crece desde un bulto alargado; al desinflarse se aplana y cae hacia la derecha.
  const w = ANCHO * (0.25 + 0.75 * a) * (1 - colapso * 0.15);
  const h = ALTO * (0.35 + 0.65 * a) * (1 - colapso * 0.75);
  const cx = manos.x + colapso * 18;
  const enAire = manos.y - CORDON * (0.5 + 0.5 * a);
  // Desinflado, cae hasta el piso (si se sabe dónde está) al lado del personaje.
  const base = enAire + ((piso ?? enAire + 22) - enAire) * colapso * colapso;

  // Cordones: del borde y de dos puntos intermedios a las manos.
  const cordon = mix(C.slate, C.paper, 0.2);
  for (const f of [-1, -0.45, 0.45, 1]) buf.line(cx + f * (w - 1), base, manos.x + f * 1.5, manos.y, cordon);

  // Cúpula: media elipse con gajos verticales alternos y la franja de abajo en sombra.
  const y0 = Math.floor(base - h);
  const mitad = (y: number) => {
    const dy = (base - (y + 0.5)) / h;
    return dy < 0 || dy > 1 ? -1 : w * Math.sqrt(1 - dy * dy);
  };
  for (let y = y0; y <= Math.ceil(base); y++) {
    const dy = (base - (y + 0.5)) / h;
    const half = mitad(y);
    if (half < 0) continue;
    const arriba = mitad(y - 1);
    for (let x = Math.ceil(cx - half - 0.5); x <= Math.floor(cx + half - 0.5); x++) {
      // Contorno: los extremos de cada fila, lo que no tiene cúpula encima y la franja de abajo.
      const borde = x <= Math.ceil(cx - half - 0.5) || x >= Math.floor(cx + half - 0.5) || Math.abs(x + 0.5 - cx) > arriba || dy < 0.12;
      if (borde) {
        buf.px(x, y, C.outline);
        continue;
      }
      const gajo = Math.floor(((x - cx) / w + 1) * 3.5);
      let c = gajo % 2 === 0 ? C.antidote : C.paper;
      if (dy < 0.3) c = mix(c, C.deep, 0.35);
      else if ((x - cx) / w < -0.45) c = mix(c, C.paper, 0.25);
      buf.px(x, y, c);
    }
  }
}
