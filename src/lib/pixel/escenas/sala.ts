// Sala de la actividad: un equipo de cinco personas juega "dos verdades y una mentira" con el
// facilitador de Antídoto. Quien habla se para en el círculo y dice tres frases; los demás votan
// caminando a la baldosa del número que creen falso; se revela y celebran los que acertaron.
// El facilitador llega desde el hero (el paseo lo deja en la sala) o, si nadie tocó el botón,
// entra por la puerta cuando la sala asoma. Los textos los pone la página: la escena solo dice
// quién habla y qué línea toca. Sin DOM, corre también en Node.

import { PixelBuffer, hex } from '../buffer.ts';
import { STAND, drawAvatar, type Expression, type Look, type Pose } from '../avatar.ts';
import { Timeline, act, actorPose, poseTo, walkTo, type Actor } from '../actor.ts';
import type { Pt } from '../iso.ts';
import { C } from '../cuarto.ts';
import { FACILITADOR } from './estudio.ts';
import * as arte from './sala-arte.ts';

export interface RondaSala {
  /** Quién habla (1 a 5, índice de la persona). */
  hablante: number;
  /** Cuál de las tres frases es la mentira. */
  mentira: 0 | 1 | 2;
  /** Voto de cada uno de los otros cuatro, en el orden de las personas. */
  votos: (0 | 1 | 2)[];
}

export const RONDAS: RondaSala[] = [
  { hablante: 1, mentira: 2, votos: [2, 0, 2, 1] },
  { hablante: 2, mentira: 1, votos: [1, 1, 2, 1] },
];

/** Línea del guion: la página la cambia por el texto en su idioma. */
export type LineaSala = 'abre' | 'vota' | 'cierra' | `frases-${number}` | `revela-${number}`;

export interface EventosSala {
  di?: (quien: number, linea: LineaSala) => void;
  calla?: () => void;
}

const pose = (p: Partial<Pose>): Pose => ({ ...STAND, ...p });
const EXPLICA = pose({ armN: 70, foreN: 40, armF: 50, foreF: 30, headTilt: -4 });
const SENALA = pose({ armN: 96, foreN: 84, armF: -4, foreF: 6, headTilt: -6 });
const FESTEJA = pose({ armN: 160, foreN: 170, armF: 150, foreF: 165, headTilt: -8 });
const DUDA = pose({ armN: 40, foreN: 120, armF: 30, foreF: 110, headTilt: 10 });

const piel = [hex('#e8b48f'), hex('#8d5a3b'), hex('#c98d5f'), hex('#f0c9a5'), hex('#a8714a')];
const look = (o: Partial<Look> & { shirt: Look['shirt'] }, n: number): Look => ({
  shirtDark: o.shirt,
  shirtLine: o.shirt,
  pants: hex('#3c4f5a'),
  pantsDark: hex('#2c3a43'),
  skin: piel[n],
  skinDark: piel[n],
  hat: C.deep,
  hatDark: C.deepDark,
  band: C.ink,
  hair: hex('#2a1d17'),
  shoes: 'tenis',
  headwear: 'ninguno',
  mustache: false,
  pattern: 'liso',
  ...o,
});

