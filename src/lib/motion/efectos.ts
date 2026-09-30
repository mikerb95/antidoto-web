// Gestos comunes a todas las páginas: titulares que se arman y botones magnéticos.
import { gsap, pieza } from './core';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

/** Titulares `[data-titular]`: cada palabra sube desde una máscara. */
export function titulares(raiz: ParentNode = document) {
  raiz.querySelectorAll<HTMLElement>('[data-titular]').forEach((el) => {
    let split: SplitText | null = null;
    pieza(
      'titular',
      () => {
        split = new SplitText(el, { type: 'words', mask: 'words' });
        // El degradado de acento no pasa a las palabras transformadas: cada palabra lo lleva
        // y el contenedor lo suelta (si no, el texto queda transparente).
        split.words.forEach((w) => {
          const acento = w.parentElement?.closest('.texto-acento');
          if (acento) {
            w.classList.add('texto-acento');
            (acento as HTMLElement).style.backgroundImage = 'none';
          }
        });
        gsap.from(split.words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.1 });
      },
      () => split?.revert(),
    );
  });
}

/**
 * Botones `[data-magnetico]`: la píldora sigue al cursor y su texto se mueve un 45 % de
 * eso, dos capas que dan volumen. Solo con puntero fino (en táctil no hay hover).
 */
export function magneticos(raiz: ParentNode = document) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  raiz.querySelectorAll<HTMLElement>('[data-magnetico]').forEach((btn) => {
    pieza('magnetico', () => {
      const texto = btn.querySelector<HTMLElement>('[data-magnetico-texto]');
      const x = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
      const y = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
      const tx = texto ? gsap.quickTo(texto, 'x', { duration: 0.5, ease: 'power3.out' }) : null;
      const ty = texto ? gsap.quickTo(texto, 'y', { duration: 0.5, ease: 'power3.out' }) : null;
      const RADIO = 1.35; // atrae un poco antes de tocar el botón

      const mover = (e: PointerEvent) => {
        const r = btn.getBoundingClientRect();
        // El centro se mide sin la traslación propia; si no, el botón se retroalimenta y tiembla.
        const cx = r.left + r.width / 2 - (gsap.getProperty(btn, 'x') as number);
        const cy = r.top + r.height / 2 - (gsap.getProperty(btn, 'y') as number);
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const cerca = Math.abs(dx) < (r.width / 2) * RADIO && Math.abs(dy) < (r.height / 2) * RADIO;
        const fx = cerca ? dx * 0.3 : 0;
        const fy = cerca ? dy * 0.4 : 0;
        x(fx);
        y(fy);
        tx?.(fx * 0.45);
        ty?.(fy * 0.45);
      };
      window.addEventListener('pointermove', mover, { passive: true });
    });
  });
}
