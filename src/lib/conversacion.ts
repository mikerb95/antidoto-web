// Conversación con el asesor de IA, compartida por todo lo que le habla a la API: el panel de la
// burbuja flotante (Asesor.astro) y el facilitador del mundo pixel (estudio del hero y sala de la
// actividad). Un solo historial en sessionStorage, un solo límite de preguntas y un solo gasto:
// lo que se pregunta en un lado sigue en el otro. Cada cambio se avisa con EVENTO_HISTORIAL para
// que el panel se repinte. La API valida todo (api/src/asesor/bucle.ts) y guarda cada turno 90
// días bajo el id de esta conversación; "Empezar de nuevo" la borra también allá.
import { CLAVE_ALMACEN, CLAVE_ID, MAX_PREGUNTAS, MAX_TEXTO, cuerpoPregunta, esIdConversacion, leerHistorial, preguntasHechas, type Mensaje } from './asesor';

/** Cambió el historial; `detail.origen` dice quién lo cambió. */
export const EVENTO_HISTORIAL = 'antidoto:asesor-historial';
/** Pide abrir el panel del chat (el enlace "Seguir en el chat" del facilitador). */
export const EVENTO_ABRIR = 'antidoto:asesor-abrir';

export type Fallo = 'no_disponible' | 'limite' | 'error';
export type Resultado = { ok: true; pregunta: Mensaje; respuesta: Mensaje } | { ok: false; motivo: Fallo };

// sessionStorage puede no existir o lanzar (modo privado, datos bloqueados): la conversación
// sigue, solo que no se recuerda al cambiar de página.
export function leerGuardado(): Mensaje[] {
  try {
    return leerHistorial(sessionStorage.getItem(CLAVE_ALMACEN));
  } catch {
    return [];
  }
}

/** Id de la conversación en curso; si no hay, crea uno. null sin almacenamiento (no se guarda nada). */
export function idConversacion(): string | null {
  try {
    const guardado = sessionStorage.getItem(CLAVE_ID);
    if (esIdConversacion(guardado)) return guardado;
    const nuevo = crypto.randomUUID();
    sessionStorage.setItem(CLAVE_ID, nuevo);
    return nuevo;
  } catch {
    return null;
  }
}

/** Id de la conversación si ya existe (sin crear uno): lo usa el cotizador para ligar la solicitud. */
export function idConversacionActual(): string | null {
  try {
    const guardado = sessionStorage.getItem(CLAVE_ID);
    return esIdConversacion(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

export function guardarHistorial(historial: readonly Mensaje[], origen: string) {
  try {
    sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(historial));
    // Historial vacío: la próxima pregunta empieza una conversación nueva.
    if (!historial.length) sessionStorage.removeItem(CLAVE_ID);
  } catch {
    /* sin almacenamiento: solo esta vista lo recuerda */
  }
  dispatchEvent(new CustomEvent(EVENTO_HISTORIAL, { detail: { origen } }));
}

/** Primera pregunta de una conversación: id nuevo (el anterior pudo quedar de otra que se vació). */
function nuevaConversacion(): string | null {
  try {
    sessionStorage.removeItem(CLAVE_ID);
  } catch {
    /* sin almacenamiento */
  }
  return idConversacion();
}

const consultas = new Map<string, Promise<boolean>>();

/** La API responde y tiene presupuesto hoy. Se pregunta una vez por página. */
export function disponible(api: string): Promise<boolean> {
  let p = consultas.get(api);
  if (!p) {
    p = fetch(`${api}/v1/asesor`)
      .then((r) => (r.ok ? r.json() : { disponible: false }))
      .then((j: { disponible?: boolean }) => j.disponible === true)
      .catch(() => false);
    consultas.set(api, p);
  }
  return p;
}

/**
 * Borra la conversación guardada en la API (fail-open: si no responde, se borra aquí igual) y
 * vacía el historial de esta pestaña.
 */
export async function borrarConversacion(api: string, origen: string): Promise<void> {
  const id = idConversacionActual();
  guardarHistorial([], origen);
  if (!id) return;
  await fetch(`${api}/v1/asesor/borrar`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ conversacion: id }),
    keepalive: true,
  }).catch(() => null);
}

/** Hace una pregunta con todo el historial guardado y guarda la respuesta. */
export async function preguntarAsesor(o: { api: string; locale: 'es' | 'en'; pagina: string; texto: string; origen: 'panel' | 'facilitador' }): Promise<Resultado> {
  const texto = o.texto.trim().slice(0, MAX_TEXTO);
  const historial = leerGuardado();
  if (preguntasHechas(historial) >= MAX_PREGUNTAS) return { ok: false, motivo: 'limite' };
  if (!(await disponible(o.api))) return { ok: false, motivo: 'no_disponible' };
  const pregunta: Mensaje = { rol: 'usuario', texto };
  try {
    const r = await fetch(`${o.api}/v1/asesor`, {
      method: 'POST',
      // text/plain: sin preflight de CORS en cada pregunta.
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(cuerpoPregunta(o.locale, o.pagina, [...historial, pregunta], historial.length ? idConversacion() : nuevaConversacion(), o.origen)),
    });
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      texto?: string;
      whatsapp?: string | null;
      contacto?: { servicio: string | null } | null;
    };
    if (!r.ok || !j.ok || !j.texto) {
      if (j.error === 'no_disponible') consultas.set(o.api, Promise.resolve(false));
      return { ok: false, motivo: j.error === 'limite' ? 'limite' : j.error === 'no_disponible' ? 'no_disponible' : 'error' };
    }
    const respuesta: Mensaje = { rol: 'asesor', texto: j.texto, whatsapp: j.whatsapp ?? null, contacto: j.contacto ?? null };
    guardarHistorial([...historial, pregunta, respuesta], o.origen);
    return { ok: true, pregunta, respuesta };
  } catch {
    return { ok: false, motivo: 'error' };
  }
}
