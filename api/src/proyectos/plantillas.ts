// Etapas con las que arranca un proyecto según su línea de servicio. Son un punto de partida: el
// equipo las cambia en cada proyecto. Siguen "Cómo trabajamos" del sitio (diagnóstico, propuesta,
// producción, entrega) con el oficio de cada línea.
//
// Módulo PURO.
import type { ServicioId } from '../dominio';

export const PLANTILLAS: Record<ServicioId, readonly string[]> = {
  formaciones: ['Diagnóstico con el cliente', 'Diseño de la experiencia', 'Logística y materiales', 'Sesión', 'Informe y cierre'],
  audiovisual: ['Brief y guion', 'Preproducción', 'Rodaje', 'Edición y revisiones', 'Entrega final'],
  catering: ['Menú y cantidades', 'Confirmación de detalles', 'Servicio del evento', 'Cierre'],
  diseno: ['Brief', 'Propuestas de diseño', 'Ajustes', 'Producción', 'Entrega'],
  ia: ['Diagnóstico de necesidades', 'Programa a la medida', 'Sesiones', 'Seguimiento y cierre'],
};

/** Código legible del proyecto: P-2026-007. */
export function codigoProyecto(anio: number, n: number): string {
  return `P-${anio}-${String(n).padStart(3, '0')}`;
}
