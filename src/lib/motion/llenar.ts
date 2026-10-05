// Llenado de líquido: el gesto común de la home. Anima solo clip-path con el borde de ola de
// liquido.ts. Lo usan las piezas de inicio.ts.
import { gsap } from './core';
import { ola } from './liquido';

/** Llena `el` de abajo arriba con el borde de ola. Al terminar quita el clip-path. */
export function llenar(el: HTMLElement, { duracion = 1, delay = 0, alTerminar }: { duracion?: number; delay?: number; alTerminar?: () => void } = {}) {
  const estado = { p: 0 };
  el.style.clipPath = ola(0);
  return gsap.to(estado, {
    p: 1,
    duration: duracion,
    delay,
    ease: 'power2.inOut',
    onUpdate: () => {
      el.style.clipPath = ola(estado.p, estado.p * Math.PI * 3);
    },
    onComplete: () => {
      el.style.clipPath = '';
      alTerminar?.();
    },
  });
}
