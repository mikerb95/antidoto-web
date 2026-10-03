// Motion de la home: "una dosis de color". El problema se ve gris y quieto; la solución entra
// como el líquido cian del frasco del logo, que sube con una ola (liquido.ts). El mismo gesto
// llena los resaltados de los títulos, los dolores, los pasos y los afiches, y es el oleaje del cierre.
//
// El HTML del servidor es el estado final (todo lleno y visible). Cada pieza fija su estado
// inicial al arrancar y lo devuelve si falla (pieza() en core.ts); con movimiento reducido no
// corre ninguna, salvo los dolores en táctil, que no son movimiento sino mostrar la solución.
import { SplitText } from 'gsap/SplitText';
import { gsap, ScrollTrigger, pieza, soloVisible } from './core';
import { ola } from './liquido';
import { odometro } from './cifras';

gsap.registerPlugin(SplitText);

/** Llena `el` de abajo arriba con el borde de ola (anima solo clip-path). */
function llenar(el: HTMLElement, { duracion = 1, delay = 0, alTerminar }: { duracion?: number; delay?: number; alTerminar?: () => void } = {}) {
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

/** Corre `fn` una sola vez cuando `el` asoma. (No `once: true`: ver tropiezos de la skill.) */
function alAsomar(el: Element, fn: () => void, start = 'top 85%') {
  let hecho = false;
  ScrollTrigger.create({
    trigger: el,
    start,
    onEnter: () => {
      if (hecho) return;
      hecho = true;
      fn();
    },
  });
}

/**
 * Resaltado de un título: el fondo cian se vacía y una copia del texto en tinta sube como
 * líquido; al llenarse se quita la copia y queda el resaltado real. Solo en una línea: si el
 * resaltado se parte, la copia no calzaría y se deja quieto.
 */
function dosis(res: HTMLElement, cuando: 'asomar' | number) {
  if (res.getClientRects().length > 1) return;
  const quitar = () => {
    res.classList.remove('dosis-pendiente');
    res.querySelector(':scope > .dosis-lleno')?.remove();
  };
  pieza(
    'dosis',
    () => {
      const lleno = document.createElement('span');
      lleno.className = 'dosis-lleno';
      lleno.setAttribute('aria-hidden', 'true');
      lleno.textContent = res.textContent;
      res.classList.add('dosis-pendiente');
      res.appendChild(lleno);
      lleno.style.clipPath = ola(0);
      const correr = (delay = 0) => llenar(lleno, { duracion: 0.9, delay, alTerminar: quitar });
      if (cuando === 'asomar') alAsomar(res, () => correr(0.15), 'top 82%');
      else correr(cuando);
    },
    quitar,
  );
}

/** Hero: el titular sube palabra a palabra, luego su resaltado recibe la dosis. */
function hero(seccion: HTMLElement) {
  const h1 = seccion.querySelector<HTMLElement>('h1');
  const res = h1?.querySelector<HTMLElement>('.resaltado');
  const resto = seccion.querySelectorAll<HTMLElement>('[data-hero-entra]');
  const foto = seccion.querySelector<HTMLElement>('.foto');
  let split: SplitText | null = null;
  pieza(
    'hero',
    () => {
      if (foto) gsap.from(foto, { scale: 1.08, duration: 2.2, ease: 'expo.out' });
      gsap.from(resto, { y: 18, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08, delay: 0.45, clearProps: 'transform,opacity' });
      if (h1) {
        split = new SplitText(h1, { type: 'words', mask: 'words' });
        gsap.from(split.words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.1 });
      }
    },
    () => {
      split?.revert();
      gsap.set([...resto, foto], { clearProps: 'all' });
    },
  );
  if (res) dosis(res, 0.85);
}

/**
 * Dolores en táctil: sin cursor, cada tarjeta recibe su dosis al cruzar el centro de la
 * pantalla y vuelve al gris al salir. Corre también con movimiento reducido: no anima nada
 * (las transiciones se apagan en CSS), solo deja ver la solución.
 */
function dolores() {
  const tarjetas = [...document.querySelectorAll<HTMLElement>('.dolor')];
  if (!tarjetas.length) return;
  try {
    gsap.matchMedia().add('(hover: none)', () => {
      tarjetas.forEach((t) =>
        ScrollTrigger.create({ trigger: t, start: 'top 58%', end: 'bottom 42%', toggleClass: { targets: t, className: 'dosis' } }),
      );
    });
  } catch {
    /* sin esto, la tarjeta sigue funcionando con el foco */
  }
}

/** Pasos: el nivel de cada paso se llena con el scroll, en orden, y el paso se enciende al llenarse. */
function pasos(lista: HTMLElement) {
  const items = [...lista.querySelectorAll<HTMLElement>('.paso')];
  const barras = items.map((li) => li.querySelector<HTMLElement>('.nivel span'));
  pieza(
    'pasos',
    () => {
      const pintar = (avance: number) =>
        items.forEach((li, i) => {
          const f = Math.min(1, Math.max(0, avance * items.length - i));
          const b = barras[i];
          if (b) gsap.set(b, { scaleX: f });
          li.classList.toggle('lleno', f >= 1);
        });
      pintar(0);
      ScrollTrigger.create({ trigger: lista, start: 'top 72%', end: 'bottom 60%', scrub: true, onUpdate: (st) => pintar(st.progress) });
    },
    () => {
      gsap.set(barras, { scaleX: 1 });
      items.forEach((li) => li.classList.add('lleno'));
    },
  );
}

