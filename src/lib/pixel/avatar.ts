// Copiado de la plataforma de misiones (../antidoto), como buffer.ts. Aquí suma la camisa lisa
// y los tenis para el facilitador del estudio.
//
// Avatar estilo Habbo con esqueleto posable. Habbo solo tiene poses fijas (de pie,
// caminar, sentarse, llevar algo); aquí cada articulación tiene ángulo propio para poder
// mostrar una espalda doblada o una sentadilla y pasar de una a otra interpolando.
// Las proporciones siguen a Habbo: cabeza grande (un tercio de la altura) y cuerpo corto.

import { CLEAR, hex, type Color, type PixelBuffer } from "./buffer.ts";

/**
 * Ángulos en grados. Piernas y brazos se miden desde la vertical hacia abajo; el torso
 * desde la vertical hacia arriba. Positivo = hacia donde mira el personaje.
 */
export interface Pose {
  lean: number;
  thighN: number;
  shinN: number;
  thighF: number;
  shinF: number;
  armN: number;
  foreN: number;
  armF: number;
  foreF: number;
  /** Positivo = mira hacia abajo. */
  headTilt: number;
  /** Adelanta la cabeza respecto al cuello (cuello forzado), en px. */
  headPush: number;
  /** 0 = todo el cuerpo mira igual; 1 = el tronco giró hacia el lado contrario de las piernas. */
  twist: number;
  /** Baja todo el cuerpo unos px (respiración, rebote del paso). */
  bob: number;
}

export type Expression = "normal" | "esfuerzo" | "feliz" | "sueno" | "bostezo";

