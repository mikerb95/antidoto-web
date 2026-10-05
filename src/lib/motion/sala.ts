// Sala de la actividad (Sala.astro): cambia el PNG quieto por el lienzo animado y pone en
// burbujas lo que dice cada quien. El facilitador llega con el paseo desde el hero; si la sala
// asoma sin que nadie haya tocado el botón, entra solo por la puerta. Es un bucle: tiene su botón
// de pausa y se detiene fuera de pantalla. Con movimiento reducido no corre (queda el PNG).
import { pieza } from './core';
import { crearBurbuja, crearLienzo } from './lienzo';
import type { Pt } from '../pixel/iso';

/** Lo que el paseo necesita de la sala. */
export interface ControlSala {
  /**
   * Dónde debe pisar el facilitador al llegar, en px del documento, y la escala del pixel. `abajo`
   * es el borde inferior del lienzo y `arriba` el de la sección, para encuadrar la llegada.
   */
  destino(): { pies: Pt; escala: number; abajo: number; arriba: number };
  /** El paseo ya salió: la sala no lo hace entrar por la puerta. */
  esperar(): void;
  /** El facilitador llegó al borde de la sala: desde aquí lo dibuja la escena. */
  recibir(): void;
}

export function iniciarSala(raiz: HTMLElement, alListo?: (c: ControlSala) => void) {
  const ventana = raiz.querySelector<HTMLElement>('[data-sala-ventana]');
  const lienzo = raiz.querySelector<HTMLCanvasElement>('[data-sala-lienzo]');
  const poster = raiz.querySelector<HTMLImageElement>('[data-sala-poster]');
  const boton = raiz.querySelector<HTMLButtonElement>('[data-sala-pausa]');
  if (!ventana || !lienzo || !poster) return;
  const lineas = JSON.parse(ventana.dataset.lineas ?? '{}') as Record<string, string>;
  const restaurar = () => {
    lienzo.hidden = true;
    poster.style.opacity = '';
    raiz.querySelector('[data-burbuja]')?.classList.remove('oculta');
  };

  pieza(
    'sala',
    () => {
      const arrancar = async () => {
        const [{ PixelBuffer }, { Sala }] = await Promise.all([import('../pixel/buffer.ts'), import('../pixel/escenas/sala.ts')]);
        const burbuja = crearBurbuja(raiz, ventana);
        let k = 1;
        const sala = new Sala({
          di: (quien, linea) => burbuja.mostrar(lineas[linea] ?? '', sala.cabeza(quien), lz.escala()),
          calla: () => burbuja.ocultar(),
        });
        const lz = crearLienzo({ lienzo, ventana, buf: new PixelBuffer(sala.width, sala.height), escena: sala, alAjustar: () => burbuja.recolocar() });
        burbuja.ocultar();
        lz.pintar();
        lienzo.hidden = false;
        poster.style.opacity = '0';
        k = lz.escala();

        // Pausa propia: la sala es un bucle de más de 5 s.
        if (boton) {
          boton.hidden = false;
          boton.addEventListener('click', () => {
            const pausado = boton.getAttribute('aria-pressed') !== 'true';
            boton.setAttribute('aria-pressed', String(pausado));
            boton.title = (pausado ? boton.dataset.reanudar : boton.dataset.pausar) ?? '';
            lz.set('pausado', pausado);
          });
        }

        // Si la sala asoma sin paseo en camino, el facilitador entra por la puerta.
        let enCamino = false;
        const io = new IntersectionObserver(
          ([e]) => {
            if (!e.isIntersecting || enCamino || sala.llego) return;
            io.disconnect();
            sala.llegar(false);
          },
          { threshold: 0.45 },
        );
        io.observe(lienzo);

        alListo?.({
          destino: () => {
            k = lz.escala();
            const p = lz.enPantalla(sala.llegada());
            const b = lienzo.getBoundingClientRect();
            const t = raiz.getBoundingClientRect();
            return { pies: { x: p.x + scrollX, y: p.y + scrollY }, escala: k, abajo: b.bottom + scrollY, arriba: t.top + scrollY };
          },
          esperar: () => {
            enCamino = true;
          },
          recibir: () => {
            io.disconnect();
            sala.llegar(true);
            lz.pintar();
          },
        });
      };
      const cargar = () =>
        arrancar().catch((err) => {
          console.warn('[motion] sala deshabilitada tras un fallo', err);
          restaurar();
        });
      if (document.readyState === 'complete') cargar();
      else addEventListener('load', cargar, { once: true });
    },
    restaurar,
  );
}
