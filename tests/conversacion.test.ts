import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_ALMACEN, MAX_PREGUNTAS } from '../src/lib/asesor';
import { EVENTO_HISTORIAL, leerGuardado, preguntarAsesor } from '../src/lib/conversacion';

// El panel flotante y el facilitador comparten el historial en sessionStorage y se avisan.
let almacen: Map<string, string>;
let eventos: { tipo: string; origen: string }[];

function respuestaApi(datos: unknown, ok = true) {
  return { ok, json: async () => datos } as Response;
}

beforeEach(() => {
  almacen = new Map();
  eventos = [];
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => almacen.set(k, v),
  });
  vi.stubGlobal('dispatchEvent', (e: CustomEvent<{ origen: string }>) => eventos.push({ tipo: e.type, origen: e.detail.origen }));
});

afterEach(() => vi.unstubAllGlobals());

describe('conversación compartida con el asesor', () => {
  it('guarda pregunta y respuesta en el historial común y avisa quién lo cambió', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(respuestaApi({ disponible: true })).mockResolvedValueOnce(respuestaApi({ ok: true, texto: 'Sí, vamos a tu sede.', whatsapp: 'Hola', contacto: null }));
    vi.stubGlobal('fetch', fetch);
    const r = await preguntarAsesor({ api: 'https://api-1.test', locale: 'es', pagina: 'inicio', texto: '¿Van a la sede?', origen: 'facilitador' });
    expect(r.ok).toBe(true);
    expect(leerGuardado().map((m) => m.rol)).toEqual(['usuario', 'asesor']);
    expect(eventos).toEqual([{ tipo: EVENTO_HISTORIAL, origen: 'facilitador' }]);
    // La segunda llamada lleva solo rol y texto.
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ locale: 'es', pagina: 'inicio', mensajes: [{ rol: 'usuario', texto: '¿Van a la sede?' }] });
  });

  it('manda el historial que dejó el otro (panel o facilitador)', async () => {
    almacen.set(CLAVE_ALMACEN, JSON.stringify([{ rol: 'usuario', texto: 'Hola' }, { rol: 'asesor', texto: 'Hola, ¿en qué te ayudo?' }]));
    const fetch = vi.fn().mockResolvedValueOnce(respuestaApi({ disponible: true })).mockResolvedValueOnce(respuestaApi({ ok: true, texto: 'Claro.' }));
    vi.stubGlobal('fetch', fetch);
    await preguntarAsesor({ api: 'https://api-2.test', locale: 'es', pagina: 'inicio', texto: 'Otra', origen: 'panel' });
    expect(JSON.parse(fetch.mock.calls[1][1].body).mensajes).toHaveLength(3);
    expect(leerGuardado()).toHaveLength(4);
  });

  it('respeta el límite de preguntas sin llamar a la API', async () => {
    const lleno = Array.from({ length: MAX_PREGUNTAS * 2 }, (_, i) => ({ rol: i % 2 ? 'asesor' : 'usuario', texto: 'x' }));
    almacen.set(CLAVE_ALMACEN, JSON.stringify(lleno));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await preguntarAsesor({ api: 'https://api-3.test', locale: 'es', pagina: 'inicio', texto: 'Una más', origen: 'panel' })).toEqual({ ok: false, motivo: 'limite' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sin presupuesto o con error no guarda nada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respuestaApi({ disponible: false })));
    expect(await preguntarAsesor({ api: 'https://api-4.test', locale: 'es', pagina: 'inicio', texto: 'Hola', origen: 'panel' })).toEqual({ ok: false, motivo: 'no_disponible' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respuestaApi({ disponible: true })).mockRejectedValueOnce(new Error('red')));
    expect(await preguntarAsesor({ api: 'https://api-5.test', locale: 'es', pagina: 'inicio', texto: 'Hola', origen: 'panel' })).toEqual({ ok: false, motivo: 'error' });
    expect(leerGuardado()).toEqual([]);
    expect(eventos).toEqual([]);
  });
});
