// Cliente de la API del panel: mismo origen y cookie de sesión. Un 401 manda a la pantalla de
// acceso; los demás errores llegan como ErrorApi con el cuerpo de la respuesta.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
    readonly datos: Record<string, unknown>,
  ) {
    super(mensaje);
  }
}

type AlPerderSesion = () => void;
let alPerderSesion: AlPerderSesion = () => {};
export const cuandoSePierdaLaSesion = (f: AlPerderSesion) => (alPerderSesion = f);

export async function api<T = Record<string, unknown>>(ruta: string, opciones: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const conCuerpo = opciones.body !== undefined;
  const res = await fetch(ruta, {
    method: opciones.method ?? (conCuerpo ? 'POST' : 'GET'),
    headers: conCuerpo ? { 'content-type': 'application/json' } : {},
    body: conCuerpo ? JSON.stringify(opciones.body) : undefined,
    credentials: 'same-origin',
    signal: opciones.signal,
  });
  if (res.status === 401) {
    alPerderSesion();
    throw new ErrorApi('sesion', 401, {});
  }
  const datos = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ErrorApi(String(datos.error ?? 'error'), res.status, datos);
  return datos as T;
}

/** Subida de archivos (multipart): sin content-type para que el navegador ponga el límite. */
export async function subir<T>(ruta: string, form: FormData): Promise<T> {
  const res = await fetch(ruta, { method: 'POST', body: form, credentials: 'same-origin' });
  if (res.status === 401) {
    alPerderSesion();
    throw new ErrorApi('sesion', 401, {});
  }
  const datos = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ErrorApi(String(datos.error ?? 'error'), res.status, datos);
  return datos as T;
}

export interface Datos<T> {
  datos: T | null;
  error: ErrorApi | null;
  cargando: boolean;
  recargar: () => void;
  poner: (d: T) => void;
}

/**
 * Pide una ruta y la vuelve a pedir cuando cambia. Si llega una respuesta vieja después de
 * una nueva (filtros que cambian rápido), se descarta.
 */
export function useDatos<T>(ruta: string | null): Datos<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [cargando, setCargando] = useState(!!ruta);
  const [vuelta, setVuelta] = useState(0);
  const pedido = useRef(0);

  useEffect(() => {
    if (!ruta) return;
    const n = ++pedido.current;
    const ctl = new AbortController();
    setCargando(true);
    api<T>(ruta, { signal: ctl.signal })
      .then((d) => {
        if (n !== pedido.current) return;
        setDatos(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (n !== pedido.current || (e as Error).name === 'AbortError') return;
        setError(e instanceof ErrorApi ? e : new ErrorApi('red', 0, {}));
      })
      .finally(() => n === pedido.current && setCargando(false));
    return () => ctl.abort();
  }, [ruta, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { datos, error, cargando, recargar, poner: setDatos };
}

/** Mensaje claro para un error de la API. */
export function mensajeError(e: unknown, porDefecto = 'No se pudo completar. Intenta de nuevo.'): string {
  if (!(e instanceof ErrorApi)) return 'Sin conexión con el servidor. Revisa tu red.';
  if (e.status === 403) return 'Tu rol no permite hacer esto.';
  if (e.status === 404) return 'Ya no existe.';
  if (e.status === 0) return 'Sin conexión con el servidor. Revisa tu red.';
  return porDefecto;
}
