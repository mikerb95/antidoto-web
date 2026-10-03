// Una vuelta de conversación del asesor: valida lo que manda el navegador, llama al modelo,
// ejecuta sus herramientas y pasa la respuesta por la guardia de cifras antes de devolverla.
//
// El servidor no guarda la conversación: el navegador reenvía el historial en cada pregunta.
// Por eso del historial solo se toma texto, con roles alternados y largos acotados, y los datos
// de contacto que haya escrito la persona se tapan antes de mandarlo al modelo.
//
// El modelo se inyecta (`Dependencias`) para probar el bucle sin red.
// Módulo PURO.
import { ui, type Locale } from '../../../src/i18n/ui';
import { CIFRAS_PUBLICAS, type Clave } from './conocimiento';
import { sumarUso, USO_CERO, type Uso, type UsageApi } from './costo';
import { verificarCifras } from './guardia';
import { leerContacto, leerWhatsapp, mensajeWhatsapp, taparDatos } from './herramientas';
import { MAX_PREGUNTAS, PAGINAS, RAYA_LARGA, RAYA_MEDIA, type Pagina } from './prompt';

export const MAX_TEXTO_USUARIO = 500;
export const MAX_TEXTO_ASESOR = 2_000;
/** Llamadas al modelo por pregunta: una o dos herramientas, la respuesta y un reintento de la guardia. */
export const MAX_LLAMADAS = 4;

// Lo mínimo de la API de mensajes de Claude que usa el bucle (sin SDK: el Worker llama con fetch).
export type Bloque =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
export interface MensajeApi {
  role: 'user' | 'assistant';
  content: string | Bloque[];
}
export interface RespuestaApi {
  content: Bloque[];
  stop_reason: string | null;
  usage?: UsageApi;
}

export interface Entrada {
  locale: Locale;
  pagina?: Pagina;
  mensajes: { rol: 'usuario' | 'asesor'; texto: string }[];
}

export type ErrorEntrada = { error: 'formato' | 'limite' };

/** Valida el cuerpo. 'limite' si se pasó del máximo de preguntas (el navegador lo impide). */
export function validarEntrada(cuerpo: unknown): Entrada | ErrorEntrada {
  const formato = { error: 'formato' } as const;
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return formato;
  const o = cuerpo as Record<string, unknown>;
  if (Object.keys(o).some((k) => !['locale', 'pagina', 'mensajes'].includes(k))) return formato;
  if (o.locale !== 'es' && o.locale !== 'en') return formato;
  if (o.pagina !== undefined && !(PAGINAS as readonly unknown[]).includes(o.pagina)) return formato;
  if (!Array.isArray(o.mensajes) || o.mensajes.length === 0) return formato;
  if (o.mensajes.length > MAX_PREGUNTAS * 2 - 1) return { error: 'limite' };
  const mensajes: Entrada['mensajes'] = [];
  for (const [i, m] of o.mensajes.entries()) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return formato;
    const { rol, texto, ...resto } = m as Record<string, unknown>;
    if (Object.keys(resto).length || typeof texto !== 'string') return formato;
    // Alternancia estricta, empezando y terminando en el visitante.
    if (rol !== (i % 2 === 0 ? 'usuario' : 'asesor')) return formato;
    const limpio = texto.trim();
    if (!limpio || limpio.length > (rol === 'usuario' ? MAX_TEXTO_USUARIO : MAX_TEXTO_ASESOR)) return formato;
    mensajes.push({ rol: rol as 'usuario' | 'asesor', texto: limpio });
  }
  if (mensajes.at(-1)!.rol !== 'usuario') return formato;
  return { locale: o.locale, pagina: o.pagina as Pagina | undefined, mensajes };
}

export interface Dependencias {
  llamarModelo: (mensajes: MensajeApi[]) => Promise<RespuestaApi>;
}

