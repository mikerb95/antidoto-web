// Formato de fechas (hora de Colombia), dinero y conteos.
const ZONA = 'America/Bogota';

export const fecha = (ms: number | null | undefined, conHora = false): string =>
  ms ? new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short', ...(conHora ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(ms) : '';

export const fechaLarga = (ms: number | null | undefined): string =>
  ms ? new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ms) : '';

export const pesos = (n: number | null | undefined): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0);

export const usd = (n: number | null | undefined, decimales = 2): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n ?? 0);

export const numero = (n: number | null | undefined): string => new Intl.NumberFormat('es-CO').format(n ?? 0);

export const mes = (aaaamm: string): string => {
  const [a, m] = aaaamm.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(new Date(a!, (m ?? 1) - 1, 1));
};

export const pct = (n: number | null | undefined, total: number | null | undefined): string =>
  total ? `${Math.round(((n ?? 0) / total) * 100)} %` : '0 %';

export const cuenta = (n: number | null | undefined, uno: string, varios: string): string => `${numero(n)} ${n === 1 ? uno : varios}`;

/** "hace 3 h", "hace 2 d": para listas donde importa lo reciente. */
export function hace(ms: number, ahora = Date.now()): string {
  const min = Math.round((ahora - ms) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 31 ? `hace ${d} d` : fecha(ms);
}

/** Fecha y hora local para un <input type="datetime-local">. */
export function paraInput(ms: number): string {
  const d = new Date(ms);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Navegador y sistema a partir del user agent, para la lista de sesiones. */
export function dispositivo(ua: string | null): string {
  if (!ua) return 'Navegador desconocido';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return so ? `${nav} en ${so}` : nav;
}
