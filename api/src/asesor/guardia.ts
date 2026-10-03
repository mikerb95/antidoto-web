// Guardia de cifras, copiada del asesor de codebymike.net (src/lib/asistente/guardia.ts): toda
// cantidad de dinero que el asesor escriba tiene que estar en la lista de permitidas. Antídoto
// no publica precios, así que hoy la lista está vacía y cualquier precio se rechaza.
//
// Solo se miran cantidades MARCADAS como dinero ($, US$, COP, USD, "millones", "mil" con
// moneda): "20 personas", "8 horas", "+150 producciones" o "15 días" no son precio y no la
// disparan. Se aceptan las dos convenciones de separadores (es: 1.500.000 y 1,5 millones; en:
// 1,500 y 1.5k).
//
// Módulo PURO.

export interface CifraEncontrada {
  texto: string;
  valor: number;
  /** Margen por la precisión con que se escribió: "4,8 millones" admite ±50.000. */
  tolerancia: number;
}

const MULTIPLICADOR: Record<string, number> = {
  millones: 1e6,
  millón: 1e6,
  millon: 1e6,
  m: 1e6,
  mil: 1e3,
  k: 1e3,
};

// $, US$, USD o COP delante, o COP/USD/millones/mil/M/k detrás (al menos una marca). La
// moneda delante ("USD 300") es un agregado de Antídoto a la guardia original.
const PATRON =
  /(US\$|COP\s?\$|\$|USD\s?|COP\s?)?\s?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)(?:\s?(millones|millón|millon|mil|M|k)\b)?(?:\s?(COP|USD|pesos|dólares|dolares))?/gi;

/** Lee un número con separadores de miles o un decimal corto. Devuelve [valor, decimales]. */
function leerNumero(crudo: string): [number, number] {
  if (/^\d{1,3}([.,]\d{3})+$/.test(crudo)) return [Number(crudo.replace(/[.,]/g, '')), 0];
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(crudo);
  if (!m) return [NaN, 0];
  const dec = m[2] ?? '';
  return [Number(`${m[1]}.${dec || '0'}`), dec.length];
}

export function extraerCifras(texto: string): CifraEncontrada[] {
  const out: CifraEncontrada[] = [];
  for (const m of texto.matchAll(PATRON)) {
    const [entero, prefijo, numero, mult, sufijo] = m;
    if (!prefijo && !mult && !sufijo) continue;
    // "mil" y "M" sueltos sin moneda son ambiguos ("2 mil personas"): solo cuentan si además
    // hay una marca de dinero.
    if (!prefijo && !sufijo && mult && !/^millon|^millón/i.test(mult)) continue;
    const [base, decimales] = leerNumero(numero!);
    if (!Number.isFinite(base)) continue;
    const factor = mult ? (MULTIPLICADOR[mult.toLowerCase()] ?? 1) : 1;
    const valor = Math.round(base * factor);
    // La precisión escrita da el margen ("4,8 millones" cubre ±50.000), pero nunca más del 3 %:
    // "5 millones" no puede pasar por un precio de 4,5.
    const tolerancia = mult ? Math.min(factor / 10 ** decimales / 2, valor * 0.03) : 0;
    out.push({ texto: entero.trim(), valor, tolerancia });
  }
  return out;
}

export interface ResultadoGuardia {
  ok: boolean;
  inventadas: CifraEncontrada[];
}

/** Compara las cifras de dinero del texto con las permitidas. */
export function verificarCifras(texto: string, permitidas: readonly number[]): ResultadoGuardia {
  const inventadas = extraerCifras(texto).filter((c) => !permitidas.some((p) => Math.abs(p - c.valor) <= c.tolerancia));
  return { ok: inventadas.length === 0, inventadas };
}
