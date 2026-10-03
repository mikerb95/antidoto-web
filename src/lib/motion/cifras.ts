// Odómetro de cifras, común a la franja de servicios y a la home: cada cifra "llega" rodando
// en vez de estar quieta. El HTML trae el valor final; el script lo reemplaza por columnas y
// conserva el texto en aria-label. La lógica pura está en odometro.ts (con tests).
import { gsap, ScrollTrigger, pieza } from './core';
import { piezas, desplazamiento, TIRA } from './odometro';

/** Anima las cifras `[data-cifra]` de `franja` cuando la franja asoma en pantalla. */
export function odometro(franja: HTMLElement) {
  const cifras = [...franja.querySelectorAll<HTMLElement>('[data-cifra]')];
  const originales = cifras.map((c) => c.textContent ?? '');
  pieza(
    'odometro',
    () => {
      const tiras: Array<{ el: HTMLElement; y: number; i: number }> = [];
      cifras.forEach((c, n) => {
        const texto = originales[n];
        c.setAttribute('aria-label', texto);
        c.textContent = '';
        piezas(texto).forEach((p, i) => {
          const celda = document.createElement('span');
          celda.setAttribute('aria-hidden', 'true');
          if (p.tipo === 'fijo') {
            celda.textContent = p.texto;
          } else {
            celda.className = 'odo-col';
            const tira = document.createElement('span');
            tira.className = 'odo-tira';
            tira.textContent = TIRA;
            celda.appendChild(tira);
            tiras.push({ el: tira, y: desplazamiento(p.valor), i });
          }
          c.appendChild(celda);
        });
      });
      // Arranca apenas la franja asoma: un "000" quieto en el borde se leería como el dato.
      let hecho = false;
      ScrollTrigger.create({
        trigger: franja,
        start: 'top bottom',
        onEnter: () => {
          if (hecho) return;
          hecho = true;
          tiras.forEach(({ el, y, i }) => gsap.to(el, { yPercent: y, duration: 1.6, ease: 'expo.out', delay: 0.1 + i * 0.08 }));
        },
      });
    },
    () => cifras.forEach((c, n) => (c.textContent = originales[n])),
  );
}
