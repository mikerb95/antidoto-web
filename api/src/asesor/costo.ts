// Costo de una pregunta al asesor, con el `usage` de cada respuesta de la API. Alimenta el tope
// de gasto diario (presupuesto.ts). La cifra que manda es la de la consola de Claude; esto es
// la estimación para no pasarse.
//
// Módulo PURO.

/**
 * Haiku 4.5: respuestas cortas a dudas comerciales, sin precios que calcular, no necesitan más,
 * y un endpoint público conviene que cueste lo mínimo por pregunta.
 */
export const MODELO = 'claude-haiku-4-5';

/** USD por millón de tokens (Haiku 4.5). Escribir en caché cuesta 1,25 veces la entrada. */
export const TARIFA = { entrada: 1, salida: 5, cacheLectura: 0.1, cacheEscritura: 1.25 } as const;

export interface Uso {
  entrada: number;
  salida: number;
  cacheLectura: number;
  cacheEscritura: number;
}

export const USO_CERO: Uso = { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 };

export interface UsageApi {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function sumarUso(a: Uso, u: UsageApi | null | undefined): Uso {
  return {
    entrada: a.entrada + (u?.input_tokens ?? 0),
    salida: a.salida + (u?.output_tokens ?? 0),
    cacheLectura: a.cacheLectura + (u?.cache_read_input_tokens ?? 0),
    cacheEscritura: a.cacheEscritura + (u?.cache_creation_input_tokens ?? 0),
  };
}

export function costoUsd(u: Uso): number {
  const m = 1_000_000;
  return (
    (u.entrada * TARIFA.entrada) / m +
    (u.salida * TARIFA.salida) / m +
    (u.cacheLectura * TARIFA.cacheLectura) / m +
    (u.cacheEscritura * TARIFA.cacheEscritura) / m
  );
}
