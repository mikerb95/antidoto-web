// Lienzo de una escena pixel (estudio del hero y sala de la actividad): vuelca el PixelBuffer al
// canvas y corre el bucle a 30 cuadros por segundo, el ritmo de la plataforma de misiones.
// El bucle solo corre en pantalla, con la pestaña visible y sin pausa; `forzado` lo mantiene
// andando mientras la persona sigue algo que pidió (el facilitador saliendo del cuarto).
import { soloVisible } from './core';
import type { PixelBuffer } from '../pixel/buffer';
import type { Pt } from '../pixel/iso';

const FRAME = 1 / 30;
/** Bajo esta escala el pixel duro se come líneas de 1 px: se dibuja al doble y el navegador suaviza. */
const ESCALA_DURA = 1.5;

export interface Escena {
  readonly width: number;
  readonly height: number;
  update(dt: number): void;
  render(out: PixelBuffer): void;
}

export interface Lienzo {
  /** Píxeles de pantalla por píxel de la escena. */
  escala(): number;
  /** Un punto de la escena en px de la ventana del navegador. */
  enPantalla(p: Pt): Pt;
  pintar(): void;
  set(razon: 'pausado' | 'forzado', v: boolean): void;
}

export function crearLienzo(o: {
  lienzo: HTMLCanvasElement;
  ventana: HTMLElement;
  buf: PixelBuffer;
  escena: Escena;
  /** Después de cada update (el guion de burbujas). */
  alCuadro?: (dt: number) => void;
  alAjustar?: () => void;
}): Lienzo {
  const { lienzo, ventana, buf, escena } = o;
  const W = escena.width;
  const H = escena.height;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('sin canvas 2D');

  let doble = false;
  let grande: Uint32Array | null = null;
  let imagen: ImageData | null = null;
  const escala = () => lienzo.getBoundingClientRect().width / W || ventana.clientWidth / W;
  const ajustar = () => {
    const d = escala() < ESCALA_DURA;
    if (imagen && d === doble) return;
    doble = d;
    lienzo.width = W * (doble ? 2 : 1);
    lienzo.height = H * (doble ? 2 : 1);
    lienzo.style.imageRendering = doble ? 'auto' : 'pixelated';
    grande = doble ? new Uint32Array(W * H * 4) : null;
    imagen = new ImageData(new Uint8ClampedArray((grande ?? buf.data).buffer as ArrayBuffer), lienzo.width, lienzo.height);
  };
  const pintar = () => {
    buf.clear();
    escena.render(buf);
    if (grande) {
      const src = buf.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = src[y * W + x];
          const i = y * 4 * W + x * 2;
          grande[i] = grande[i + 1] = grande[i + 2 * W] = grande[i + 2 * W + 1] = c;
        }
      }
    }
    ctx.putImageData(imagen!, 0, 0);
  };
  ajustar();
  new ResizeObserver(() => {
    ajustar();
    o.alAjustar?.();
  }).observe(ventana);

  const r = { visible: false, pausado: false, forzado: false };
  let raf = 0;
  let ultimo = 0;
  let acc = 0;
  const cuadro = (ahora: number) => {
    const dt = Math.min(0.1, (ahora - ultimo) / 1000);
    ultimo = ahora;
    acc += dt;
    if (acc >= FRAME) {
      escena.update(acc);
      o.alCuadro?.(acc);
      acc = 0;
      pintar();
    }
    raf = requestAnimationFrame(cuadro);
  };
  const aplicar = () => {
    const correr = r.forzado || (r.visible && !r.pausado);
    if (correr && !raf) {
      ultimo = performance.now();
      raf = requestAnimationFrame(cuadro);
    } else if (!correr && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  soloVisible(ventana, {
    play: () => {
      r.visible = true;
      aplicar();
    },
    pause: () => {
      r.visible = false;
      aplicar();
    },
  });

  return {
    escala,
    enPantalla: (p) => {
      const b = lienzo.getBoundingClientRect();
      const k = b.width / W;
      return { x: b.left + p.x * k, y: b.top + p.y * k };
    },
    pintar,
    set: (razon, v) => {
      r[razon] = v;
      aplicar();
    },
  };
}

/** El botón de pausa del hero detiene también las escenas pixel. */
export function conPausa(l: Lienzo) {
  const pausa = document.querySelector<HTMLButtonElement>('[data-escena-pausa]');
  pausa?.addEventListener('click', () => l.set('pausado', pausa.getAttribute('aria-pressed') === 'true'));
}

/**
 * Burbuja de chat (.burbuja-pixel) sobre la cabeza del que habla, recortada dentro de la ventana y
 * con la punta en su sitio aunque la caja se corra.
 */
export function crearBurbuja(raiz: HTMLElement, ventana: HTMLElement) {
  const el = raiz.querySelector<HTMLElement>('[data-burbuja]');
  const texto = raiz.querySelector<HTMLElement>('[data-burbuja-texto]');
  const enlace = raiz.querySelector<HTMLAnchorElement>('[data-burbuja-enlace]');
  if (!el || !texto) throw new Error('falta la burbuja');
  let ultimo: { p: Pt; k: number } | null = null;
  const colocar = (p: Pt, k: number) => {
    ultimo = { p, k };
    // Medidas en el sistema del contenedor de la burbuja; el recorte, contra lo que se ve (en la
    // sala de celular el lienzo es más ancho que la pantalla).
    const padre = (el.offsetParent as HTMLElement | null) ?? ventana;
    const pb = padre.getBoundingClientRect();
    const lb = (padre.querySelector('canvas:not([hidden])') ?? padre.querySelector('img'))?.getBoundingClientRect() ?? pb;
    const vb = ventana.getBoundingClientRect();
    const x = lb.left - pb.left + p.x * k;
    const w = el.offsetWidth;
    const cx = Math.min(Math.max(x, vb.left - pb.left + w / 2 + 6), vb.right - pb.left - w / 2 - 6);
    el.style.setProperty('--x', `${cx}px`);
    el.style.setProperty('--y', `${lb.top - pb.top + p.y * k}px`);
    el.style.setProperty('--cola', `calc(50% + ${x - cx}px)`);
  };
  return {
    mostrar(t: string, p: Pt, k: number, href?: string) {
      texto.textContent = t;
      if (enlace) {
        enlace.hidden = !href;
        if (href) enlace.href = href;
      }
      el.classList.remove('oculta');
      colocar(p, k);
    },
    mover: colocar,
    recolocar() {
      if (ultimo) colocar(ultimo.p, ultimo.k);
    },
    ocultar() {
      el.classList.add('oculta');
    },
  };
}