export interface Look {
  shirt: Color;
  shirtDark: Color;
  shirtLine: Color;
  pants: Color;
  pantsDark: Color;
  skin: Color;
  skinDark: Color;
  hat: Color;
  hatDark: Color;
  band: Color;
  hair: Color;
  shoes: "chanclas" | "botas" | "tenis";
  /** Camisa a cuadros (la del recolector) o lisa. */
  pattern?: "cuadros" | "liso";
  /** Sombrero aguadeño (el de siempre) o gorra, para quien trabaja bajo techo. */
  headwear?: "sombrero" | "gorra" | "ninguno" | "cofia";
  /** Pelo corto (el de siempre), largo y suelto, o recogido en moño. */
  hairStyle?: "corto" | "suelto" | "recogido";
  /** Bigote; por defecto sí. */
  mustache?: boolean;
  /** Protección auditiva de copa (orejeras). */
  earmuffs?: boolean;
  /** Tapabocas o respirador para polvo. */
  mask?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rig {
  hip: Point;
  lumbar: Point;
  shoulder: Point;
  neck: Point;
  head: Point;
  elbowN: Point;
  handN: Point;
  elbowF: Point;
  handF: Point;
  kneeN: Point;
  kneeF: Point;
  footN: Point;
  footF: Point;
  /** Hacia dónde mira el tronco (puede diferir de las piernas si hay giro). */
  facingUpper: 1 | -1;
  facingLegs: 1 | -1;
}

export const OUTLINE = hex("#2a1e17");

/** Escala del avatar: 1 = unos 58 px de alto. */
const S = 1.2;
const THIGH = 11 * S;
const SHIN = 11 * S;
const UPPER_ARM = 9.5 * S;
const FOREARM = 8.5 * S;
const TORSO = 16 * S;
const HEAD_R = 7;
const SOLE = 2;

const RAD = Math.PI / 180;

export const STAND: Pose = {
  lean: 2,
  thighN: 0,
  shinN: 0,
  thighF: 0,
  shinF: 0,
  armN: 6,
  foreN: 12,
  armF: -6,
  foreF: 4,
  headTilt: 0,
  headPush: 0,
  twist: 0,
  bob: 0,
};

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/**
 * Ciclo de caminar a partir de una pose base; phase en vueltas (0..1). Con `swingArms`
 * en falso los brazos no se mueven (van cargando algo).
 */
export function walkPose(base: Pose, phase: number, stride = 1, swingArms = true): Pose {
  const s = Math.sin(phase * Math.PI * 2);
  const c = Math.cos(phase * Math.PI * 2);
  const lift = (v: number) => Math.max(0, v);
  return {
    ...base,
    thighN: base.thighN + 24 * s * stride,
    shinN: base.shinN + (24 * s - 30 * lift(c)) * stride,
    thighF: base.thighF - 24 * s * stride,
    shinF: base.shinF + (-24 * s - 30 * lift(-c)) * stride,
    armN: base.armN - (swingArms ? 18 * s * stride : 0),
    foreN: base.foreN - (swingArms ? 10 * s * stride : 0),
    armF: base.armF + (swingArms ? 18 * s * stride : 0),
    foreF: base.foreF + (swingArms ? 10 * s * stride : 0),
    bob: base.bob + Math.abs(c) * stride,
  };
}

function down(angle: number, f: number): Point {
  return { x: f * Math.sin(angle * RAD), y: Math.cos(angle * RAD) };
}

function up(angle: number, f: number): Point {
  return { x: f * Math.sin(angle * RAD), y: -Math.cos(angle * RAD) };
}

function add(p: Point, v: Point, k: number): Point {
  return { x: p.x + v.x * k, y: p.y + v.y * k };
}

/** Calcula las articulaciones con los pies apoyados en groundY. */
export function poseRig(pose: Pose, x: number, groundY: number, facing: 1 | -1): Rig {
  const fl = facing;
  const fu = (pose.twist > 0.5 ? -facing : facing) as 1 | -1;

  // Primero con la cadera en (0, 0); después se baja hasta que el pie más bajo toque el piso.
  const hip0 = { x: 0, y: 0 };
  const kneeN0 = add(hip0, down(pose.thighN, fl), THIGH);
  const ankleN0 = add(kneeN0, down(pose.shinN, fl), SHIN);
  const kneeF0 = add(hip0, down(pose.thighF, fl), THIGH);
  const ankleF0 = add(kneeF0, down(pose.shinF, fl), SHIN);
  const lowest = Math.max(ankleN0.y, ankleF0.y) + SOLE;
  const offset = { x, y: groundY - lowest + pose.bob };
  const at = (p: Point) => ({ x: p.x + offset.x, y: p.y + offset.y });

  const hip = at(hip0);
  const lumbar = add(hip, up(pose.lean, fu), 5 * S);
  const shoulder = add(hip, up(pose.lean, fu), TORSO - 2.5 * S);
  const neck = add(hip, up(pose.lean, fu), TORSO);
  // La cabeza no sigue del todo al torso: con la espalda doblada mira hacia adelante.
  const head = add(add(neck, up(pose.lean * 0.55, fu), (1.5 + HEAD_R) * S), { x: fu, y: 0 }, pose.headPush);

  const elbowN = add(shoulder, down(pose.armN, fu), UPPER_ARM);
  const handN = add(elbowN, down(pose.foreN, fu), FOREARM);
  const shoulderF = add(shoulder, { x: -fu, y: 0 }, S);
  const elbowF = add(shoulderF, down(pose.armF, fu), UPPER_ARM);
  const handF = add(elbowF, down(pose.foreF, fu), FOREARM);

  return {
    hip,
    lumbar,
    shoulder,
    neck,
    head,
    elbowN,
    handN,
    elbowF,
    handF,
    kneeN: at(kneeN0),
    kneeF: at(kneeF0),
    footN: at(ankleN0),
    footF: at(ankleF0),
    facingUpper: fu,
    facingLegs: fl,
  };
}

export interface AvatarLayers {
  /** Detrás de todo (por ejemplo, un bulto en la espalda). */
  back?: () => void;
  /** Entre el torso y la pierna cercana (un bulto entre las rodillas). */
  afterTorso?: () => void;
  /** Después de las piernas y antes de la cabeza y el brazo cercano (un bulto en los brazos). */
  held?: () => void;
  /** Encima de todo. */
  front?: () => void;
}

export function drawAvatar(
  buf: PixelBuffer,
  pose: Pose,
  look: Look,
  x: number,
  groundY: number,
  facing: 1 | -1,
  expression: Expression,
  layers: AvatarLayers = {},
): Rig {
  const rig = poseRig(pose, x, groundY, facing);
  const fu = rig.facingUpper;
  const fl = rig.facingLegs;

  layers.back?.();

  drawLeg(buf, rig.hip, rig.kneeF, rig.footF, fl, look, true);
  drawArm(buf, add(rig.shoulder, { x: -fu, y: 0 }, S), rig.elbowF, rig.handF, look, true);
  drawTorso(buf, rig, look);
  layers.afterTorso?.();
  drawLeg(buf, rig.hip, rig.kneeN, rig.footN, fl, look, false);
  layers.held?.();
  buf.capsule(rig.neck.x, rig.neck.y, rig.head.x, rig.head.y, 2 * S, 2 * S, look.skinDark, OUTLINE);
  drawHead(buf, rig.head, fu, pose.headTilt, look, expression);
  drawArm(buf, rig.shoulder, rig.elbowN, rig.handN, look, false);
  layers.front?.();

  return rig;
}

function drawLeg(buf: PixelBuffer, hip: Point, knee: Point, ankle: Point, f: number, look: Look, far: boolean) {
  const pants = far ? look.pantsDark : look.pants;
  buf.capsule(hip.x, hip.y, knee.x, knee.y, 3 * S, 2.8 * S, pants, OUTLINE);
  if (look.shoes === "tenis") {
    // Tenis blancos con suela gris: el pantalón llega al tobillo.
    buf.capsule(knee.x, knee.y, ankle.x, ankle.y, 2.8 * S, 2.4 * S, pants, OUTLINE);
    const shoe = far ? hex("#d6dee2") : hex("#f4f7f8");
    buf.capsule(ankle.x - f * 1, ankle.y + 0.4, ankle.x + f * 4.6 * S, ankle.y + 0.8, 2 * S, 1.8 * S, shoe, OUTLINE);
    buf.span(Math.round(ankle.y + 2.2), ankle.x - f * 1.5, ankle.x + f * 5.5 * S, hex("#8c9aa1"));
  } else if (look.shoes === "botas") {
    // Bota de caucho: cubre media pantorrilla.
    const shinDir = { x: knee.x - ankle.x, y: knee.y - ankle.y };
    const len = Math.hypot(shinDir.x, shinDir.y) || 1;
    const top = add(ankle, { x: shinDir.x / len, y: shinDir.y / len }, 6 * S);
    buf.capsule(knee.x, knee.y, top.x, top.y, 2.8 * S, 2.6 * S, pants, OUTLINE);
    const boot = far ? hex("#1d1f22") : hex("#2b2e33");
    buf.capsule(top.x, top.y, ankle.x, ankle.y, 3 * S, 2.8 * S, boot, OUTLINE);
    buf.capsule(ankle.x - f * 0.5, ankle.y + 0.6, ankle.x + f * 4.5 * S, ankle.y + 0.8, 2.1 * S, 1.8 * S, boot, OUTLINE);
    if (!far) buf.px(top.x - f * 1, top.y + 2, hex("#5a616b"));
  } else {
    buf.capsule(knee.x, knee.y, ankle.x, ankle.y, 2.8 * S, 2.4 * S, pants, OUTLINE);
    // Chancla: suela roja y el pie descubierto encima.
    const sole = far ? hex("#a82c22") : hex("#d8402f");
    buf.capsule(ankle.x - f * 1.5, ankle.y + 1.6, ankle.x + f * 5.5 * S, ankle.y + 1.6, 1, 1, sole, OUTLINE);
    buf.capsule(ankle.x, ankle.y, ankle.x + f * 4.5 * S, ankle.y + 0.4, 1.6, 1.3, far ? look.skinDark : look.skin, CLEAR);
    buf.px(ankle.x + f * 2, ankle.y + 0.5, sole);
    buf.px(ankle.x + f * 3, ankle.y + 0.5, sole);
  }
}

function drawArm(buf: PixelBuffer, shoulder: Point, elbow: Point, hand: Point, look: Look, far: boolean) {
  const sleeve = far ? look.shirtDark : look.shirt;
  buf.capsule(shoulder.x, shoulder.y, elbow.x, elbow.y, 2.5 * S, 2.3 * S, sleeve, OUTLINE);
  buf.capsule(elbow.x, elbow.y, hand.x, hand.y, 2.3 * S, 2.1 * S, sleeve, OUTLINE);
  buf.capsule(hand.x, hand.y, hand.x, hand.y, 2 * S, 2 * S, far ? look.skinDark : look.skin, OUTLINE);
}

function drawTorso(buf: PixelBuffer, rig: Rig, look: Look) {
  const { hip, neck } = rig;
  const fu = rig.facingUpper;
  const ax = neck.x - hip.x;
  const ay = neck.y - hip.y;
  const len = Math.hypot(ax, ay) || 1;
  const ux = ax / len;
  const uy = ay / len;
  // Lado "espalda": perpendicular al eje, hacia atrás.
  const bx = -uy * -fu;
  const by = ux * -fu;
  const shader = (x: number, y: number): Color => {
    const rx = x - hip.x;
    const ry = y - hip.y;
    const u = (rx * ux + ry * uy) / S;
    const v = (rx * bx + ry * by) / S;
    if (u < 1.2) return hex("#5b3a22"); // cinturón
    if (look.pattern === "liso") {
      if (u > 14.2 && v < 1.6 && v > -1.4) return look.shirtLine; // cuello
      return v > 3.2 ? look.shirtDark : look.shirt;
    }
    const stripeU = Math.floor(u + 0.5) % 5 === 0;
    const stripeV = Math.floor(v + 20.5) % 5 === 0;
    if (stripeU && stripeV) return look.shirtLine;
    if (stripeU || stripeV) return look.shirtDark;
    if (v > 3.2) return look.shirtDark;
    return look.shirt;
  };
  buf.capsule(hip.x, hip.y, rig.shoulder.x, rig.shoulder.y, 4.4 * S, 5.3 * S, shader, OUTLINE);
}

function drawHead(buf: PixelBuffer, c: Point, f: number, tilt: number, look: Look, expression: Expression) {
  const cos = Math.cos(tilt * RAD);
  const sin = Math.sin(tilt * RAD);
  const eye = hex("#241812");
  const shader = (x: number, y: number): Color => {
    const wx = ((x - c.x) * f) / S;
    const wy = (y - c.y) / S;
    const lx = wx * cos + wy * sin;
    const ly = -wx * sin + wy * cos;

    const sombrero = !look.headwear || look.headwear === "sombrero";
    const bare = look.headwear === "ninguno" || look.headwear === "cofia";
    if (look.headwear === "cofia") {
      // Cofia de malla: cubre todo el pelo, con puntitos de la malla.
      if (lx * lx + (ly + 1) ** 2 <= 8.4 * 8.4 && ly < 3 && (ly < -3.2 || lx < -2.3)) {
        return (Math.floor(lx * 1.5) + Math.floor(ly * 1.5)) % 3 === 0 ? hex("#9cc6dc") : hex("#dcedf5");
      }
    }
    if (look.headwear === "ninguno") {
      const style = look.hairStyle ?? "corto";
      const inHead = lx * lx + ly * ly <= HEAD_R * HEAD_R;
      const face = inHead && lx >= -2.2 && ly >= -3.3;
      if (!face) {
        if (lx * lx + ly * ly <= (HEAD_R + 1.2) ** 2 && (ly < -2.6 || lx < -2.4) && ly < 2.5) return look.hair;
        if (style === "suelto" && lx < -1.6 && lx > -8.4 && ly >= -2 && ly < 10.5 && lx > -8.4 + (ly > 7 ? (ly - 7) * 0.8 : 0))
          return Math.floor(ly * 1.4 + lx) % 4 === 0 ? look.hatDark : look.hair;
        if (style === "recogido" && (lx + 7.4) ** 2 + (ly + 3.2) ** 2 <= 7.3) return look.hair;
      }
    }
    if (look.headwear === "gorra") {
      // Visera hacia adelante y copa redonda un poco más grande que la cabeza.
      if (ly >= -3.4 && ly < -1.8 && lx >= 2 && lx <= 10.5 - (ly + 3.4) * 0.6) return look.hatDark;
      if (ly < -2 && lx * lx + (ly + 1.4) ** 2 <= 7.6 * 7.6) {
        if (ly < -8.4 && Math.abs(lx) < 1) return look.band;
        return lx < -2.5 ? look.hatDark : look.hat;
      }
    }
    if (look.earmuffs) {
      // Copa sobre la oreja y la diadema que sube hasta la gorra.
      const d = (lx + 1) ** 2 + (ly - 0.6) ** 2;
      if (d <= 8.4) return d <= 5.2 ? hex("#d8402f") : hex("#9c2019");
      if (Math.abs(lx + 1) < 0.9 && ly < -1.6 && ly > -8 && lx * lx + ly * ly <= (HEAD_R + 0.8) ** 2) return hex("#2b2e33");
    }
    if (look.mask && ly >= 1.3 && ly <= 5.6) {
      const inFace = lx * lx + ly * ly <= HEAD_R * HEAD_R || (lx - 6.6) ** 2 + (ly - 1.4) ** 2 <= 2.4;
      if (inFace && lx >= 1.6) return ly > 4.6 || lx > 6.4 ? hex("#b9c7ce") : hex("#e8eef1");
      if (inFace && lx >= -1 && ly >= 1.8 && ly < 2.6) return hex("#b9c7ce");
    }
    // Ala del sombrero aguadeño: ancha y plana.
    const bx = (lx - 0.5) / 10;
    const by = (ly + 3.6) / 2.1;
    if (sombrero && bx * bx + by * by <= 1) {
      if (ly > -3.1) return look.hatDark;
      return (Math.floor(lx) + Math.floor(ly)) % 3 === 0 ? look.hatDark : look.hat;
    }
    // Copa con la cinta negra y el pliegue de arriba.
    if (sombrero && ly >= -11 && ly < -4.4) {
      const half = 5.4 - (ly < -9 ? (-9 - ly) * 1.1 : 0);
      if (Math.abs(lx + 0.3) <= half) {
        if (ly >= -6.2) return look.band;
        if (ly < -10 && Math.abs(lx) < 1.2) return look.hatDark;
        if (lx < -2.5) return look.hatDark;
        return (Math.floor(lx * 1.3) + Math.floor(ly)) % 4 === 0 ? look.hatDark : look.hat;
      }
    }
    // Nariz: sobresale del perfil.
    if ((lx - 6.6) ** 2 + (ly - 1.4) ** 2 <= 2.4) return look.skin;
    if (lx * lx + ly * ly > HEAD_R * HEAD_R) return CLEAR;

    if (lx < -2.8 && ly < 3.2) return look.headwear === "cofia" ? hex("#dcedf5") : look.hair;
    if ((lx + 1) ** 2 + (ly - 0.8) ** 2 <= 2.3) return (lx + 1) ** 2 + (ly - 0.8) ** 2 <= 0.6 ? eye : look.skinDark;
    if (!bare && ly < -0.6) return look.skinDark; // sombra bajo el ala

    const eyeX = lx >= 3 && lx < 4;
    if (expression === "sueno" || expression === "bostezo") {
      // Párpados caídos y ojeras; al bostezar los ojos se cierran y la boca se abre.
      if (eyeX && ly >= 0.8 && ly < 1.8) return eye;
      if (expression === "sueno" && lx >= 2.6 && lx < 4.4 && ly >= 0.1 && ly < 0.8) return look.skinDark;
      if (lx >= 2.4 && lx < 4.4 && ly >= 2 && ly < 2.7) return look.skinDark;
      if (expression === "bostezo" && (lx - 4.9) ** 2 / 1.7 + (ly - 4.6) ** 2 / 2.6 <= 1) return hex("#5a1f1a");
    } else if (expression === "esfuerzo") {
      if (eyeX && ly >= 0.5 && ly < 1.5) return eye;
      if (lx >= 2.4 && lx < 3.2 && ly >= 0 && ly < 1) return eye;
    } else if (expression === "feliz") {
      if (eyeX && ly >= 0 && ly < 1) return eye;
      if (lx >= 2.4 && lx < 3.2 && ly >= 1 && ly < 2) return eye;
    } else if (eyeX && ly >= -0.2 && ly < 1.8) {
      return eye;
    }
    if (look.mustache !== false && lx >= 3.6 && lx < 6.8 && ly >= 2.7 && ly < 3.8) return look.hair; // bigote
    if (expression === "esfuerzo" && lx >= 4 && lx < 6 && ly >= 4.2 && ly < 5.4) return eye;
    if (expression === "feliz" && lx >= 3.4 && lx < 5.8 && ly >= 4.4 && ly < 5.2) return eye;
    if (lx < -1.5) return look.skinDark;
    return look.skin;
  };
  buf.implicit(c.x - 12 * S, c.y - 13 * S, c.x + 12 * S, c.y + 9 * S, shader, OUTLINE);
}