export interface Respuesta {
  texto: string;
  /** Mensaje para precargar en WhatsApp, si el modelo lo preparó en esta vuelta. */
  whatsapp: string | null;
  /** Lo que el modelo resumió para WhatsApp, sin el saludo: va en el aviso al equipo. */
  necesidad: string | null;
  /** El modelo pidió mostrar el enlace al cotizador; trae el servicio si lo sabe. */
  contacto: { servicio: Clave | null } | null;
  /** Servicio del que se habla, si el modelo lo indicó en alguna herramienta. */
  servicio: Clave | null;
  uso: Uso;
  /** Por qué se devolvió el texto de respaldo en vez de la respuesta del modelo. */
  respaldo: 'guardia' | 'negativa' | 'vueltas' | null;
}

const RESPALDO: Record<Locale, string> = {
  es: 'Prefiero no darte una respuesta que no pueda respaldar. Escríbele al equipo de Antídoto por WhatsApp y te confirman.',
  en: "I'd rather not give you an answer I can't back up. Message the Antídoto team on WhatsApp and they'll confirm.",
};

const RANGO = new RegExp(`(\\d)\\s*[${RAYA_LARGA}${RAYA_MEDIA}]\\s*(?=[$\\d])`, 'g');
const RAYA = new RegExp(`\\s*[${RAYA_LARGA}${RAYA_MEDIA}]\\s*`, 'g');

/**
 * Quita las rayas del texto del modelo. El sitio no las usa, y la instrucción del prompt no
 * basta: Haiku las pone por costumbre. Un rango numérico pasa a "3 a 5" / "3 to 5"; cualquier
 * otra raya, a coma.
 */
export function sinRayas(texto: string, locale: Locale): string {
  return texto.replace(RANGO, `$1 ${locale === 'es' ? 'a' : 'to'} `).replace(RAYA, ', ');
}

// Formas de voseo que Haiku se cuela aunque el prompt lo prohíba ("¿para cuándo lo pensás?",
// prueba real del 3 oct 2026). Lista cerrada a propósito: "estás", "además" o "inglés" también
// llevan tilde al final y no son voseo, así que una regla general rompería texto bueno.
const VOSEO: Record<string, string> = {
  sos: 'eres', podés: 'puedes', querés: 'quieres', tenés: 'tienes', sabés: 'sabes', sentís: 'sientes',
  pensás: 'piensas', necesitás: 'necesitas', preferís: 'prefieres', contás: 'cuentas', buscás: 'buscas',
  venís: 'vienes', decís: 'dices', hacés: 'haces', pedís: 'pides', elegís: 'eliges', mirá: 'mira',
  contame: 'cuéntame', decime: 'dime', escribí: 'escribe', avisame: 'avísame', fijate: 'fíjate', imaginate: 'imagínate',
};
const RE_VOSEO = new RegExp(`(?<!\\p{L})(${Object.keys(VOSEO).join('|')})(?!\\p{L})`, 'giu');

/** Cambia el voseo por tuteo en español, conservando la mayúscula inicial. */
export function sinVoseo(texto: string, locale: Locale): string {
  if (locale !== 'es') return texto;
  return texto.replace(RE_VOSEO, (m) => {
    const t = VOSEO[m.toLowerCase()]!;
    return m[0] === m[0]!.toUpperCase() ? t[0]!.toUpperCase() + t.slice(1) : t;
  });
}

