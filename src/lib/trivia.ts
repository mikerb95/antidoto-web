// Lógica pura de la trivia de ejemplo de la home (sin DOM, con tests en tests/trivia.test.ts).
// Es una muestra ilustrativa de la biblioteca de actividades: una pregunta, un reloj y un
// ranking simulado. La actividad real sale de la biblioteca.

export const DURACION = 20;
export const CORRECTA = 1;
export const PUESTO_INICIAL = 5;
export const PUESTO_SI_FALLA = 9;
export const PARTICIPANTES = 42;

export type Fase = 'jugando' | 'acierto' | 'fallo' | 'tiempo';

export interface Estado {
  fase: Fase;
  /** Segundos que quedan. */
  restante: number;
  elegida: number | null;
  puesto: number;
}

export const inicial = (): Estado => ({ fase: 'jugando', restante: DURACION, elegida: null, puesto: PUESTO_INICIAL });

/** Un segundo menos. Al llegar a cero sin respuesta, se acaba el tiempo. */
export function tic(e: Estado): Estado {
  if (e.fase !== 'jugando') return e;
  const restante = Math.max(0, e.restante - 1);
  return restante === 0 ? { ...e, restante, fase: 'tiempo', puesto: PUESTO_SI_FALLA } : { ...e, restante };
}

/** Puesto tras acertar: quien responde más rápido sube más. */
export const puestoPorAcierto = (restante: number) =>
  Math.max(1, Math.min(PUESTO_INICIAL - 1, PUESTO_INICIAL - 1 - Math.floor((restante / DURACION) * 4)));

export function elegir(e: Estado, opcion: number): Estado {
  if (e.fase !== 'jugando') return e;
  return opcion === CORRECTA
    ? { ...e, elegida: opcion, fase: 'acierto', puesto: puestoPorAcierto(e.restante) }
    : { ...e, elegida: opcion, fase: 'fallo', puesto: PUESTO_SI_FALLA };
}

/** Reloj en formato 00:12. */
export const reloj = (s: number) => `00:${String(Math.max(0, Math.min(59, s))).padStart(2, '0')}`;
