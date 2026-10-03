// Geometría pura del líquido que sube (sin DOM, con tests en tests/liquido.test.ts).
// Es el gesto común de la home: la solución entra como el líquido del frasco del logo.
// Devuelve un clip-path `polygon()` cuyo borde superior es una ola que se aplana al llenarse.

/** Puntos del borde superior: más puntos, ola más suave. */
export const PUNTOS_OLA = 12;

/**
 * @param avance 0 vacío, 1 lleno.
 * @param fase   desplazamiento de la ola en radianes (se mueve mientras sube).
 * @param amplitud alto de la ola en % del elemento cuando está a medio llenar.
 */
export function ola(avance: number, fase = 0, amplitud = 6): string {
  const p = Math.min(1, Math.max(0, avance));
  // La ola nace y muere plana: así el estado vacío y el lleno son rectángulos exactos.
  const a = amplitud * Math.sin(Math.PI * p);
  // El nivel arranca un poco por debajo del borde para que la cresta no asome antes de tiempo.
  const nivel = 100 + a - p * (100 + 2 * a);
  const borde: string[] = [];
  for (let i = 0; i <= PUNTOS_OLA; i++) {
    const x = (i / PUNTOS_OLA) * 100;
    const y = nivel + a * Math.sin(fase + (i / PUNTOS_OLA) * Math.PI * 2);
    borde.push(`${redondear(x)}% ${redondear(Math.min(100, Math.max(0, y)))}%`);
  }
  return `polygon(${borde.join(', ')}, 100% 100%, 0% 100%)`;
}

const redondear = (n: number) => Math.round(n * 100) / 100;
