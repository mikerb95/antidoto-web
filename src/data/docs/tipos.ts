// Tipos de la documentación del proyecto (/docs/). Todo vive como datos tipados en
// src/data/docs/: las páginas solo los pintan, y tests/docs.test.ts valida las referencias.

export type Estado = 'implementado' | 'parcial' | 'pendiente';

export const ESTADOS: Record<Estado, string> = {
  implementado: 'Implementado',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
};

/** Prioridad MoSCoW. */
export type Prioridad = 'debe' | 'deberia' | 'podria';

export const PRIORIDADES: Record<Prioridad, string> = {
  debe: 'Debe',
  deberia: 'Debería',
  podria: 'Podría',
};

export interface Requisito {
  id: string;
  titulo: string;
  descripcion: string;
  estado: Estado;
  prioridad: Prioridad;
  /** Rutas del repo que lo demuestran. El test comprueba que existan. */
  evidencia: string[];
  /** Nota aclaratoria cuando el estado no es obvio (qué falta, por qué). */
  nota?: string;
}

export interface RequisitoFuncional extends Requisito {
  modulo: string;
}

export interface RequisitoNoFuncional extends Requisito {
  /** Característica de calidad, según ISO/IEC 25010. */
  calidad: string;
  /** Criterio medible de aceptación. */
  criterio: string;
}

export interface CasoDeUso {
  id: string;
  nombre: string;
  actor: string;
  objetivo: string;
  precondiciones: string[];
  disparador: string;
  flujoPrincipal: string[];
  flujosAlternos: { id: string; condicion: string; pasos: string[] }[];
  postcondiciones: string[];
  reglas: string[];
  requisitos: string[];
  estado: Estado;
}

export interface HistoriaUsuario {
  id: string;
  actor: string;
  quiero: string;
  para: string;
  criterios: string[];
  iteracion: string;
  estado: Estado;
  requisitos: string[];
  casos: string[];
}

export type Columna = 'hecho' | 'curso' | 'pendiente' | 'cliente';

export const COLUMNAS: Record<Columna, { titulo: string; ayuda: string }> = {
  hecho: { titulo: 'Hecho', ayuda: 'Entregado y verificado' },
  curso: { titulo: 'En curso', ayuda: 'Trabajo abierto hoy' },
  pendiente: { titulo: 'Pendiente', ayuda: 'Decidido, sin empezar' },
  cliente: { titulo: 'Espera al cliente', ayuda: 'Bloqueado por contenido o datos del cliente' },
};

export interface Iteracion {
  id: string;
  nombre: string;
  desde: string;
  hasta: string;
  /** Cantidad de commits del periodo en el historial de git. */
  commits: number;
  /** Pull requests del periodo, si los hubo. */
  prs?: string[];
  objetivo: string;
}

export interface Tarjeta {
  id: string;
  titulo: string;
  detalle: string;
  columna: Columna;
  /** Iteración en la que se hizo (o en la que se hará). */
  iteracion: string;
  historias?: string[];
}

export type TipoFuente = 'estudio' | 'articulo' | 'blog' | 'norma' | 'interna';

export const TIPOS_FUENTE: Record<TipoFuente, string> = {
  estudio: 'Estudio o investigación',
  articulo: 'Artículo de referencia',
  blog: 'Blog de marketing (rigor menor)',
  norma: 'Norma o estándar',
  interna: 'Documento interno del proyecto',
};

export interface Fuente {
  titulo: string;
  autor: string;
  tipo: TipoFuente;
  /** Enlace externo o ruta del repo (fuentes internas). */
  enlace: string;
  /** Qué dice, en una o dos frases. */
  hallazgo: string;
}

export interface Investigacion {
  id: string;
  titulo: string;
  fecha: string;
  pregunta: string;
  resumen: string;
  diagnostico?: string[];
  fuentes: Fuente[];
  decisiones: { decision: string; porque: string; donde: string }[];
  limites: string[];
}