/** Afiches de servicios: la foto sube como líquido cuando su tarjeta asoma. */
function afiches() {
  document.querySelectorAll<HTMLElement>('[data-afiche]').forEach((af) =>
    pieza(
      'afiche',
      () => {
        af.style.clipPath = ola(0);
        alAsomar(af, () => llenar(af, { duracion: 1.2, delay: 0.25 }), 'top 85%');
      },
      () => (af.style.clipPath = ''),
    ),
  );
}

/**
 * Oleaje del cierre: al asomar, la ola crece desde la línea recta; después las dos capas se
 * desplazan sin fin a distinta velocidad y en sentido contrario. Bucle con pausa: se detiene
 * fuera de pantalla, con la pestaña oculta y cuando la persona lo pausa.
 */
function oleaje(seccion: HTMLElement) {
  const olas = seccion.querySelector<HTMLElement>('[data-olas]');
  const frente = seccion.querySelector<SVGElement>('[data-ola="frente"]');
  const fondo = seccion.querySelector<SVGElement>('[data-ola="fondo"]');
  const boton = seccion.querySelector<HTMLButtonElement>('[data-olas-pausa]');
  if (!olas || !frente || !fondo) return;
  pieza(
    'oleaje',
    () => {
      const bucle = gsap.timeline({ paused: true, repeat: -1 });
      bucle.fromTo(frente, { xPercent: 0 }, { xPercent: -50, duration: 9, ease: 'none' }, 0);
      bucle.fromTo(fondo, { xPercent: -50 }, { xPercent: 0, duration: 9, ease: 'none' }, 0);
      // Un leve vaivén vertical del fondo para que el oleaje respire (mismo periodo, sin costura).
      bucle.fromTo(fondo, { yPercent: 0 }, { yPercent: 14, duration: 4.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);

      let pausado = false;
      soloVisible(seccion, { play: () => !pausado && bucle.play(), pause: () => bucle.pause() });
      if (boton) {
        boton.hidden = false;
        boton.addEventListener('click', () => {
          pausado = !pausado;
          if (pausado) bucle.pause();
          else bucle.play();
          boton.setAttribute('aria-pressed', String(pausado));
          boton.textContent = (pausado ? boton.dataset.reanudar : boton.dataset.pausar) ?? '';
        });
      }

      gsap.set(olas, { scaleY: 0 });
      alAsomar(seccion, () => gsap.to(olas, { scaleY: 1, duration: 1.4, ease: 'elastic.out(1, 0.55)' }), 'top 92%');
    },
    () => gsap.set(olas, { clearProps: 'transform' }),
  );
}

/**
 * Profundidad ligada al scroll (no es un bucle: responde a la persona). Las fotos `[data-paralaje]`
 * se desplazan dentro de su marco, ampliadas lo justo para no dejar huecos; el hero se aleja al bajar.
 */
function paralaje() {
  document.querySelectorAll<HTMLElement>('[data-paralaje]').forEach((marco) => {
    const fotos = marco.querySelectorAll<HTMLElement>('img');
    pieza(
      'paralaje',
      () => {
        gsap.fromTo(fotos, { yPercent: -7, scale: 1.16 }, { yPercent: 7, scale: 1.16, ease: 'none', scrollTrigger: { trigger: marco, start: 'top bottom', end: 'bottom top', scrub: true } });
      },
      () => gsap.set(fotos, { clearProps: 'transform' }),
    );
  });
  const h = document.querySelector<HTMLElement>('[data-hero]');
  const foto = h?.querySelector<HTMLElement>('.foto');
  const centro = h?.querySelector<HTMLElement>('.centro');
  if (h && foto && centro) {
    pieza(
      'hero-scroll',
      () => {
        const st = { trigger: h, start: 'top top', end: 'bottom top', scrub: true };
        gsap.to(foto, { yPercent: 18, ease: 'none', scrollTrigger: st });
        gsap.to(centro, { yPercent: -18, opacity: 0.35, ease: 'none', scrollTrigger: { ...st } });
      },
      () => gsap.set([foto, centro], { clearProps: 'transform,opacity' }),
    );
  }
}

export function iniciarInicio() {
  const h = document.querySelector<HTMLElement>('[data-hero]');
  if (h) hero(h);
  document.querySelectorAll<HTMLElement>('main section:not([data-hero]) .resaltado').forEach((r) => dosis(r, 'asomar'));
  dolores();
  const p = document.querySelector<HTMLElement>('[data-pasos]');
  if (p) pasos(p);
  afiches();
  document.querySelectorAll<HTMLElement>('[data-odometro]').forEach((f) => odometro(f));
  const c = document.querySelector<HTMLElement>('[data-cierre]');
  if (c) oleaje(c);
  paralaje();
}