function oscuro(c: number, k = 0.22) {
  const ch = (s: number) => Math.round(((c >>> s) & 255) * (1 - k));
  return ((255 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
}

function conSombras(l: Look): Look {
  return { ...l, shirtDark: oscuro(l.shirt), shirtLine: oscuro(l.shirt, 0.45), skinDark: oscuro(l.skin, 0.18) };
}

export const EQUIPO: Look[] = [
  conSombras(look({ shirt: C.yellow, hairStyle: 'suelto', hair: hex('#5a3a22') }, 0)),
  conSombras(look({ shirt: C.reto, mustache: true }, 1)),
  conSombras(look({ shirt: C.green, hairStyle: 'recogido' }, 2)),
  conSombras(look({ shirt: C.paper, headwear: 'gorra', hat: C.deep, hatDark: C.deepDark, band: C.antidote }, 3)),
  conSombras(look({ shirt: C.deep, pants: hex('#2c3e4a'), hair: hex('#1b1411') }, 4)),
];

/** Dónde espera cada quien mientras no juega (i, j), y hacia dónde mira. */
const CASA: { i: number; j: number; mira: 1 | -1 }[] = [
  { i: 12.4, j: 1.6, mira: -1 }, // facilitador, junto a la pantalla
  { i: 5.6, j: 3.4, mira: 1 },
  { i: 6.6, j: 4.6, mira: -1 },
  { i: 7.0, j: 2.8, mira: -1 },
  { i: 5.2, j: 4.8, mira: 1 },
  { i: 6.2, j: 5.5, mira: -1 },
];

/** Puerta (si entra solo) y punto del borde donde lo deja el paseo. */
const PUERTA = { i: 0.2, j: (arte.DOOR.j0 + arte.DOOR.j1) / 2 };
export const LLEGADA = { i: 14.6, j: 3.4 };

const VEL = 44;

interface Persona {
  a: Actor;
  look: Look;
  tl: Timeline;
  festeja: boolean;
}

/** Paso del director: corre `hacer` y espera `dur` segundos y, si hay, a que `hasta` se cumpla. */
interface Paso {
  hacer?: () => void;
  dur?: number;
  hasta?: () => boolean;
}

export class Sala {
  readonly width = arte.W;
  readonly height = arte.H;
  private fondo = new PixelBuffer(arte.W, arte.H);
  private gente: Persona[];
  private presente = false;
  private cola: Paso[] = [];
  private paso: Paso | null = null;
  private tPaso = 0;
  private t = 0;
  private pantalla = { encendida: false, revela: null as number | null };
  private eventos: EventosSala;

  constructor(eventos: EventosSala = {}) {
    this.eventos = eventos;
    arte.drawFondo(this.fondo);
    this.gente = [FACILITADOR, ...EQUIPO].map((l, n) => {
      const c = CASA[n];
      const p = arte.iso.P(c.i, c.j);
      return { a: { x: p.x, y: p.y, facing: c.mira, pose: STAND, expr: 'normal' as Expression, walking: false, walkPhase: 0, carrying: false }, look: l, tl: new Timeline(), festeja: false };
    });
  }

  get llego() {
    return this.presente;
  }

  /** Punto del piso donde el paseo deja al facilitador, en px del lienzo. */
  llegada(): Pt {
    return arte.iso.P(LLEGADA.i, LLEGADA.j);
  }

  /** Cabeza de una persona: ahí apunta la burbuja. */
  cabeza(quien: number): Pt {
    const a = this.gente[quien].a;
    return { x: a.x, y: a.y - 58 };
  }

  /** Llega el facilitador (desde el paseo, en el borde; o por la puerta) y arranca el juego. */
  llegar(desdeElPaseo: boolean) {
    if (this.presente) {
      // Ya había entrado por la puerta: el que baja con el paseo toma su lugar (no hay dos).
      if (!desdeElPaseo) return;
      const f = this.gente[0];
      const d = this.llegada();
      f.tl.clear();
      Object.assign(f.a, { x: d.x, y: d.y, facing: -1, walking: false, pose: STAND });
      this.irA(0, CASA[0].i, CASA[0].j, CASA[0].mira);
      return;
    }
    this.presente = true;
    const f = this.gente[0];
    const d = desdeElPaseo ? this.llegada() : arte.iso.P(PUERTA.i, PUERTA.j);
    f.a.x = d.x;
    f.a.y = d.y;
    f.a.facing = -1;
    this.irA(0, CASA[0].i, CASA[0].j, CASA[0].mira);
    // El equipo lo saluda.
    for (let n = 1; n < 6; n++) this.gente[n].tl.push(poseTo(this.gente[n].a, SENALA, 0.3, 'feliz'), { dur: 1.2 }, poseTo(this.gente[n].a, STAND, 0.3, 'normal'));
    this.push({ hasta: () => this.quietos() });
    this.jugar();
  }

  /** Estado del PNG quieto: la primera ronda, todos votaron y se revela la mentira. */
  cuadroQuieto(): { quien: number; linea: LineaSala } {
    this.presente = true;
    const r = RONDAS[0];
    const ponerEn = (n: number, i: number, j: number, mira: 1 | -1) => {
      const p = arte.iso.P(i, j);
      Object.assign(this.gente[n].a, { x: p.x, y: p.y, facing: mira });
    };
    ponerEn(0, CASA[0].i, CASA[0].j, -1);
    ponerEn(r.hablante, arte.CIRCULO.i, arte.CIRCULO.j, 1);
    this.gente[r.hablante].a.pose = EXPLICA;
    this.gente[r.hablante].a.expr = 'feliz';
    this.votantes(r).forEach(({ n, voto, k }) => {
      const v = this.puesto(voto, k);
      ponerEn(n, v.i, v.j, -1);
      const acierta = voto === r.mentira;
      this.gente[n].a.pose = acierta ? FESTEJA : DUDA;
      this.gente[n].a.expr = acierta ? 'feliz' : 'normal';
    });
    this.pantalla = { encendida: true, revela: r.mentira };
    return { quien: r.hablante, linea: 'revela-0' };
  }

  private quietos() {
    return this.gente.every((p) => !p.tl.busy);
  }

  private push(...p: Paso[]) {
    this.cola.push(...p);
  }

  private irA(n: number, i: number, j: number, mira: 1 | -1, final: Pose = STAND, expr: Expression = 'normal') {
    const p = this.gente[n];
    const q = arte.iso.P(i, j);
    p.tl.push(poseTo(p.a, STAND, 0.2), walkTo(p.a, q.x, q.y, VEL), act(() => (p.a.facing = mira)), poseTo(p.a, final, 0.3, expr));
  }

  private di(quien: number, linea: LineaSala, dur: number): Paso[] {
    return [{ hacer: () => this.eventos.di?.(quien, linea), dur }, { hacer: () => this.eventos.calla?.(), dur: 0.35 }];
  }

  private votantes(r: RondaSala) {
    const cuenta = [0, 0, 0];
    return [1, 2, 3, 4, 5].filter((n) => n !== r.hablante).map((n, idx) => {
      const voto = r.votos[idx];
      return { n, voto, k: cuenta[voto]++ };
    });
  }

  /** Lugar de la persona k sobre la baldosa de un voto (hasta cuatro, en rombo). */
  private puesto(voto: number, k: number) {
    const v = arte.VOTOS[voto];
    const off = [[0.4, -0.4], [-0.4, 0.4], [0.45, 0.45], [-0.45, -0.45]][k % 4];
    return { i: v.i + off[0], j: v.j + off[1] };
  }

  /** Las dos rondas y el cierre; al terminar vuelve a empezar. */
  private jugar() {
    RONDAS.forEach((r, ri) => {
      const h = r.hablante;
      this.push({
        hacer: () => {
          this.pantalla = { encendida: true, revela: null };
          this.irA(h, arte.CIRCULO.i, arte.CIRCULO.j, 1, EXPLICA, 'feliz');
        },
        hasta: () => this.quietos(),
      });
      if (ri === 0) this.push({ hacer: () => (this.gente[0].a.pose = SENALA) }, ...this.di(0, 'abre', 3.4));
      this.push(...this.di(h, `frases-${ri}`, 7));
      this.push({ hacer: () => (this.gente[0].a.pose = SENALA) }, ...this.di(0, 'vota', 2.8));
      this.push({
        hacer: () => {
          this.gente[0].a.pose = STAND;
          this.votantes(r).forEach(({ n, voto, k }, idx) => {
            const v = this.puesto(voto, k);
            this.gente[n].tl.push({ dur: idx * 0.25 });
            this.irA(n, v.i, v.j, -1);
          });
        },
        hasta: () => this.quietos(),
      });
      this.push({ dur: 0.6 });
      this.push(
        {
          hacer: () => {
            this.pantalla.revela = r.mentira;
            this.votantes(r).forEach(({ n, voto }) => {
              const p = this.gente[n];
              const acierta = voto === r.mentira;
              p.festeja = acierta;
              p.tl.push(poseTo(p.a, acierta ? FESTEJA : DUDA, 0.3, acierta ? 'feliz' : 'normal'));
            });
          },
        },
        ...this.di(h, `revela-${ri}`, 4.6),
      );
      this.push({
        hacer: () => {
          this.pantalla = { encendida: false, revela: null };
          for (let n = 1; n < 6; n++) {
            this.gente[n].festeja = false;
            this.irA(n, CASA[n].i, CASA[n].j, CASA[n].mira);
          }
        },
        hasta: () => this.quietos(),
      });
    });
    this.push({ hacer: () => (this.gente[0].a.pose = SENALA) }, ...this.di(0, 'cierra', 4.4), { hacer: () => (this.gente[0].a.pose = STAND), dur: 1.5 });
    this.push({ hacer: () => this.jugar() });
  }

  update(dt: number) {
    this.t += dt;
    for (const p of this.gente) p.tl.update(dt);
    for (let guarda = 0; guarda < 20; guarda++) {
      if (!this.paso) {
        const sig = this.cola.shift();
        if (!sig) break;
        this.paso = sig;
        this.tPaso = 0;
        sig.hacer?.();
      }
      this.tPaso += guarda === 0 ? dt : 0;
      const listo = this.tPaso >= (this.paso.dur ?? 0) && (this.paso.hasta?.() ?? true);
      if (!listo) break;
      this.paso = null;
    }
  }

  render(out: PixelBuffer) {
    out.data.set(this.fondo.data);
    arte.drawPantalla(out, { ...this.pantalla, t: this.t });
    const capas: [number, () => void][] = arte.PLANTAS.map((p) => [p.i + p.j + 0.25, () => arte.drawPlanta(out, p.i, p.j)]);
    this.gente.forEach((p, n) => {
      if (n === 0 && !this.presente) return;
      const { i, j } = arte.iso.floorAt(p.a.x, p.a.y);
      capas.push([
        i + j,
        () => {
          const salto = p.festeja ? Math.round(Math.abs(Math.sin(this.t * 7 + n)) * 4) : 0;
          const respira = !p.a.walking && !p.festeja && Math.sin(this.t * 2.2 + n * 1.7) > 0.6 ? 1 : 0;
          out.shadow(p.a.x, p.a.y + 1, 9 - salto / 2, 3, C.shadow, 0.3);
          drawAvatar(out, { ...actorPose(p.a), bob: respira }, p.look, p.a.x, p.a.y - salto, p.a.facing, p.a.expr);
        },
      ]);
    });
    capas.sort((a, b) => a[0] - b[0]).forEach(([, dibujar]) => dibujar());
  }
}
