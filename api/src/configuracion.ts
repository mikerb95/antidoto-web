// Ajustes editables desde el panel. Cada clave tiene su validación y su valor por defecto; lo que
// no está en la tabla usa el defecto (o la variable de entorno, en el caso del tope del chat).
import { inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { configuracion } from './db/schema';
import { ahora } from './util';

type Validador = (v: unknown) => { ok: true; valor: unknown } | { ok: false };

const numero = (min: number, max: number): Validador => (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? { ok: true, valor: Math.round(n * 100) / 100 } : { ok: false };
};
const booleano: Validador = (v) => (typeof v === 'boolean' ? { ok: true, valor: v } : { ok: false });

/** Claves conocidas. El tope del chat no tiene defecto aquí: si falta, manda ASESOR_TOPE_DIARIO_USD. */
export const AJUSTES = {
  'asesor.tope_diario_usd': { validar: numero(0, 20), defecto: null as number | null },
  'asesor.activo': { validar: booleano, defecto: true },
} satisfies Record<string, { validar: Validador; defecto: unknown }>;
export type ClaveAjuste = keyof typeof AJUSTES;
export const CLAVES_AJUSTE = Object.keys(AJUSTES) as ClaveAjuste[];

/** Lee varias claves de una vez. Lanza si la base no responde (quien llama decide si falla abierto o cerrado). */
export async function leerAjustes(db: DrizzleD1Database, claves: readonly ClaveAjuste[] = CLAVES_AJUSTE): Promise<Record<ClaveAjuste, unknown>> {
  const filas = await db.select().from(configuracion).where(inArray(configuracion.clave, [...claves]));
  const r = Object.fromEntries(claves.map((c) => [c, AJUSTES[c].defecto])) as Record<ClaveAjuste, unknown>;
  for (const f of filas) if (f.clave in AJUSTES) r[f.clave as ClaveAjuste] = f.valor;
  return r;
}

/** Valida un lote de cambios. Función pura. */
export function validarAjustes(d: unknown): { ok: true; cambios: Partial<Record<ClaveAjuste, unknown>> } | { ok: false; errores: string[] } {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, errores: ['cuerpo'] };
  const cambios: Partial<Record<ClaveAjuste, unknown>> = {};
  const errores: string[] = [];
  for (const [clave, valor] of Object.entries(d)) {
    if (!(clave in AJUSTES)) {
      errores.push(clave);
      continue;
    }
    const k = clave as ClaveAjuste;
    // null vuelve al valor por defecto.
    if (valor === null) {
      cambios[k] = null;
      continue;
    }
    const r = AJUSTES[k].validar(valor);
    if (r.ok) cambios[k] = r.valor;
    else errores.push(clave);
  }
  if (!Object.keys(cambios).length && !errores.length) errores.push('vacio');
  return errores.length ? { ok: false, errores } : { ok: true, cambios };
}

export async function guardarAjustes(db: DrizzleD1Database, cambios: Partial<Record<ClaveAjuste, unknown>>, autor: string): Promise<void> {
  const t = ahora();
  const sentencias = Object.entries(cambios).map(([clave, valor]) =>
    valor === null
      ? db.delete(configuracion).where(inArray(configuracion.clave, [clave]))
      : db.insert(configuracion).values({ clave, valor, actualizado: t, autor }).onConflictDoUpdate({ target: configuracion.clave, set: { valor, actualizado: t, autor } }),
  );
  if (sentencias.length) await db.batch(sentencias as [(typeof sentencias)[number], ...(typeof sentencias)[number][]]);
}
