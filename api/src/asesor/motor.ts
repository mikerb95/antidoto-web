// Conecta el bucle (bucle.ts) con la API de Claude. Sin SDK: el Worker llama con fetch, como a
// Resend.
//
// Sin transmisión palabra a palabra: la guardia de cifras revisa la respuesta COMPLETA antes de
// mostrarla, así que transmitirla enseñaría justo lo que la guardia podría rechazar.
import type { Locale } from '../../../src/i18n/ui';
import type { MensajeApi, RespuestaApi } from './bucle';
import { MODELO } from './costo';
import { definiciones } from './herramientas';
import { systemPrompt, type Pagina } from './prompt';

const URL_API = 'https://api.anthropic.com/v1/messages';
/** Hay alguien mirando el chat: un solo reintento y 25 s por llamada. */
const TIEMPO_MAXIMO_MS = 25_000;

export class ErrorModelo extends Error {
  constructor(public estado: number, detalle: string) {
    super(`API de Claude respondió ${estado}: ${detalle.slice(0, 300)}`);
    this.name = 'ErrorModelo';
  }
}

/** Crea la función que llama al modelo para una conversación. */
export function llamador(clave: string, locale: Locale, pagina: Pagina | undefined, url = URL_API, hacerFetch: typeof fetch = fetch) {
  // Caché en el prompt de sistema y en la última herramienta: es lo fijo de cada pregunta.
  const system = [{ type: 'text', text: systemPrompt(locale, pagina), cache_control: { type: 'ephemeral' } }];
  const tools = definiciones().map((d, i, todas) => (i === todas.length - 1 ? { ...d, cache_control: { type: 'ephemeral' } } : d));

  return async (messages: MensajeApi[]): Promise<RespuestaApi> => {
    const cuerpo = JSON.stringify({
      model: MODELO,
      // Respuestas de 2 a 5 frases; el techo evita que una respuesta desbocada cueste diez veces lo normal.
      max_tokens: 700,
      system,
      tools,
      messages,
    });
    for (let intento = 0; ; intento++) {
      const r = await hacerFetch(url, {
        method: 'POST',
        headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: cuerpo,
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      if (r.ok) return (await r.json()) as RespuestaApi;
      // Sobrecarga o límite de la API: un reintento corto. El resto no se arregla reintentando.
      if (intento === 0 && (r.status === 429 || r.status === 529 || r.status >= 500)) {
        await new Promise((ok) => setTimeout(ok, 800));
        continue;
      }
      throw new ErrorModelo(r.status, await r.text());
    }
  };
}