function textoDe(r: RespuestaApi): string {
  return r.content
    .filter((b): b is Extract<Bloque, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** Corre una pregunta completa. Lanza solo si falla la llamada al modelo. */
export async function atender(e: Entrada, deps: Dependencias): Promise<Respuesta> {
  const mensajes: MensajeApi[] = e.mensajes.map((m) => ({
    role: m.rol === 'usuario' ? 'user' : 'assistant',
    content: taparDatos(m.texto, e.locale),
  }));

  let uso = USO_CERO;
  let whatsapp: string | null = null;
  let necesidad: string | null = null;
  let contacto: Respuesta['contacto'] = null;
  let servicio: Clave | null = null;
  let reintentoGuardia = false;
  // Texto escrito junto a una llamada a herramienta. El modelo suele dar la respuesta completa
  // en el mismo mensaje en que pide preparar WhatsApp, y después cierra sin decir nada más: si
  // ese texto se descartara, se perdería justo la respuesta.
  let previo: string[] = [];
  const cerrar = (texto: string, respaldo: Respuesta['respaldo']): Respuesta => ({ texto, whatsapp, necesidad, contacto, servicio, uso, respaldo });

  for (let vuelta = 0; vuelta < MAX_LLAMADAS; vuelta++) {
    const r = await deps.llamarModelo(mensajes);
    uso = sumarUso(uso, r.usage);
    if (r.stop_reason === 'refusal') return cerrar(RESPALDO[e.locale], 'negativa');

    const usos = r.content.filter((b): b is Extract<Bloque, { type: 'tool_use' }> => b.type === 'tool_use');
    if (usos.length) {
      const dicho = textoDe(r);
      if (dicho) previo.push(dicho);
      mensajes.push({ role: 'assistant', content: r.content });
      mensajes.push({
        role: 'user',
        content: usos.map((u): Bloque => {
          const s = ejecutar(u, e.locale);
          if (s.whatsapp) ({ whatsapp, necesidad } = s.whatsapp);
          if (s.contacto) contacto = s.contacto;
          if (s.servicio) servicio = s.servicio;
          return { type: 'tool_result', tool_use_id: u.id, content: s.contenido, ...(s.error ? { is_error: true } : {}) };
        }),
      });
      continue;
    }

    const texto = sinVoseo(sinRayas([...previo, textoDe(r)].filter(Boolean).join('\n\n'), e.locale), e.locale);
    if (!texto) return cerrar(RESPALDO[e.locale], 'vueltas');
    const g = verificarCifras(texto, CIFRAS_PUBLICAS);
    if (g.ok) return cerrar(texto, null);
    if (reintentoGuardia) return cerrar(RESPALDO[e.locale], 'guardia');
    // Una oportunidad de corregir, con las cifras problemáticas a la vista.
    reintentoGuardia = true;
    // El reintento reescribe la respuesta completa: lo dicho antes no se suma.
    previo = [];
    mensajes.push({ role: 'assistant', content: r.content });
    mensajes.push({
      role: 'user',
      content:
        `[Revisión automática del sistema, no del visitante] Tu respuesta menciona cifras de dinero: ` +
        `${g.inventadas.map((c) => c.texto).join(', ')}. Antídoto no publica precios. Reescribe la respuesta completa ` +
        'para el visitante sin ninguna cifra de dinero: explica que la propuesta es a la medida y ofrece WhatsApp.',
    });
  }
  return cerrar(RESPALDO[e.locale], 'vueltas');
}

interface Salida {
  contenido: string;
  error: boolean;
  whatsapp?: { whatsapp: string; necesidad: string | null };
  contacto?: { servicio: Clave | null };
  servicio?: Clave;
}

function ejecutar(u: Extract<Bloque, { type: 'tool_use' }>, locale: Locale): Salida {
  if (u.name === 'preparar_whatsapp') {
    const p = leerWhatsapp(u.input);
    if (typeof p === 'string') return { contenido: `Entrada inválida: ${p}`, error: true };
    const whatsapp = mensajeWhatsapp(p, locale);
    // El resumen sobrevive en el mensaje solo si pasó la limpieza; si no, al aviso tampoco va.
    const necesidad = whatsapp.includes(p.necesidad.trim()) ? p.necesidad.trim() : null;
    return {
      contenido: `Listo: el botón "${ui[locale].asesor.whatsapp}" ya está visible para el visitante.`,
      error: false,
      whatsapp: { whatsapp, necesidad },
      servicio: p.servicio,
    };
  }
  if (u.name === 'pedir_contacto') {
    const p = leerContacto(u.input);
    if (typeof p === 'string') return { contenido: `Entrada inválida: ${p}`, error: true };
    return {
      contenido: 'Listo: el enlace al cotizador ya está visible para el visitante debajo de tu respuesta.',
      error: false,
      contacto: { servicio: p.servicio ?? null },
      servicio: p.servicio,
    };
  }
  return { contenido: `Herramienta desconocida: ${u.name}`, error: true };
}
