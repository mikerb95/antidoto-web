export const ahora = () => Date.now();
export const HORA = 60 * 60 * 1000;
export const DIA = 24 * HORA;

export const uuid = () => crypto.randomUUID();

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(texto: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
}

/** Token aleatorio de 256 bits en base64url, para enlaces de acceso y sesiones. */
export function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Hash de la IP con sal y fecha del día: sirve para limitar envíos y como prueba del
 * consentimiento, sin guardar la IP ni permitir seguir a alguien de un día a otro.
 */
export function hashIp(ip: string | null, sal: string | undefined, ms = ahora()): Promise<string | null> {
  if (!ip) return Promise.resolve(null);
  const dia = new Date(ms).toISOString().slice(0, 10);
  return sha256(`${sal ?? 'antidoto'}|${dia}|${ip}`);
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const escapar = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
