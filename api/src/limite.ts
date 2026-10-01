// Límite de frecuencia por clave y hora, sobre la tabla limites. Sumar y leer es una sola
// sentencia (INSERT ... ON CONFLICT DO UPDATE ... RETURNING), así que dos peticiones a la vez
// nunca ven el mismo número.
import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { limites } from './db/schema';
import { ahora, HORA } from './util';

/** Cuenta un intento para la clave en la hora en curso; true si no pasa de `max`. */
export async function dentroDelLimite(db: DrizzleD1Database, clave: string, max: number, t = ahora()): Promise<boolean> {
  const ventana = t - (t % HORA);
  const [fila] = await db
    .insert(limites)
    .values({ clave, ventana, n: 1 })
    .onConflictDoUpdate({ target: [limites.clave, limites.ventana], set: { n: sql`${limites.n} + 1` } })
    .returning({ n: limites.n });
  return (fila?.n ?? 1) <= max;
}
