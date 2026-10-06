// Nombres visibles de los catálogos del dominio. El panel es solo en español.
import type { Estado, ServicioId, Rol, EstadoContacto, EstadoCampana } from '@api/dominio';

export const ESTADOS: Record<Estado, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  cotizado: 'Cotizado',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

export const SERVICIOS: Record<ServicioId, string> = {
  formaciones: 'Formaciones vivenciales',
  audiovisual: 'Producción audiovisual',
  catering: 'Catering corporativo',
  diseno: 'Diseño de productos',
  ia: 'Capacitación en IA',
};

export const ROLES: Record<Rol, { nombre: string; descripcion: string }> = {
  admin: { nombre: 'Admin', descripcion: 'Todo, incluidos el equipo, los ajustes, la auditoría y la supresión de datos personales.' },
  comercial: { nombre: 'Comercial', descripcion: 'Solicitudes, novedades y campañas, conversaciones del chat y proyectos con su valor.' },
  produccion: { nombre: 'Producción', descripcion: 'Proyectos, entregables y portal de clientes. Ve las solicitudes, sin valores.' },
  contenido: { nombre: 'Contenido', descripcion: 'Blog, casos, preguntas, clientes y vacantes del sitio, y campañas (sin enviarlas).' },
  lectura: { nombre: 'Solo lectura', descripcion: 'Mira todo lo operativo sin cambiar nada.' },
};

export const ESTADOS_CONTACTO: Record<EstadoContacto, string> = {
  activo: 'Activo',
  pendiente: 'Sin confirmar',
  baja: 'De baja',
  rebotado: 'Rebotado',
};

export const ESTADOS_CAMPANA: Record<EstadoCampana, string> = {
  borrador: 'Borrador',
  programada: 'Programada',
  enviando: 'Enviando',
  enviada: 'Enviada',
  cancelada: 'Cancelada',
};

export const IDIOMAS: Record<'es' | 'en', string> = { es: 'Español', en: 'Inglés' };

export const ORIGENES_CONTACTO: Record<string, string> = {
  pie: 'Pie del sitio',
  inicio: 'Sección de la home',
  archivo: 'Página de novedades',
  cotizador: 'Cotizador',
  admin: 'Invitación del equipo',
  importado: 'Importación',
};

export const MOTIVOS_BAJA: Record<string, string> = {
  enlace: 'enlace de baja',
  queja: 'lo marcó como spam',
  rebote: 'rebote',
  admin: 'el equipo',
  supresion: 'supresión de datos',
};

export const AYUDA_FORMATO = [
  '# Título  y  ## Subtítulo',
  '**negrita**, *cursiva*, [texto](https://enlace)',
  '- elementos de lista',
  '[[Texto del botón|https://enlace]]',
  '![Descripción](https://imagen.jpg)',
  '{{nombre}} pone el nombre de cada persona',
  'Deja una línea en blanco entre bloques.',
];
