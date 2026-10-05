// Estudio pixel del hero (Estudio.astro): carga el motor después de `load`, cambia el PNG quieto
// por el lienzo animado y lleva el guion de burbujas: el facilitador camina al guiño de cada
// línea, habla y sigue con la siguiente. Es un bucle: se detiene fuera de pantalla, con la pestaña
// oculta y con el botón de pausa del hero; la rotación de burbujas espera mientras el cursor o el
// foco están en la ventana. Con movimiento reducido no corre (queda el PNG con la bienvenida).
import { pieza } from './core';
import { conPausa, crearBurbuja, crearLienzo } from './lienzo';
import type { Pt } from '../pixel/iso';
import type { Hablante } from './pregunta';

interface Linea {
  punto: string;
  texto: string;
  href?: string;
}

interface Guion {
  hola: string;
  frases: { clave: string; texto: string; href: string }[];
  cierre: string;
}

/** Lo que el paseo necesita del estudio. */
export interface ControlEstudio {
  /** El facilitador sale del cuarto; resuelve con sus pies en px de la ventana y la escala del pixel. */
  salir(): Promise<{ pies: Pt; escala: number }>;
  /** Vuelve a entrar por la puerta y retoma el guion. */
  volver(): void;
  /** El facilitador como asesor: responde lo que le pregunten (src/lib/motion/pregunta.ts). */
  hablante: Hablante;
}

const duracion = (texto: string) => Math.min(7, Math.max(3.5, texto.length / 14));

export function iniciarEstudio(raiz: HTMLElement, alListo?: (c: ControlEstudio) => void) {
  const ventana = raiz.querySelector<HTMLElement>('[data-estudio-ventana]');
  const lienzo = raiz.querySelector<HTMLCanvasElement>('[data-estudio-lienzo]');
  const poster = raiz.querySelector<HTMLImageElement>('[data-estudio-poster]');
  if (!ventana || !lienzo || !poster) return;
  const guion = JSON.parse(ventana.dataset.guion ?? '{}') as Guion;
  const lineas: Linea[] = [
    { punto: 'centro', texto: guion.hola },
    ...guion.frases.map((f) => ({ punto: f.clave, texto: f.texto, href: f.href })),
    { punto: 'centro', texto: guion.cierre },
  ];
  const restaurar = () => {
    lienzo.hidden = true;
    poster.style.opacity = '';
    raiz.querySelector('[data-burbuja]')?.classList.remove('oculta');
  };

  pieza(
    'estudio',
    () => {
      const arrancar = async () => {
        const [{ PixelBuffer }, { Estudio }] = await Promise.all([import('../pixel/buffer.ts'), import('../pixel/escenas/estudio.ts')]);
        let alSalir: ((p: Pt) => void) | null = null;
        const escena = new Estudio({ salio: (p) => alSalir?.(p) });
        escena.update(0.5);
        const burbuja = crearBurbuja(raiz, ventana);

        // Guion: la bienvenida ya está en pantalla (es la del PNG); después, una línea tras otra.
        let idx = 1;
        let hablando = duracion(guion.hola);
        let modo: 'guion' | 'paseo' | 'charla' = 'guion';
        let retenido = false;
        const siguiente = () => {
          burbuja.ocultar();
          const l = lineas[idx];
          idx = (idx + 1) % lineas.length;
          escena.ir(l.punto, () => {
            burbuja.mostrar(l.texto, escena.speaker(), lz.escala(), l.href);
            hablando = duracion(l.texto);
          });
        };
        const lz = crearLienzo({
          lienzo,
          ventana,
          buf: new PixelBuffer(escena.width, escena.height),
          escena,
          alCuadro: (dt) => {
            // Conversando, la burbuja sigue la cabeza (puede estar volviendo a su sitio).
            if (modo === 'charla') burbuja.mover(escena.speaker(), lz.escala());
            if (modo !== 'guion' || hablando <= 0 || retenido) return;
            hablando -= dt;
            if (hablando <= 0) siguiente();
          },
          alAjustar: () => burbuja.recolocar(),
        });
        burbuja.mover(escena.speaker(), lz.escala());

        const retener = () => (retenido = ventana.matches(':hover, :focus-within'));
        ventana.addEventListener('pointerenter', () => (retenido = true));
        ventana.addEventListener('pointerleave', retener);
        ventana.addEventListener('focusin', () => (retenido = true));
        ventana.addEventListener('focusout', () => setTimeout(retener));

        lz.pintar();
        lienzo.hidden = false;
        poster.style.opacity = '0';
        conPausa(lz);

        alListo?.({
          salir: () =>
            new Promise((resolver) => {
              modo = 'paseo';
              burbuja.ocultar();
              lz.set('forzado', true);
              alSalir = (p) => {
                alSalir = null;
                lz.set('forzado', false);
                resolver({ pies: lz.enPantalla(p), escala: lz.escala() });
              };
              escena.salir();
            }),
          volver: () => {
            if (modo === 'charla') return;
            escena.volver(() => {
              modo = 'guion';
              idx = 1;
              hablando = 0.01;
            });
          },
          hablante: {
            pensar: (t) => {
              modo = 'charla';
              escena.atender();
              burbuja.mostrar(t, escena.speaker(), lz.escala());
              lz.pintar();
            },
            decir: (t, acciones) => {
              escena.responder();
              burbuja.mostrar(t, escena.speaker(), lz.escala(), undefined, acciones);
            },
            soltar: () => {
              if (modo !== 'charla') return;
              burbuja.ocultar();
              modo = 'guion';
              hablando = 0.01;
            },
          },
        });
      };
      const cargar = () =>
        arrancar().catch((err) => {
          // Fail-open: queda el PNG quieto con su burbuja.
          console.warn('[motion] estudio deshabilitado tras un fallo', err);
          restaurar();
        });
      if (document.readyState === 'complete') cargar();
      else addEventListener('load', cargar, { once: true });
    },
    restaurar,
  );
}
