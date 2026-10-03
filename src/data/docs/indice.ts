export interface PaginaDocs {
  ruta: string;
  titulo: string;
  resumen: string;
  grupo: 'Planeación' | 'Análisis' | 'Contexto';
}

export const PAGINAS_DOCS: PaginaDocs[] = [
  { ruta: '/docs/kanban/', titulo: 'Kanban de iteraciones', resumen: 'Qué se hizo en cada iteración, qué está en curso, qué sigue y qué espera al cliente.', grupo: 'Planeación' },
  { ruta: '/docs/requerimientos-funcionales/', titulo: 'Requerimientos funcionales', resumen: 'Qué debe hacer el sistema, con su estado y la evidencia en el código.', grupo: 'Análisis' },
  { ruta: '/docs/requerimientos-no-funcionales/', titulo: 'Requerimientos no funcionales', resumen: 'Rendimiento, accesibilidad, seguridad, fiabilidad y cumplimiento, con criterios medibles.', grupo: 'Análisis' },
  { ruta: '/docs/casos-de-uso-extendidos/', titulo: 'Casos de uso extendidos', resumen: 'Flujos principales y alternos de cada actor.', grupo: 'Análisis' },
  { ruta: '/docs/historias-de-usuario/', titulo: 'Historias de usuario', resumen: 'Qué necesita cada persona y para qué, con criterios de aceptación.', grupo: 'Análisis' },
  { ruta: '/docs/fuentes/', titulo: 'Fuentes e investigaciones', resumen: 'La investigación detrás de las decisiones, como la del above the fold que cambió el hero.', grupo: 'Contexto' },
];
