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
import { llenar } from './llenar';

gsap.registerPlugin(SplitText);

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

/**
 * Hero: el titular sube palabra a palabra y su resaltado recibe la dosis; la trivia entra
 * llenándose de líquido y la franja de la fundadora sube desde abajo.
 */
function hero(seccion: HTMLElement) {
  const h1 = seccion.querySelector<HTMLElement>('h1');
  const res = h1?.querySelector<HTMLElement>('.resaltado');
  const resto = seccion.querySelectorAll<HTMLElement>('[data-hero-entra]');
  const juego = seccion.querySelector<HTMLElement>('[data-hero-juego] .pantalla');
  const franja = seccion.querySelector<HTMLElement>('[data-hero-franja]');
  let split: SplitText | null = null;
  pieza(
    'hero',
    () => {
      gsap.from(resto, { y: 18, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08, delay: 0.35, clearProps: 'transform,opacity' });
      if (h1) {
        split = new SplitText(h1, { type: 'words', mask: 'words' });
        gsap.from(split.words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.1 });
      }
      if (juego) {
        gsap.from(juego, { y: 40, rotation: 2.5, duration: 1.1, ease: 'expo.out', delay: 0.25, clearProps: 'transform' });
        llenar(juego, { duracion: 1.1, delay: 0.25 });
      }
      if (franja) gsap.from(franja, { yPercent: 100, duration: 1, ease: 'expo.out', delay: 0.6, clearProps: 'transform' });
    },
    () => {
      split?.revert();
      if (juego) juego.style.clipPath = '';
      gsap.set([...resto, juego, franja], { clearProps: 'all' });
    },
  );
  if (res) dosis(res, 0.85);
}

/**
 * Olas del hero: siguen al cursor (la posición mueve las capas en sentidos contrarios y la
 * velocidad levanta la ola, que se calma sola) y, en táctil, al scroll. No es un bucle: si la
 * persona no hace nada, el agua queda quieta.
 */
function olasVivas(seccion: HTMLElement) {
  const olas = seccion.querySelector<HTMLElement>('[data-olas]');
  const frente = seccion.querySelector<SVGElement>('[data-ola="frente"]');
  const fondo = seccion.querySelector<SVGElement>('[data-ola="fondo"]');
  if (!olas || !frente || !fondo) return;
  pieza('olas-vivas', () => {
    const xFrente = gsap.quickTo(frente, 'xPercent', { duration: 1.6, ease: 'power3.out' });
    const xFondo = gsap.quickTo(fondo, 'xPercent', { duration: 2.2, ease: 'power3.out' });
    const alto = gsap.quickTo(olas, 'scaleY', { duration: 0.9, ease: 'power2.out' });
    gsap.set([frente, fondo], { xPercent: -25 });
    const mover = (p: number) => {
      xFrente(-25 - p * 22);
      xFondo(-25 + p * 16);
    };
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let ultimo = 0;
      let calma: number | undefined;
      addEventListener(
        'pointermove',
        (e) => {
          mover(e.clientX / innerWidth);
          const v = Math.min(1, Math.abs(e.clientX - ultimo) / 60);
          ultimo = e.clientX;
          alto(1 + v * 0.7);
          clearTimeout(calma);
          calma = window.setTimeout(() => alto(1), 140);
        },
        { passive: true },
      );
    } else {
      ScrollTrigger.create({ trigger: seccion, start: 'top top', end: 'bottom top', onUpdate: (st) => mover(st.progress * 2) });
    }
  });
}

/** Resultados por equipo: las barras se llenan y los porcentajes ruedan al asomar. */
function resultados(fig: HTMLElement) {
  const barras = [...fig.querySelectorAll<HTMLElement>('[data-pct]')];
  pieza(
    'resultados',
    () => {
      gsap.set(barras, { scaleX: 0 });
      alAsomar(fig, () =>
        gsap.to(barras, { scaleX: (i: number) => Number(barras[i].dataset.pct) / 100, duration: 1.4, ease: 'expo.out', stagger: 0.12 }),
      );
      odometro(fig);
    },
    () => barras.forEach((b) => gsap.set(b, { scaleX: Number(b.dataset.pct) / 100 })),
  );
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
          // El nombre queda fijo ("Pausar animación"): aria-pressed anuncia el estado. El título visible sí cambia.
          boton.title = (pausado ? boton.dataset.reanudar : boton.dataset.pausar) ?? '';
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
 * se desplazan dentro de su marco, ampliadas lo justo para no dejar huecos.
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
}

export function iniciarInicio() {
  const h = document.querySelector<HTMLElement>('[data-hero]');
  if (h) {
    hero(h);
    olasVivas(h);
  }
  const r = document.querySelector<HTMLElement>('[data-resultados]');
  if (r) resultados(r);
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
