// Tope de gasto diario del asesor. Es un endpoint abierto a cualquiera que gasta créditos de la
// API: sin tope, un bot con paciencia vacía la cuenta aunque el límite por IP lo frene (basta con
// muchas IPs).
//
// Falla CERRADO, al revés que los correos de la API: si no se puede leer cuánto se ha gastado
// hoy, el asesor no responde y el chat ofrece solo WhatsApp. Perder una conversación con la IA
// cuesta poco; una factura sin techo, no.
import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { gastoAsesor } from '../db/schema';

export const TOPE_POR_DEFECTO_USD = 1;

export function topeDiarioUsd(valor: string | undefined): number {
  const v = Number(valor);
  return valor !== undefined && valor !== '' && Number.isFinite(v) && v >= 0 ? v : TOPE_POR_DEFECTO_USD;
}

/** Fecha de hoy en Colombia: el día del tope empieza a medianoche de Bogotá, no de UTC. */
export function hoyBogota(ms = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(ms));
}

/** USD que quedan hoy. Lanza si la base no responde (quien llama falla cerrado). */
export async function presupuestoRestante(db: DrizzleD1Database, tope: number, ms = Date.now()): Promise<number> {
  const [fila] = await db.select({ usd: gastoAsesor.usd }).from(gastoAsesor).where(eq(gastoAsesor.dia, hoyBogota(ms)));
  return tope - (fila?.usd ?? 0);
}

/** Suma un gasto de forma atómica (un solo UPSERT): dos preguntas a la vez no se pisan. */
export async function sumarGasto(db: DrizzleD1Database, usd: number, ms = Date.now()): Promise<void> {
  if (!(usd > 0)) return;
  await db
    .insert(gastoAsesor)
    .values({ dia: hoyBogota(ms), usd })
    .onConflictDoUpdate({ target: gastoAsesor.dia, set: { usd: sql`${gastoAsesor.usd} + ${usd}` } });
}
