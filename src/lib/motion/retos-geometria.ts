// Geometría del diagrama "retos → soluciones" (sin DOM, con tests en tests/retos.test.ts).
//
// Tres retos a la izquierda y tres soluciones a la derecha convergen en el frasco del
// centro. Las curvas son Bézier cúbicas horizontales: salen planas de cada nodo y llegan
// planas al frasco, así las partículas no dan codos al entrar ni al salir.

export const LIENZO = { ancho: 1200, alto: 520 } as const;
export const FRASCO = { x: 600, y: 270, entrada: 496, salida: 704 } as const;
const COLUMNA = { retos: 240, soluciones: 960 } as const;

export interface Punto {
  x: number;
  y: number;
}

/** Posición vertical de cada fila, repartida alrededor del centro del frasco. */
export function filas(n: number, separacion = 150): number[] {
  const inicio = FRASCO.y - ((n - 1) * separacion) / 2;
  return Array.from({ length: n }, (_, i) => inicio + i * separacion);
}

/** Curva cúbica horizontal de `a` a `b`, con los controles a la mitad del recorrido. */
export function curva(a: Punto, b: Punto): string {
  const medio = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C${medio} ${a.y} ${medio} ${b.y} ${b.x} ${b.y}`;
}

export interface Diagrama {
  retos: Punto[];
  soluciones: Punto[];
  entradas: string[];
  salidas: string[];
}

/** Nodos y curvas para `n` pares reto/solución. */
export function diagrama(n: number): Diagrama {
  const ys = filas(n);
  const retos = ys.map((y) => ({ x: COLUMNA.retos, y }));
  const soluciones = ys.map((y) => ({ x: COLUMNA.soluciones, y }));
  return {
    retos,
    soluciones,
    entradas: retos.map((p) => curva(p, { x: FRASCO.entrada, y: FRASCO.y })),
    salidas: soluciones.map((p) => curva({ x: FRASCO.salida, y: FRASCO.y }, p)),
  };
}
