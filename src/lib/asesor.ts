// Lógica del chat con IA en el navegador (src/components/Asesor.astro), sin DOM para probarla.
// El historial vive en sessionStorage (solo esta pestaña) y se reenvía en cada pregunta. La API
// lo valida y no le cree (api/src/asesor/bucle.ts); guarda solo el turno nuevo de cada pregunta,
// 90 días y con teléfonos y correos tapados, bajo el id de conversación de esta pestaña.

/** Máximo de preguntas por conversación; el mismo de la API (MAX_PREGUNTAS). */
export const MAX_PREGUNTAS = 30;
export const MAX_TEXTO = 500;
export const CLAVE_ALMACEN = 'antidoto-asesor';
/** Id de la conversación en curso (UUID v4). Cambia al empezar de nuevo. */
export const CLAVE_ID = 'antidoto-asesor-id';

export interface Mensaje {
  rol: 'usuario' | 'asesor';
  texto: string;
  /** Mensaje para WhatsApp que preparó el asesor en esta respuesta. */
  whatsapp?: string | null;
  /** Enlace al cotizador, con el servicio si se sabe. */
  contacto?: { servicio: string | null } | null;
}

/** Página para la API: la clave del servicio si la ruta es una página de servicio. */
export function paginaDe(ruta: string, pagina: string | undefined, servicios: Record<string, string>): string {
  return servicios[ruta] ?? (pagina || 'otra');
}

/** Cuerpo de una pregunta: solo rol y texto de cada mensaje. Lo demás es de la interfaz. */
export function cuerpoPregunta(locale: 'es' | 'en', pagina: string, mensajes: readonly Mensaje[], conversacion?: string | null, origen?: 'panel' | 'facilitador') {
  return {
    locale,
    pagina,
    mensajes: mensajes.map(({ rol, texto }) => ({ rol, texto })),
    ...(conversacion && esIdConversacion(conversacion) ? { conversacion } : {}),
    ...(origen ? { origen } : {}),
  };
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const esIdConversacion = (v: unknown): v is string => typeof v === 'string' && UUID_V4.test(v);

export const preguntasHechas = (mensajes: readonly Mensaje[]) => mensajes.filter((m) => m.rol === 'usuario').length;

/**
 * Lee el historial guardado. Si no hay, está dañado o no alterna bien (por ejemplo, la pestaña se
 * cerró a mitad de una pregunta), empieza de cero o quita la pregunta que quedó sin respuesta.
 */
export function leerHistorial(crudo: string | null): Mensaje[] {
  if (!crudo) return [];
  try {
    const datos = JSON.parse(crudo) as unknown;
    if (!Array.isArray(datos)) return [];
    const mensajes: Mensaje[] = [];
    for (const [i, m] of datos.entries()) {
      if (!m || typeof m !== 'object') return [];
      const { rol, texto, whatsapp, contacto } = m as Record<string, unknown>;
      if (rol !== (i % 2 === 0 ? 'usuario' : 'asesor') || typeof texto !== 'string' || !texto) return [];
      mensajes.push({
        rol: rol as Mensaje['rol'],
        texto,
        whatsapp: typeof whatsapp === 'string' ? whatsapp : null,
        contacto: contacto && typeof contacto === 'object' ? { servicio: String((contacto as { servicio?: unknown }).servicio ?? '') || null } : null,
      });
    }
    if (mensajes.at(-1)?.rol === 'usuario') mensajes.pop();
    return mensajes;
  } catch {
    return [];
  }
}

/** Texto plano para pintar con textContent: sin negritas de Markdown. */
export function textoPlano(t: string): string {
  return t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '');
}

export function enlaceWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Enlace al cotizador con el servicio ya elegido, si se sabe. */
export function enlaceCotizador(ruta: string, servicio: string | null | undefined): string {
  return servicio ? `${ruta}?servicio=${encodeURIComponent(servicio)}` : ruta;
}
