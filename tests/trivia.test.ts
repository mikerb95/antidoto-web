import { describe, expect, it } from 'vitest';
import { CORRECTA, DURACION, elegir, inicial, PUESTO_INICIAL, PUESTO_SI_FALLA, puestoPorAcierto, reloj, tic } from '../src/lib/trivia';

describe('trivia', () => {
  it('empieza jugando con el reloj completo', () => {
    expect(inicial()).toEqual({ fase: 'jugando', restante: DURACION, elegida: null, puesto: PUESTO_INICIAL });
  });

  it('el reloj baja y al llegar a cero se acaba el tiempo', () => {
    let e = inicial();
    for (let i = 0; i < DURACION - 1; i++) e = tic(e);
    expect(e).toMatchObject({ fase: 'jugando', restante: 1 });
    e = tic(e);
    expect(e).toMatchObject({ fase: 'tiempo', restante: 0, puesto: PUESTO_SI_FALLA });
    expect(tic(e)).toBe(e);
  });

  it('acertar sube en el ranking, más cuanto antes se responde', () => {
    const rapido = elegir(inicial(), CORRECTA);
    expect(rapido).toMatchObject({ fase: 'acierto', elegida: CORRECTA, puesto: 1 });
    let lento = inicial();
    for (let i = 0; i < 17; i++) lento = tic(lento);
    expect(elegir(lento, CORRECTA).puesto).toBe(4);
    for (let s = 0; s <= DURACION; s++) expect(puestoPorAcierto(s)).toBeLessThan(PUESTO_INICIAL);
  });

  it('fallar baja en el ranking y deja la respuesta elegida', () => {
    expect(elegir(inicial(), 0)).toMatchObject({ fase: 'fallo', elegida: 0, puesto: PUESTO_SI_FALLA });
  });

  it('después de responder no se puede cambiar ni corre el reloj', () => {
    const e = elegir(inicial(), 0);
    expect(elegir(e, CORRECTA)).toBe(e);
    expect(tic(e)).toBe(e);
  });

  it('formatea el reloj', () => {
    expect(reloj(20)).toBe('00:20');
    expect(reloj(7)).toBe('00:07');
    expect(reloj(-3)).toBe('00:00');
  });
});
