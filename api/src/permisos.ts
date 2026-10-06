// Qué puede hacer cada rol. La API es la que decide (cada ruta del panel exige su permiso); el
// panel solo esconde lo que la persona no puede usar. Función pura, con pruebas.
import { ROLES, type Rol } from './dominio';

export const PERMISOS = [
  'leads.ver',
  'leads.editar',
  'leads.exportar',
  'marketing.ver',
  'marketing.editar',
  'marketing.enviar',
  'asesor.ver',
  'contenido.ver',
  'contenido.editar',
  'contenido.publicar',
  'proyectos.ver',
  'proyectos.editar',
  'proyectos.valor',
  'portal.gestionar',
  /** Supresión de datos personales (Ley 1581): leads, contactos y conversaciones. */
  'datos.suprimir',
  'equipo.gestionar',
  'config.editar',
  'auditoria.ver',
  'sistema.ver',
] as const;
export type Permiso = (typeof PERMISOS)[number];

const MATRIZ: Record<Rol, readonly Permiso[]> = {
  admin: PERMISOS,
  comercial: [
    'leads.ver', 'leads.editar', 'leads.exportar',
    'marketing.ver', 'marketing.editar', 'marketing.enviar',
    'asesor.ver', 'contenido.ver',
    'proyectos.ver', 'proyectos.editar', 'proyectos.valor',
  ],
  produccion: ['leads.ver', 'contenido.ver', 'proyectos.ver', 'proyectos.editar', 'portal.gestionar'],
  contenido: ['marketing.ver', 'marketing.editar', 'asesor.ver', 'contenido.ver', 'contenido.editar', 'contenido.publicar'],
  lectura: ['leads.ver', 'marketing.ver', 'asesor.ver', 'contenido.ver', 'proyectos.ver', 'sistema.ver'],
};

/** Un rol desconocido (por ejemplo, uno viejo que quedó en la base) no puede nada. */
export function puede(rol: string, permiso: Permiso): boolean {
  return ROLES.includes(rol as Rol) && MATRIZ[rol as Rol].includes(permiso);
}

export function permisosDe(rol: string): Permiso[] {
  return ROLES.includes(rol as Rol) ? [...MATRIZ[rol as Rol]] : [];
}
