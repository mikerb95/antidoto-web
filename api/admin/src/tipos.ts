// Formas de las respuestas de la API. Los tipos de filas salen del esquema (import type: no
// arrastran drizzle al bundle).
import type { Lead as FilaLead, Contacto as FilaContacto, Campana as FilaCampana, Usuario } from '@api/db/schema';
import type { Estado, EstadoContacto } from '@api/dominio';

export type Lead = Omit<FilaLead, 'ipHash'>;

export interface Evento {
  id: string;
  creado: number;
  tipo: 'creado' | 'estado' | 'nota' | 'edicion' | 'anonimizado';
  detalle: string | null;
  autor: string | null;
}

export interface Suscripcion {
  id: string;
  estado: EstadoContacto;
  intereses: string[];
  pausaHasta: number | null;
  recibidas: number;
  abiertas: number;
  clics: number;
  ultimaApertura: number | null;
  ultimoClic: number | null;
}

export interface DetalleLead {
  lead: Lead;
  eventos: Evento[];
  consentimientos: { version: string; texto: string; aceptado: number; revocado: number | null }[];
  suscripcion: Suscripcion | null;
}

export interface Pagina<K extends string, T> {
  total: number;
  pagina: number;
  porPagina: number;
  [clave: string]: unknown;
}
export type ListaLeads = Pagina<'leads', Lead> & { leads: Lead[] };

export interface MetricasLeads {
  dias: number;
  total: number;
  porEstado: Record<Estado, number>;
  tasaCierre: number | null;
  horasPrimeraRespuesta: number | null;
  porServicio: { clave: string; n: number; ganados: number; valorGanado: number }[];
  porOrigen: { clave: string; n: number }[];
  porMes: { clave: string; n: number }[];
}

export interface MetricasMarketing {
  semanas: number[];
  altas: number[];
  confirmados: number[];
  bajas: number[];
  conteos: Record<EstadoContacto, number>;
  pausados: number;
  origenes: { origen: string; total: number; confirmados: number }[];
  campanas: { enviados: number; abiertos: number; clics: number };
}

export type Contacto = FilaContacto;
export type ListaContactos = { contactos: Contacto[]; conteos: Record<EstadoContacto, number>; total: number; pagina: number; porPagina: number };
export interface DetalleContacto {
  contacto: Contacto;
  consentimientos: { version: string; texto: string; aceptado: number; confirmado: number | null; revocado: number | null }[];
  envios: { campana: string; estado: string; enviado: number | null; abierto: number | null; clic: number | null }[];
}

export interface Stats {
  destinatarios: number;
  enviados: number;
  pendientes: number;
  fallidos: number;
  entregados: number;
  abiertos: number;
  clics: number;
  bajas: number;
  rebotes: number;
  quejas: number;
}
export type Campana = FilaCampana & { stats?: Stats };
export interface DetalleCampana {
  campana: Campana;
  audiencia: number;
  stats?: Stats;
  variantes?: { variante: 'a' | 'b'; enviados: number; abiertos: number; clics: number }[];
}
export interface Plantilla {
  id: string;
  nombre: string;
  asunto: string;
  preheader: string | null;
  cuerpo: string;
  locale: 'es' | 'en';
}
export interface Automatico {
  clave: string;
  locale: 'es' | 'en';
  asunto: string;
  preheader: string | null;
  cuerpo: string;
  activo: boolean;
  personalizado: boolean;
}

export type { Usuario };

export interface RegistroAuditoria {
  id: string;
  creado: number;
  usuarioId: string | null;
  usuarioEmail: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  detalle: Record<string, unknown> | null;
}
