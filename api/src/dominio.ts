// Constantes del dominio sin dependencias: las comparten el Worker, el esquema de la base y el
// panel en el navegador (que no debe arrastrar drizzle a su bundle).

export const ESTADOS = ['nuevo', 'contactado', 'cotizado', 'ganado', 'perdido'] as const;
export type Estado = (typeof ESTADOS)[number];

export const SERVICIOS = ['formaciones', 'audiovisual', 'catering', 'diseno', 'ia'] as const;
export type ServicioId = (typeof SERVICIOS)[number];

/**
 * Roles del equipo. admin hace todo; comercial atiende solicitudes y novedades; produccion lleva
 * los proyectos; contenido edita el sitio y las campañas; lectura solo mira.
 */
export const ROLES = ['admin', 'comercial', 'produccion', 'contenido', 'lectura'] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS_CONTACTO = ['pendiente', 'activo', 'baja', 'rebotado'] as const;
export type EstadoContacto = (typeof ESTADOS_CONTACTO)[number];

export const ESTADOS_CAMPANA = ['borrador', 'programada', 'enviando', 'enviada', 'cancelada'] as const;
export type EstadoCampana = (typeof ESTADOS_CAMPANA)[number];
