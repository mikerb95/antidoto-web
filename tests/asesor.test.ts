import { describe, expect, it } from 'vitest';
import { cuerpoPregunta, enlaceCotizador, leerHistorial, paginaDe, preguntasHechas, textoPlano, type Mensaje } from '../src/lib/asesor';
import { ui } from '../src/i18n/ui';

const VOSEO = /(?<!\p{L})(vos|sos|podés|querés|tenés|sentís|mirá|contame|escribí)(?!\p{L})/iu;

describe('chat con IA en el navegador', () => {
  it('toma la clave del servicio en sus páginas y la página en las demás', () => {
    const mapa = { '/servicios/catering-corporativo/': 'catering' };
    expect(paginaDe('/servicios/catering-corporativo/', 'servicios', mapa)).toBe('catering');
    expect(paginaDe('/contacto/', 'contacto', mapa)).toBe('contacto');
    expect(paginaDe('/politica-de-datos/', '', mapa)).toBe('otra');
  });

  it('a la API solo van rol y texto', () => {
    const m: Mensaje[] = [
      { rol: 'usuario', texto: 'Hola' },
      { rol: 'asesor', texto: 'Hola', whatsapp: 'x', contacto: { servicio: 'catering' } },
      { rol: 'usuario', texto: '¿Y?' },
    ];
    expect(cuerpoPregunta('es', 'inicio', m)).toEqual({
      locale: 'es',
      pagina: 'inicio',
      mensajes: [
        { rol: 'usuario', texto: 'Hola' },
        { rol: 'asesor', texto: 'Hola' },
        { rol: 'usuario', texto: '¿Y?' },
      ],
    });
    expect(preguntasHechas(m)).toBe(2);
  });

  it('manda el id de la conversación y el origen; un id inválido no viaja', () => {
    const m: Mensaje[] = [{ rol: 'usuario', texto: 'Hola' }];
    const id = '0b6a6c3e-5d1f-4a2b-9c3d-1e2f3a4b5c6d';
    expect(cuerpoPregunta('es', 'inicio', m, id, 'facilitador')).toMatchObject({ conversacion: id, origen: 'facilitador' });
    expect(cuerpoPregunta('es', 'inicio', m, 'no-es-uuid')).not.toHaveProperty('conversacion');
    expect(cuerpoPregunta('es', 'inicio', m, null)).not.toHaveProperty('conversacion');
  });

  it('lee el historial guardado y descarta lo dañado', () => {
    expect(leerHistorial(null)).toEqual([]);
    expect(leerHistorial('no es json')).toEqual([]);
    expect(leerHistorial(JSON.stringify([{ rol: 'asesor', texto: 'x' }]))).toEqual([]);
    const ok = [
      { rol: 'usuario', texto: 'Hola' },
      { rol: 'asesor', texto: 'Hola', whatsapp: 'w' },
    ];
    expect(leerHistorial(JSON.stringify(ok))).toEqual([
      { rol: 'usuario', texto: 'Hola', whatsapp: null, contacto: null },
      { rol: 'asesor', texto: 'Hola', whatsapp: 'w', contacto: null },
    ]);
    // Pregunta que quedó sin respuesta (pestaña cerrada a mitad): se quita.
    expect(leerHistorial(JSON.stringify([...ok, { rol: 'usuario', texto: '¿Y?' }]))).toHaveLength(2);
  });

  it('pinta texto plano', () => {
    expect(textoPlano('**Sí**, claro.\n## Título')).toBe('Sí, claro.\nTítulo');
  });

  it('el enlace al cotizador lleva el servicio', () => {
    expect(enlaceCotizador('/contacto/', 'catering')).toBe('/contacto/?servicio=catering');
    expect(enlaceCotizador('/contacto/', null)).toBe('/contacto/');
  });

  it('los textos del chat existen en los dos idiomas, sin voseo ni rayas', () => {
    expect(Object.keys(ui.es.asesor).sort()).toEqual(Object.keys(ui.en.asesor).sort());
    const todo = JSON.stringify(ui.es.asesor);
    expect(todo).not.toMatch(VOSEO);
    expect(todo + JSON.stringify(ui.en.asesor)).not.toMatch(new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`));
  });
});
