// Modelo de datos de la fase 1: leads del cotizador, su consentimiento (Ley 1581 de 2012),
// el historial de cada lead y el acceso del equipo al admin con enlace mágico.
// Fechas en milisegundos desde epoch (UTC). Los ids son UUID generados en el Worker.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const ESTADOS = ['nuevo', 'contactado', 'cotizado', 'ganado', 'perdido'] as const;
export type Estado = (typeof ESTADOS)[number];

export const SERVICIOS = ['formaciones', 'audiovisual', 'catering', 'diseno'] as const;
export type ServicioId = (typeof SERVICIOS)[number];

export const leads = sqliteTable(
  'leads',
  {
    id: text('id').primaryKey(),
    creado: integer('creado').notNull(),
    actualizado: integer('actualizado').notNull(),
    estado: text('estado', { enum: ESTADOS }).notNull().default('nuevo'),

    // Lo que pidió en el cotizador.
    servicio: text('servicio', { enum: SERVICIOS }).notNull(),
    tipoOrganizacion: text('tipo_organizacion'),
    fecha: text('fecha'), // AAAA-MM
    personas: integer('personas'),
    ciudad: text('ciudad'),
    mensaje: text('mensaje'),

    // Contacto. Se anonimiza al atender una solicitud de supresión.
    nombre: text('nombre'),
    empresa: text('empresa'),
    email: text('email'),
    telefono: text('telefono'),

    // De dónde vino.
    locale: text('locale', { enum: ['es', 'en'] }).notNull(),
    pagina: text('pagina'),
    referente: text('referente'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),

    // Gestión comercial.
    valorEstimado: integer('valor_estimado'), // COP, sin decimales
    motivoPerdida: text('motivo_perdida'),
    notas: text('notas'),
    primeraRespuesta: integer('primera_respuesta'), // cuándo salió de "nuevo"
    avisoSeguimiento: integer('aviso_seguimiento'), // cuándo se avisó que seguía sin respuesta
    anonimizado: integer('anonimizado'),

    ipHash: text('ip_hash'),
  },
  (t) => [index('leads_estado_creado').on(t.estado, t.creado), index('leads_ip_creado').on(t.ipHash, t.creado)],
);

// Prueba de la autorización: qué texto aceptó, cuándo y desde dónde. Se conserva aunque el
// lead se anonimice, sin datos personales más allá del hash de IP.
export const consentimientos = sqliteTable('consentimientos', {
  id: text('id').primaryKey(),
  leadId: text('lead_id')
    .notNull()
    .references(() => leads.id),
  version: text('version').notNull(),
  texto: text('texto').notNull(),
  aceptado: integer('aceptado').notNull(),
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  revocado: integer('revocado'),
});

export const TIPOS_EVENTO = ['creado', 'estado', 'nota', 'edicion', 'anonimizado'] as const;

export const eventos = sqliteTable(
  'lead_eventos',
  {
    id: text('id').primaryKey(),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    creado: integer('creado').notNull(),
    tipo: text('tipo', { enum: TIPOS_EVENTO }).notNull(),
    detalle: text('detalle'),
    autor: text('autor'), // email del usuario del equipo, o null si fue el sistema
  },
  (t) => [index('eventos_lead').on(t.leadId, t.creado)],
);

export const ROLES = ['admin', 'equipo'] as const;

export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  nombre: text('nombre').notNull(),
  rol: text('rol', { enum: ROLES }).notNull().default('equipo'),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  creado: integer('creado').notNull(),
});

// Enlaces mágicos: solo se guarda el hash del token, de un solo uso y con vencimiento corto.
export const enlaces = sqliteTable('enlaces_acceso', {
  hash: text('hash').primaryKey(),
  usuarioId: text('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  creado: integer('creado').notNull(),
  expira: integer('expira').notNull(),
  usado: integer('usado'),
});

// Sesiones revocables: la cookie lleva el token y aquí queda su hash.
export const sesiones = sqliteTable(
  'sesiones',
  {
    hash: text('hash').primaryKey(),
    usuarioId: text('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    creada: integer('creada').notNull(),
    expira: integer('expira').notNull(),
    ultimoUso: integer('ultimo_uso').notNull(),
    userAgent: text('user_agent'),
    revocada: integer('revocada'),
  },
  (t) => [index('sesiones_usuario').on(t.usuarioId)],
);

export type Lead = typeof leads.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
