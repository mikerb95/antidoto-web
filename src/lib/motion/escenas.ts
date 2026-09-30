// Animación de las escenas de servicio (foto real + firma). Compartido entre el índice de
// servicios con ventana fija y la página de cada servicio.
import { gsap } from './core';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin);

// Firma de cada escena: lo que se dibuja al activarse (los bucles viven en el CSS).
function firma(escena: HTMLElement) {
  const tl = gsap.timeline();
  const trazos = escena.querySelectorAll('.trazo');
  const nodos = escena.querySelectorAll('.nodo');
  const relleno = escena.querySelector('.relleno');
  const foto = escena.querySelector('[data-foto]');
  if (trazos.length) tl.fromTo(trazos, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, ease: 'power2.inOut' }, 0.15);
  if (nodos.length) tl.fromTo(nodos, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'back.out(2)', stagger: 0.08 }, 0.1);
  if (relleno) tl.fromTo(relleno, { opacity: 0 }, { opacity: 0.22, duration: 0.4 }, 0.9);
  // Empuje de cámara suave sobre la foto: el encuadre "llega" como en un plano.
  if (foto) tl.fromTo(foto, { scale: 1.06 }, { scale: 1, duration: 1.2, ease: 'power2.out' }, 0);
  return tl;
}

// Timecode a 25 fps mientras la escena de audiovisual está activa (máx. 6 s).
function timecode(escena: HTMLElement) {
  const el = escena.querySelector<SVGTextElement>('[data-timecode]');
  if (!el) return () => {};
  const p = (n: number) => String(n).padStart(2, '0');
  let f = 0;
  const id = window.setInterval(() => {
    f++;
    el.textContent = `00:00:${p(Math.floor(f / 25) % 60)}:${p(f % 25)}`;
    if (f >= 150) window.clearInterval(id);
  }, 40);
  return () => window.clearInterval(id);
}

export function activar(escena: HTMLElement) {
  escena.classList.remove('is-activa');
  void escena.offsetWidth; // reinicia los bucles CSS
  escena.classList.add('is-activa');
  firma(escena);
  return timecode(escena);
}

