// Motion compartido del sitio: GSAP, Lenis y el ciclo de vida con <ClientRouter />.
//
// Cada pieza animada se registra con `pieza()`: si el usuario pidió menos movimiento no
// corre nada, y si la inicialización falla se llama a su `restaurar` para devolver la
// visibilidad de lo que el script alcanzó a esconder (fail-open). El HTML del servidor
// siempre es el estado final legible.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;
const limpiezas: Array<() => void> = [];

function raf(time: number) {
  lenis?.raf(time * 1000);
}

/**
 * Arranca el scroll suave en las páginas que lo piden con `data-scroll="suave"` en <body>.
 * Las páginas de lectura no lo llevan y conservan el scroll nativo.
 */
function iniciarScroll() {
  if (reducido() || document.body.dataset.scroll !== 'suave') return;
  lenis = new Lenis({ anchors: { offset: -80 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
}

/** Registra una pieza de motion con su limpieza y su respaldo si falla. */
export function pieza(nombre: string, iniciar: () => void | (() => void), restaurar?: () => void) {
  if (reducido()) return;
  try {
    const limpiar = iniciar();
    if (limpiar) limpiezas.push(limpiar);
  } catch (err) {
    console.warn(`[motion] ${nombre} deshabilitado tras un fallo`, err);
    try {
      restaurar?.();
    } catch {
      /* el respaldo nunca debe romper la página */
    }
  }
}

/** Reproduce un bucle solo mientras su elemento está en pantalla y la pestaña visible. */
export function soloVisible(el: Element, anim: { play: () => unknown; pause: () => unknown }) {
  let enPantalla = false;
  const actualizar = () => (enPantalla && !document.hidden ? anim.play() : anim.pause());
  const io = new IntersectionObserver(([e]) => {
    enPantalla = e.isIntersecting;
    actualizar();
  });
  io.observe(el);
  document.addEventListener('visibilitychange', actualizar);
  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', actualizar);
  };
}

document.addEventListener('astro:page-load', () => {
  iniciarScroll();
  // Las medidas cambian cuando llegan las fuentes; ScrollTrigger recalcula entonces.
  document.fonts.ready.then(() => ScrollTrigger.refresh());
});

document.addEventListener('astro:before-swap', () => {
  limpiezas.splice(0).forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignorar: la página se va */
    }
  });
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.ticker.remove(raf);
  lenis?.destroy();
  lenis = null;
});
