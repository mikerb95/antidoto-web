// Enlaces de los correos de novedades. Los de confirmar, baja y preferencias apuntan a la API (así
// los correos viejos siguen sirviendo y la baja de un clic de RFC 8058 tiene a dónde hacer POST);
// su GET redirige a la página del sitio, que muestra el botón con el diseño de Antídoto.
import type { Env } from '../env';

export type Accion = 'confirmar' | 'baja' | 'preferencias';
export type Locale = 'es' | 'en';

export const enlace = (appUrl: string, accion: Accion, t: string, campana?: string) =>
  `${appUrl}/v1/suscripcion/${accion}?t=${encodeURIComponent(t)}${campana ? `&c=${encodeURIComponent(campana)}` : ''}`;

export const enlaceBaja = (appUrl: string, t: string, campana?: string) => enlace(appUrl, 'baja', t, campana);
export const enlacePreferencias = (appUrl: string, t: string) => enlace(appUrl, 'preferencias', t);
/** Versión web de una campaña ("Ver en el navegador"). */
export const enlaceWeb = (appUrl: string, campana: string) => `${appUrl}/v1/novedades/${campana}`;

export const sitioUrl = (env: Pick<Env, 'SITIO_URL'>) => (env.SITIO_URL || 'https://antidotocolombia.com').replace(/\/$/, '');

/** Rutas del sitio (src/i18n/ui.ts: rutaPreferencias y rutaNovedades). */
const PREFERENCIAS: Record<Locale, string> = { es: '/novedades/preferencias/', en: '/en/news/preferences/' };
const NOVEDADES: Record<Locale, string> = { es: '/novedades/', en: '/en/news/' };

export const paginaPreferencias = (env: Pick<Env, 'SITIO_URL'>, locale: Locale, params: Record<string, string>) =>
  `${sitioUrl(env)}${PREFERENCIAS[locale]}?${new URLSearchParams(params)}`;

export const paginaNovedades = (env: Pick<Env, 'SITIO_URL'>, locale: Locale) => `${sitioUrl(env)}${NOVEDADES[locale]}`;
