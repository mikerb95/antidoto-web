// Ruta del paseo: el facilitador salta del estudio del hero, abre un paracaídas y baja hasta la
// sala de la actividad. Lógica pura (con pruebas en tests/pixel.test.ts): dado el avance u de 0 a
// 1 devuelve dónde están sus pies en el documento, dónde va el scroll, a qué escala se dibuja, en
// qué fase va (salto, apertura, bajada, aterrizaje) y cuánto se mece.
//
// Scroll y personaje usan la misma curva, así en pantalla se mueve poco (de donde salió a donde
// aterriza) mientras la página sube por detrás, como si bajara flotando.

import type { Pt } from './iso.ts';

/** Duración del paseo en segundos. */
export const DURACION = 6;
/** Tramos del recorrido (fracciones de u). */
export const TRAMOS = { salto: 0.07, abre: 0.15, aterriza: 0.92 };
/** Segundos que se queda en el piso mientras el paracaídas termina de desinflarse. */
export const PAUSA = 0.7;
const ALTO_SALTO = 22;
/** Vaivén del péndulo: grados y vueltas en todo el recorrido. */
const GRADOS = 9;
const VUELTAS = 2.5;

export type Fase = 'salto' | 'abre' | 'baja' | 'aterriza';

export interface Ruta {
  /** Pies al salir y al aterrizar, en px del documento. */
  desde: Pt;
  hasta: Pt;
  scrollDesde: number;
  scrollHasta: number;
  /** Ancho de la ventana, para que el vaivén no se salga. */
  ancho: number;
  escalaDesde: number;
  escalaHasta: number;
}

export interface Punto {
  pies: Pt;
  scroll: number;
  escala: number;
  mira: 1 | -1;
  fase: Fase;
  /** 0 cerrado, 1 abierto. */
  apertura: number;
  /** 0 inflado, 1 desinflado en el piso. */
  colapso: number;
  /** Inclinación del péndulo en grados (positivo: hacia la derecha). */
  angulo: number;
}

/** Casi lineal, con arranque y frenada suaves: un paracaídas baja a velocidad pareja. */
export const pareja = (u: number) => u - (Math.sin(2 * Math.PI * u) / (2 * Math.PI)) * 0.85;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const entre = (u: number, a: number, b: number) => Math.min(1, Math.max(0, (u - a) / (b - a)));

/**
 * Scroll final: la sala entera a la vista, con el borde de abajo del lienzo a 24 px del fondo de la
 * ventana; si cabe más, sube hasta mostrar el título sin pasarse del borde de la sección. Nunca deja
 * la llegada fuera de pantalla ni se pasa del documento.
 */
export function scrollFinal(o: { llegadaY: number; abajo: number; arriba: number; alto: number; maximo: number }) {
  let y = Math.max(o.abajo + 24 - o.alto, Math.min(o.arriba, o.llegadaY - o.alto * 0.9));
  y = Math.min(y, o.llegadaY - 80);
  return Math.min(o.maximo, Math.max(0, y));
}

export function enRuta(r: Ruta, u: number): Punto {
  u = Math.min(1, Math.max(0, u));
  const e = pareja(u);
  const { salto, abre, aterriza } = TRAMOS;
  const fase: Fase = u < salto ? 'salto' : u < abre ? 'abre' : u < aterriza ? 'baja' : 'aterriza';

  let y = lerp(r.desde.y, r.hasta.y, e);
  // El salto sube un poco antes de caer.
  if (u < salto) y -= ALTO_SALTO * Math.sin((Math.PI * u) / salto);

  // Péndulo: nace con la apertura y se calma al aterrizar; el vaivén lateral sigue al ángulo.
  const calma = entre(u, salto, abre) * (1 - entre(u, aterriza - 0.06, aterriza));
  const vaiven = Math.sin(2 * Math.PI * VUELTAS * u) * calma;
  const amp = Math.min(r.ancho * 0.08, 90);
  const x = Math.min(r.ancho - 40, Math.max(40, lerp(r.desde.x, r.hasta.x, e) + amp * vaiven));

  return {
    pies: { x, y },
    scroll: lerp(r.scrollDesde, r.scrollHasta, e),
    escala: lerp(r.escalaDesde, r.escalaHasta, e),
    mira: r.hasta.x >= r.desde.x ? 1 : -1,
    fase,
    apertura: entre(u, salto, abre),
    // Empieza a desinflarse al tocar el piso; el resto lo hace quieto, ya aterrizado (ver PAUSA).
    colapso: entre(u, 0.97, 1) * 0.4,
    angulo: GRADOS * vaiven,
  };
}
