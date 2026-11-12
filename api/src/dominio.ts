// Constantes del dominio sin dependencias: las comparten la API, el esquema de la base y el
// panel en el navegador (que no debe arrastrar drizzle a su bundle).

/** Idiomas del sitio: los mismos de LOCALES en src/i18n/ui.ts. */
export const LOCALES = ['es', 'en', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];
/** El idioma que llega en una petición, o español si no es uno del sitio. */
export const aLocale = (v: unknown): Locale => (LOCALES.includes(v as Locale) ? (v as Locale) : 'es');
/** Nombre de cada idioma en español, para el panel y los correos al equipo. */
export const NOMBRE_IDIOMA: Record<Locale, string> = { es: 'Español', en: 'Inglés', pt: 'Portugués' };

export const ESTADOS = ['nuevo', 'contactado', 'cotizado', 'ganado', 'perdido'] as const;
export type Estado = (typeof ESTADOS)[number];

/**
 * Clics que cuenta la analítica propia del sitio, sin cookies ni datos personales (POST /v1/clic):
 * WhatsApp en cualquier parte, cotizaciones enviadas por WhatsApp o por correo y llamadas.
 */
export const TIPOS_CLIC = ['whatsapp', 'cotizacion_whatsapp', 'cotizacion_correo', 'llamada'] as const;
export type TipoClic = (typeof TIPOS_CLIC)[number];

/** Líneas del sitio más SG-SST (página propia /sg-sst/, no es una línea de src/content/servicios/). */
export const SERVICIOS = ['formaciones', 'audiovisual', 'catering', 'diseno', 'ia', 'sgsst'] as const;
export type ServicioId = (typeof SERVICIOS)[number];

/**
 * Roles del equipo. admin hace todo; comercial atiende solicitudes y novedades; produccion lleva
 * los proyectos; contenido edita el sitio y las campañas; lectura solo mira.
 */
export const ROLES_EQUIPO = ['admin', 'comercial', 'produccion', 'contenido', 'lectura'] as const;
/**
 * Todos los roles. dev es el acceso de desarrollo: hace todo, entra solo con su cuenta de GitHub
 * (src/github.ts) y no se asigna ni se cambia desde Equipo.
 */
export const ROLES = ['dev', ...ROLES_EQUIPO] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS_CONTACTO = ['pendiente', 'activo', 'baja', 'rebotado'] as const;
export type EstadoContacto = (typeof ESTADOS_CONTACTO)[number];

export const ESTADOS_CAMPANA = ['borrador', 'programada', 'enviando', 'enviada', 'cancelada'] as const;
export type EstadoCampana = (typeof ESTADOS_CAMPANA)[number];
