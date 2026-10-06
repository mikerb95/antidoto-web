// Mapa de pantallas del panel: ruta, sección de la barra lateral y permiso para verla.
import type { Permiso } from '@api/permisos';
import { perezoso, type Vista } from './perezoso';

export interface Ruta {
  patron: RegExp;
  vista: Vista;
  /** Clave de la entrada de la barra lateral que queda marcada. */
  nav: string;
  permiso?: Permiso;
  titulo: string;
}

const UUID = '([0-9a-f-]{36})';
const r = (s: string) => new RegExp(`^/admin/${s}/?$`);

export const RUTAS: Ruta[] = [
  { patron: r(''), vista: perezoso(() => import('./vistas/Inicio')), nav: 'inicio', titulo: 'Inicio' },
  { patron: r(`solicitudes(?:/${UUID})?`), vista: perezoso(() => import('./vistas/Solicitudes')), nav: 'solicitudes', permiso: 'leads.ver', titulo: 'Solicitudes' },
  { patron: r('metricas'), vista: perezoso(() => import('./vistas/Metricas')), nav: 'metricas', permiso: 'leads.ver', titulo: 'Métricas' },
  { patron: r('campanas'), vista: perezoso(() => import('./vistas/Campanas')), nav: 'campanas', permiso: 'marketing.ver', titulo: 'Campañas' },
  { patron: r(`campanas/(nueva|${UUID.slice(1, -1)})`), vista: perezoso(() => import('./vistas/Campana')), nav: 'campanas', permiso: 'marketing.ver', titulo: 'Campaña' },
  { patron: r('automaticos/([a-z]+:(?:es|en))'), vista: perezoso(() => import('./vistas/Automatico')), nav: 'campanas', permiso: 'marketing.ver', titulo: 'Correo automático' },
  { patron: r(`contactos(?:/${UUID})?`), vista: perezoso(() => import('./vistas/Contactos')), nav: 'contactos', permiso: 'marketing.ver', titulo: 'Contactos' },
  { patron: r('equipo'), vista: perezoso(() => import('./vistas/Equipo')), nav: 'equipo', titulo: 'Equipo' },
  { patron: r('cuenta'), vista: perezoso(() => import('./vistas/Cuenta')), nav: 'cuenta', titulo: 'Mi cuenta' },
  { patron: r('ajustes'), vista: perezoso(() => import('./vistas/Ajustes')), nav: 'ajustes', titulo: 'Ajustes' },
  { patron: r('auditoria'), vista: perezoso(() => import('./vistas/Auditoria')), nav: 'auditoria', permiso: 'auditoria.ver', titulo: 'Auditoría' },
];

export interface EntradaNav {
  clave: string;
  texto: string;
  href: string;
  permiso?: Permiso;
  icono: string;
}

/** Barra lateral por grupos. Los iconos son trazos SVG de 20x20 (ver app.tsx). */
export const NAV: { grupo: string; entradas: EntradaNav[] }[] = [
  {
    grupo: 'Operación',
    entradas: [
      { clave: 'inicio', texto: 'Inicio', href: '/admin/', icono: 'inicio' },
      { clave: 'solicitudes', texto: 'Solicitudes', href: '/admin/solicitudes', permiso: 'leads.ver', icono: 'bandeja' },
    ],
  },
  {
    grupo: 'Novedades',
    entradas: [
      { clave: 'campanas', texto: 'Campañas', href: '/admin/campanas', permiso: 'marketing.ver', icono: 'correo' },
      { clave: 'contactos', texto: 'Contactos', href: '/admin/contactos', permiso: 'marketing.ver', icono: 'personas' },
    ],
  },
  {
    grupo: 'Análisis',
    entradas: [{ clave: 'metricas', texto: 'Métricas', href: '/admin/metricas', permiso: 'leads.ver', icono: 'grafica' }],
  },
  {
    grupo: 'Administración',
    entradas: [
      { clave: 'equipo', texto: 'Equipo', href: '/admin/equipo', icono: 'equipo' },
      { clave: 'ajustes', texto: 'Ajustes', href: '/admin/ajustes', icono: 'ajustes' },
      { clave: 'auditoria', texto: 'Auditoría', href: '/admin/auditoria', permiso: 'auditoria.ver', icono: 'auditoria' },
    ],
  },
];
