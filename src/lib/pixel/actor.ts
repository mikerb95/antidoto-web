// Copiado de la plataforma de misiones (../antidoto), como buffer.ts.
//
// Personaje y línea de tiempo para coreografiar las escenas: caminar hasta un punto,
// pasar de una postura a otra, esperar, decir algo. Sin DOM: la escena avanza con
// update(dt) y se dibuja aparte, así también corre en Node para las capturas.

import { walkPose, type Expression, type Pose } from "./avatar.ts";

export interface Actor {
  x: number;
  y: number;
  facing: 1 | -1;
  pose: Pose;
  expr: Expression;
  walking: boolean;
  walkPhase: number;
  /** Mientras camina cargando algo, los brazos no se balancean. */
  carrying: boolean;
}

/** Pose que se dibuja este cuadro: la base más el ciclo de caminar si va andando. */
export function actorPose(a: Actor): Pose {
  return a.walking ? walkPose(a.pose, a.walkPhase, a.carrying ? 0.6 : 1, !a.carrying) : a.pose;
}

export interface Step {
  dur: number;
  start?: () => void;
  tick?: (t: number) => void;
  end?: () => void;
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class Timeline {
  private queue: Step[] = [];
  private current: Step | null = null;
  private elapsed = 0;

  get busy() {
    return this.current !== null || this.queue.length > 0;
  }

  push(...steps: Step[]) {
    this.queue.push(...steps);
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.elapsed = 0;
  }

  update(dt: number) {
    let budget = dt;
    // Varios pasos de duración cero pueden correr en el mismo cuadro.
    for (let guard = 0; guard < 50; guard++) {
      if (!this.current) {
        const next = this.queue.shift();
        if (!next) return;
        this.current = next;
        this.elapsed = 0;
        next.start?.();
      }
      const step = this.current;
      const room = step.dur - this.elapsed;
      const used = Math.min(room, budget);
      this.elapsed += used;
      budget -= used;
      step.tick?.(step.dur > 0 ? this.elapsed / step.dur : 1);
      if (this.elapsed >= step.dur) {
        step.end?.();
        this.current = null;
        if (budget <= 0 && step.dur > 0) return;
      } else {
        return;
      }
    }
  }
}

export function wait(dur: number): Step {
  return { dur };
}

export function act(fn: () => void): Step {
  return { dur: 0, start: fn };
}

export function poseTo(actor: Actor, target: Pose, dur: number, expr?: Expression): Step {
  let from: Pose = actor.pose;
  return {
    dur,
    start: () => {
      from = { ...actor.pose };
      if (expr) actor.expr = expr;
    },
    tick: (t) => {
      const k = easeInOut(t);
      const out = {} as Pose;
      for (const key of Object.keys(from) as (keyof Pose)[]) out[key] = from[key] + (target[key] - from[key]) * k;
      actor.pose = out;
    },
  };
}

/** Largo de un paso completo (dos pisadas) en píxeles. */
const STRIDE_PX = 22;

export function walkTo(actor: Actor, x: number, y: number, speed: number): Step {
  let fromX = actor.x;
  let fromY = actor.y;
  let dist = 1;
  const step: Step = {
    dur: 1,
    start: () => {
      fromX = actor.x;
      fromY = actor.y;
      dist = Math.hypot(x - fromX, y - fromY);
      step.dur = Math.max(0.05, dist / speed);
      if (Math.abs(x - fromX) > 0.5) actor.facing = x > fromX ? 1 : -1;
      actor.walking = true;
    },
    tick: (t) => {
      actor.x = fromX + (x - fromX) * t;
      actor.y = fromY + (y - fromY) * t;
      actor.walkPhase = (t * dist) / STRIDE_PX;
    },
    end: () => {
      actor.walking = false;
      actor.walkPhase = 0;
    },
  };
  return step;
}
