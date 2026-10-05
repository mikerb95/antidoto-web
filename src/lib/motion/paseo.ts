// Paseo del facilitador: al tocar "Ven a ver una actividad" salta del estudio del hero, abre un
// paracaídas y baja meciéndose hasta la sala de la actividad mientras el scroll lo acompaña (ruta en
// src/lib/pixel/paseo.ts, paracaídas en src/lib/pixel/paracaidas.ts). Lo pidió la persona con el botón, pero no se adueña del
// scroll: con la rueda, el dedo o el teclado lo suelta y el personaje sigue solo hasta la sala.
// Al llegar, la sala lo recibe y el foco pasa a su título. Sin JS o con movimiento reducido el
// botón es un enlace a la sala.
import { pieza, scrollAl } from './core';
import type { ControlEstudio } from './estudio';
import type { ControlSala } from './sala';

/** Lienzo del personaje suelto: el avatar, el paracaídas abierto encima y el desinflado al lado. */
const PW = 96;
const PH = 136;
const PIES = { x: 40, y: 130 };
/** Punto del que cuelga el péndulo (el centro de la cúpula abierta), en px del lienzo. */
const PIVOTE = { x: 40, y: 34 };
const TECLAS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);

export function iniciarPaseo(boton: HTMLAnchorElement, estudio: () => ControlEstudio | null, sala: () => ControlSala | null) {
  pieza('paseo', () => {
    let enCurso = false;
    boton.addEventListener(
      'click',
      (ev) => {
        const e = estudio();
        const s = sala();
        // Si el motor todavía no cargó, el enlace hace lo suyo y lleva a la sala.
        if (!e || !s) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (enCurso) return;
        enCurso = true;
        boton.setAttribute('aria-disabled', 'true');
        pasear(e, s)
          .catch((err) => {
            console.warn('[motion] paseo interrumpido tras un fallo', err);
            document.getElementById('sala')?.scrollIntoView();
            s.recibir();
          })
          .finally(() => {
            enCurso = false;
            boton.removeAttribute('aria-disabled');
          });
      },
      { capture: true },
    );
  });
}

async function pasear(estudio: ControlEstudio, sala: ControlSala) {
  const [{ PixelBuffer, hex }, { drawAvatar, poseRig, STAND }, { FACILITADOR }, ruta, pc] = await Promise.all([
    import('../pixel/buffer.ts'),
    import('../pixel/avatar.ts'),
    import('../pixel/escenas/estudio.ts'),
    import('../pixel/paseo.ts'),
    import('../pixel/paracaidas.ts'),
  ]);
  sala.esperar();
  const salida = await estudio.salir();

  // Personaje suelto: un lienzo fijo que se mueve con transform.
  const buf = new PixelBuffer(PW, PH);
  const lienzo = document.createElement('canvas');
  lienzo.width = PW;
  lienzo.height = PH;
  lienzo.setAttribute('aria-hidden', 'true');
  Object.assign(lienzo.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '40',
    pointerEvents: 'none',
    transformOrigin: `${(PIVOTE.x / PW) * 100}% ${(PIVOTE.y / PH) * 100}%`,
    willChange: 'transform',
    filter: 'drop-shadow(0 6px 8px rgb(15 24 29 / 0.35))',
  });
  document.body.appendChild(lienzo);
  const ctx = lienzo.getContext('2d')!;
  const imagen = new ImageData(new Uint8ClampedArray(buf.data.buffer as ArrayBuffer), PW, PH);
  const sombra = hex('#16303b', 80);

  const destino = sala.destino();
  const alto = innerHeight;
  const maximo = document.documentElement.scrollHeight - alto;
  const r = {
    desde: { x: salida.pies.x + scrollX, y: salida.pies.y + scrollY },
    hasta: destino.pies,
    scrollDesde: scrollY,
    scrollHasta: ruta.scrollFinal({ llegadaY: destino.pies.y, abajo: destino.abajo, arriba: destino.arriba, alto, maximo }),
    ancho: document.documentElement.clientWidth,
    escalaDesde: salida.escala,
    escalaHasta: destino.escala,
  };

  // La persona retoma el scroll cuando quiera.
  let libre = false;
  const soltar = () => (libre = true);
  const tecla = (ev: KeyboardEvent) => TECLAS.has(ev.key) && soltar();
  addEventListener('wheel', soltar, { passive: true });
  addEventListener('touchstart', soltar, { passive: true });
  addEventListener('keydown', tecla);

  await new Promise<void>((listo) => {
    let t = 0;
    let ultimo = performance.now();
    const cuadro = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      t += dt;
      const u = Math.min(1, t / ruta.DURACION);
      const p = ruta.enRuta(r, u);
      if (!libre) scrollAl(p.scroll);

      // Ya en el piso, el paracaídas termina de desinflarse antes de que la sala lo reciba.
      const piso = Math.max(0, t - ruta.DURACION) / ruta.PAUSA;
      const colapso = u < 1 ? p.colapso : 0.4 + 0.6 * Math.min(1, piso);
      const pose = p.fase === 'salto' ? pc.CAIDA : u > 0.975 ? (piso > 0.5 ? STAND : pc.ATERRIZA) : pc.poseColgado(t);
      const rig = poseRig(pose, PIES.x, PIES.y, p.mira);
      const manos = { x: (rig.handN.x + rig.handF.x) / 2, y: Math.min(rig.handN.y, rig.handF.y) };

      buf.clear();
      // Sombra en el piso solo al final: en el aire no hay piso debajo.
      if (u > 0.9) buf.ellipse(PIES.x, PIES.y + 1, 9 * Math.min(1, (u - 0.9) * 10), 3, sombra);
      pc.drawParacaidas(buf, manos, p.apertura, colapso, PIES.y);
      drawAvatar(buf, pose, FACILITADOR, PIES.x, PIES.y, p.mira, 'feliz');
      ctx.putImageData(imagen, 0, 0);

      const k = p.escala;
      lienzo.style.imageRendering = k >= 1.5 ? 'pixelated' : 'auto';
      lienzo.style.width = `${PW * k}px`;
      lienzo.style.height = `${PH * k}px`;
      lienzo.style.transform = `translate(${p.pies.x - scrollX - PIES.x * k}px, ${p.pies.y - scrollY - PIES.y * k}px) rotate(${p.angulo}deg)`;

      if (piso < 1) requestAnimationFrame(cuadro);
      else listo();
    };
    requestAnimationFrame(cuadro);
  }).finally(() => {
    removeEventListener('wheel', soltar);
    removeEventListener('touchstart', soltar);
    removeEventListener('keydown', tecla);
    lienzo.remove();
  });

  sala.recibir();
  document.getElementById('sala-t')?.focus({ preventScroll: true });
  // Para quien vuelva a subir: el estudio no se queda vacío.
  setTimeout(() => estudio.volver(), 1500);
}
