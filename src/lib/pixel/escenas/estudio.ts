// El estudio de Antídoto que se ve desde el hero. El facilitador recorre el cuarto y se para
// junto al guiño de cada línea para hablar de ella (las burbujas son HTML, ver
// src/lib/motion/estudio.ts). Al tocar el botón del hero camina al borde del piso y salta fuera
// del recuadro: desde ahí lo lleva el paseo por la página. Sin DOM, corre también en Node.

import { PixelBuffer, hex } from '../buffer.ts';
import { STAND, drawAvatar, type Look, type Pose } from '../avatar.ts';
import { Timeline, act, actorPose, poseTo, wait, walkTo, type Actor } from '../actor.ts';
import type { Pt } from '../iso.ts';
import { C } from '../cuarto.ts';
import * as arte from './estudio-arte.ts';

export const FACILITADOR: Look = {
  shirt: C.antidote,
  shirtDark: C.mid,
  shirtLine: C.deep,
  pants: hex('#2c3e4a'),
  pantsDark: hex('#1f2d36'),
  skin: hex('#b97c52'),
  skinDark: hex('#96603b'),
  hat: C.ink,
  hatDark: C.ink,
  band: C.ink,
  hair: hex('#2a1d17'),
  shoes: 'tenis',
  headwear: 'ninguno',
  mustache: false,
  pattern: 'liso',
};

const pose = (p: Partial<Pose>): Pose => ({ ...STAND, ...p });
const SENALA = pose({ armN: 96, foreN: 84, armF: -4, foreF: 6, headTilt: -6 });
const SALUDA = pose({ armN: 150, foreN: 150, armF: -6, foreF: 4 });
const AGACHA = pose({ lean: 10, thighN: 50, shinN: -30, thighF: 30, shinF: -40, armN: 30, foreN: 40, armF: 20, foreF: 30 });
const SALTO = pose({ lean: 6, thighN: 40, shinN: -50, thighF: -20, shinF: -30, armN: 150, foreN: 170, armF: 140, foreF: 160 });

/** Dónde se para el facilitador para hablar de cada línea (clave del servicio) y hacia dónde mira. */
export const PUNTOS: Record<string, { i: number; j: number; mira: 1 | -1 }> = {
  formaciones: { i: 3.0, j: 0.9, mira: -1 },
  ia: { i: 3.7, j: 1.7, mira: 1 },
  audiovisual: { i: 4.7, j: 3.5, mira: 1 },
  catering: { i: 4.0, j: 4.9, mira: -1 },
  diseno: { i: 2.0, j: 1.8, mira: -1 },
  centro: { i: 3.6, j: 2.8, mira: -1 },
};

/** Borde del piso por donde sale y punto de entrada por la puerta. */
const BORDE = { i: 6.4, j: 5.6 };
const PUERTA = { i: 0.2, j: (arte.DOOR.j0 + arte.DOOR.j1) / 2 };

const VELOCIDAD = 46;

export interface EventosEstudio {
  /** El facilitador saltó fuera del cuarto desde este punto del lienzo (los pies). */
  salio?: (pies: Pt, mira: 1 | -1) => void;
}

export class Estudio {
  readonly width = arte.W;
  readonly height = arte.H;
  private fondo = new PixelBuffer(arte.W, arte.H);
  private tl = new Timeline();
  private t = 0;
  private dentro = true;
  private a: Actor;
  private eventos: EventosEstudio;

  constructor(eventos: EventosEstudio = {}) {
    this.eventos = eventos;
    arte.drawFondo(this.fondo);
    const p = arte.iso.P(PUNTOS.centro.i, PUNTOS.centro.j);
    this.a = { x: p.x, y: p.y, facing: -1, pose: SALUDA, expr: 'feliz', walking: false, walkPhase: 0, carrying: false };
  }

  get busy() {
    return this.tl.busy;
  }

  get visible() {
    return this.dentro;
  }

  /** Camina hasta el guiño de una línea, se vuelve hacia él y lo señala. */
  ir(clave: string, alLlegar?: () => void) {
    const p = PUNTOS[clave] ?? PUNTOS.centro;
    const q = arte.iso.P(p.i, p.j);
    this.tl.clear();
    this.tl.push(
      poseTo(this.a, STAND, 0.25, 'normal'),
      walkTo(this.a, q.x, q.y, VELOCIDAD),
      act(() => (this.a.facing = p.mira)),
      poseTo(this.a, clave === 'centro' ? SALUDA : SENALA, 0.35, 'feliz'),
      act(() => alLlegar?.()),
    );
  }

  /** Camina al borde del piso, toma impulso y salta fuera del recuadro. */
  salir() {
    const b = arte.iso.P(BORDE.i, BORDE.j);
    this.tl.clear();
    this.tl.push(
      poseTo(this.a, STAND, 0.2, 'feliz'),
      walkTo(this.a, b.x, b.y, VELOCIDAD),
      act(() => (this.a.facing = 1)),
      poseTo(this.a, AGACHA, 0.18),
      poseTo(this.a, SALTO, 0.12),
      act(() => {
        this.dentro = false;
        this.eventos.salio?.({ x: this.a.x, y: this.a.y }, 1);
      }),
    );
  }

  /** Vuelve a entrar por la puerta (después del paseo, para quien suba de nuevo). */
  volver(alLlegar?: () => void) {
    const d = arte.iso.P(PUERTA.i, PUERTA.j);
    const c = arte.iso.P(PUNTOS.centro.i, PUNTOS.centro.j);
    this.tl.clear();
    this.tl.push(
      act(() => {
        this.a.x = d.x;
        this.a.y = d.y;
        this.a.pose = STAND;
        this.a.expr = 'normal';
        this.dentro = true;
      }),
      walkTo(this.a, c.x, c.y, VELOCIDAD),
      act(() => (this.a.facing = -1)),
      poseTo(this.a, SALUDA, 0.35, 'feliz'),
      wait(0.6),
      act(() => alLlegar?.()),
    );
  }

  update(dt: number) {
    this.t += dt;
    this.tl.update(dt);
    // Respira mientras está quieto.
    if (!this.a.walking && !this.tl.busy) this.a.pose = { ...this.a.pose, bob: Math.sin(this.t * 2.2) > 0.6 ? 1 : 0 };
  }

  /** Cabeza del facilitador: ahí apunta la burbuja. */
  speaker(): Pt {
    return { x: this.a.x, y: this.a.y - 58 };
  }

  render(out: PixelBuffer) {
    out.data.set(this.fondo.data);
    arte.drawVivo(out, this.t);

    // Orden por profundidad: lo que está más adelante (i + j mayor) se pinta después.
    const { i, j } = arte.iso.floorAt(this.a.x, this.a.y);
    const prof = i + j;
    const p = arte.PIEZAS;
    const capas: [number, () => void][] = [
      [p.luz.i + p.luz.j, () => arte.drawLuz(out)],
      [p.mesa.i + p.mesa.di + p.mesa.j, () => arte.drawMesa(out)],
      [p.camara.i + p.camara.j + 0.3, () => arte.drawCamara(out)],
      [p.planta.i + p.planta.j + 0.25, () => arte.drawPlanta(out)],
    ];
    if (this.dentro) {
      capas.push([
        prof,
        () => {
          out.shadow(this.a.x, this.a.y + 1, 9, 3, C.shadow, 0.3);
          drawAvatar(out, actorPose(this.a), FACILITADOR, this.a.x, this.a.y, this.a.facing, this.a.expr);
        },
      ]);
    }
    capas.sort((x, y) => x[0] - y[0]).forEach(([, dibujar]) => dibujar());
  }
}
