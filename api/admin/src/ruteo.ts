// Ruteo mínimo con la History API: las rutas viven bajo /admin/ y el Worker devuelve el mismo
// index.html para todas. Los <a href="/admin/..."> normales se interceptan (sin componente Link).
import { useEffect, useState } from 'preact/hooks';

const subs = new Set<() => void>();
const avisar = () => subs.forEach((f) => f());

export function navegar(a: string, opciones: { reemplazar?: boolean } = {}): void {
  if (a === location.pathname + location.search) return;
  history[opciones.reemplazar ? 'replaceState' : 'pushState'](null, '', a);
  avisar();
  window.scrollTo(0, 0);
}

export interface Ubicacion {
  ruta: string;
  query: URLSearchParams;
}

export function useUbicacion(): Ubicacion {
  const [, forzar] = useState(0);
  useEffect(() => {
    const f = () => forzar((x) => x + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return { ruta: location.pathname, query: new URLSearchParams(location.search) };
}

/** Cambia parámetros de la query sin agregar una entrada al historial (filtros de una lista). */
export function ponerQuery(cambios: Record<string, string | number | null | undefined>): void {
  const q = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(cambios)) {
    if (v === null || v === undefined || v === '' || v === 0) q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  history.replaceState(null, '', location.pathname + (s ? `?${s}` : ''));
  avisar();
}

/** Intercepta clics en enlaces internos del panel. Se llama una vez al arrancar. */
export function interceptarEnlaces(): void {
  window.addEventListener('popstate', avisar);
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/admin/') || url.pathname.startsWith('/admin/api/') || url.pathname.endsWith('.csv')) return;
    e.preventDefault();
    navegar(url.pathname + url.search);
  });
}

/** Enlaces viejos de la bandeja (#<id>, #campana-<id>...) a las rutas nuevas. */
export function rutaDeHashViejo(hash: string): string | null {
  const h = hash.replace(/^#/, '');
  if (!h) return null;
  if (/^[0-9a-f-]{36}$/.test(h)) return `/admin/solicitudes/${h}`;
  const m = h.match(/^(campana|contacto|automatico)-(.+)$/);
  if (m) return `/admin/${m[1] === 'campana' ? 'campanas' : m[1] === 'contacto' ? 'contactos' : 'automaticos'}/${m[2]}`;
  if (['leads', 'metricas', 'campanas', 'contactos', 'equipo'].includes(h)) return `/admin/${h === 'leads' ? 'solicitudes' : h}`;
  return null;
}
