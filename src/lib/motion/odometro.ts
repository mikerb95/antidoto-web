// Lógica pura del odómetro de cifras (sin DOM, con tests en tests/odometro.test.ts).
//
// Cada dígito se dibuja como una columna con la tira "0123456789" repetida dos veces
// (20 celdas). Para aterrizar en el dígito d se desplaza la tira hasta la celda 10 + d:
// así todas las columnas recorren al menos una vuelta completa antes de detenerse.

export type Pieza = { tipo: 'digito'; valor: number } | { tipo: 'fijo'; texto: string };

/** Separa una cifra como "+150" o "2020" en dígitos animables y caracteres fijos. */
export function piezas(texto: string): Pieza[] {
  return [...texto].map((ch) =>
    /[0-9]/.test(ch) ? { tipo: 'digito', valor: Number(ch) } : { tipo: 'fijo', texto: ch },
  );
}

/** Desplazamiento final de la tira, en porcentaje de su alto, para mostrar el dígito. */
export function desplazamiento(digito: number): number {
  if (!Number.isInteger(digito) || digito < 0 || digito > 9) throw new RangeError(`dígito inválido: ${digito}`);
  return -((10 + digito) / 20) * 100;
}

export const TIRA = '01234567890123456789';
