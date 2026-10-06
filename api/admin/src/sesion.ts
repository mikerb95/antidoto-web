// Quién está en el panel y qué puede hacer. Se carga al arrancar (/admin/api/yo); los permisos
// vienen de la API, que es la que decide de verdad.
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Permiso } from '@api/permisos';
import type { Rol } from '@api/dominio';

export interface Yo {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  permisos: Permiso[];
}

export const SesionCtx = createContext<Yo | null>(null);

export function useYo(): Yo {
  const yo = useContext(SesionCtx);
  if (!yo) throw new Error('sin sesión');
  return yo;
}

export function usePuede(): (p: Permiso) => boolean {
  const yo = useYo();
  return (p) => yo.permisos.includes(p);
}
