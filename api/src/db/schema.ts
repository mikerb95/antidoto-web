// Modelo de datos de la fase 1: leads del cotizador, su consentimiento (Ley 1581 de 2012),
// el historial de cada lead y el acceso del equipo al admin con enlace mágico.
// Fechas en milisegundos desde epoch (UTC). Los ids son UUID generados en el Worker.
import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';

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

// Límites de frecuencia (leads y suscripciones por IP, enlaces de acceso por persona). Un
// contador por clave y ventana de una hora que se suma con un solo UPDATE atómico: contar y
// después insertar dejaba pasar ráfagas de peticiones en paralelo.
export const limites = sqliteTable(
  'limites',
  {
    clave: text('clave').notNull(),
    /** Inicio de la ventana (ms, múltiplo de una hora). */
    ventana: integer('ventana').notNull(),
    n: integer('n').notNull(),
  },
  (t) => [primaryKey({ columns: [t.clave, t.ventana] })],
);

export type Lead = typeof leads.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;

// Email marketing ------------------------------------------------------------------------
// Contactos con autorización propia para recibir novedades (separada de la del lead), con doble
// confirmación por correo. El token sirve para confirmar y para darse de baja sin iniciar sesión.

export const ESTADOS_CONTACTO = ['pendiente', 'activo', 'baja', 'rebotado'] as const;
export type EstadoContacto = (typeof ESTADOS_CONTACTO)[number];
/** pie, inicio (sección de la home) y archivo (página de novedades) son formularios del sitio; admin e importado son invitaciones del equipo. */
export const ORIGENES_CONTACTO = ['pie', 'inicio', 'archivo', 'cotizador', 'admin', 'importado'] as const;
export type OrigenContacto = (typeof ORIGENES_CONTACTO)[number];
/** Invitaciones del equipo: la autorización se registra cuando la persona confirma. */
export const INVITADOS: readonly OrigenContacto[] = ['admin', 'importado'];
export const MOTIVOS_BAJA = ['enlace', 'queja', 'rebote', 'admin', 'supresion'] as const;

export const contactos = sqliteTable(
  'contactos',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    nombre: text('nombre'),
    empresa: text('empresa'),
    locale: text('locale', { enum: ['es', 'en'] }).notNull(),
    estado: text('estado', { enum: ESTADOS_CONTACTO }).notNull().default('pendiente'),
    origen: text('origen', { enum: ORIGENES_CONTACTO }).notNull(),
    /** Servicios de interés (ids de SERVICIOS), en JSON. */
    intereses: text('intereses', { mode: 'json' }).$type<ServicioId[]>().notNull().default([]),
    token: text('token').notNull().unique(),
    leadId: text('lead_id'),
    creado: integer('creado').notNull(),
    actualizado: integer('actualizado').notNull(),
    confirmacionEnviada: integer('confirmacion_enviada'),
    confirmado: integer('confirmado'),
    baja: integer('baja'),
    motivoBaja: text('motivo_baja', { enum: MOTIVOS_BAJA }),
    /** Cuándo salió el único recordatorio de confirmar. */
    recordatorio: integer('recordatorio'),
    /** Cuándo salió el correo de bienvenida. */
    bienvenida: integer('bienvenida'),
    /** Pausa elegida en sus preferencias: no recibe campañas hasta esta fecha. */
    pausaHasta: integer('pausa_hasta'),
  },
  (t) => [index('contactos_estado').on(t.estado, t.locale)],
);

export const consentimientosMarketing = sqliteTable(
  'contacto_consentimientos',
  {
    id: text('id').primaryKey(),
    contactoId: text('contacto_id')
      .notNull()
      .references(() => contactos.id),
    version: text('version').notNull(),
    texto: text('texto').notNull(),
    aceptado: integer('aceptado').notNull(),
    /** Cuándo confirmó desde el correo (doble opt-in). */
    confirmado: integer('confirmado'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    revocado: integer('revocado'),
  },
  (t) => [index('ccons_contacto').on(t.contactoId)],
);

export const ESTADOS_CAMPANA = ['borrador', 'programada', 'enviando', 'enviada', 'cancelada'] as const;
export type EstadoCampana = (typeof ESTADOS_CAMPANA)[number];

export const campanas = sqliteTable('campanas', {
  id: text('id').primaryKey(),
  asunto: text('asunto').notNull(),
  preheader: text('preheader'),
  /** Cuerpo en el formato de texto simple de src/marketing/render.ts. */
  cuerpo: text('cuerpo').notNull(),
  locale: text('locale', { enum: ['es', 'en'] }).notNull(),
  /** Si tiene servicios, solo va a contactos interesados en alguno; vacío es para todos. */
  intereses: text('intereses', { mode: 'json' }).$type<ServicioId[]>().notNull().default([]),
  estado: text('estado', { enum: ESTADOS_CAMPANA }).notNull().default('borrador'),
  autor: text('autor').notNull(),
  creada: integer('creada').notNull(),
  actualizada: integer('actualizada').notNull(),
  iniciada: integer('iniciada'),
  terminada: integer('terminada'),
  /** URL pública de la API al enviar: con ella se arman los enlaces de baja. */
  baseUrl: text('base_url'),
  /** Fecha programada de envío (estado "programada"); el cron la arranca a su hora. */
  programada: integer('programada'),
  /** Aparece en el archivo público de novedades del sitio una vez enviada. */
  publica: integer('publica', { mode: 'boolean' }).notNull().default(false),
  /** Prueba A/B de asunto: asunto alternativo, porcentaje de la audiencia que entra a la prueba y horas de espera. */
  asuntoB: text('asunto_b'),
  abMuestra: integer('ab_muestra'),
  abHoras: integer('ab_horas'),
  /** Cuándo se decide la variante ganadora y la ganadora ('a' o 'b'). */
  abDecision: integer('ab_decision'),
  abGanador: text('ab_ganador', { enum: ['a', 'b'] }),
});

/** "espera": parte de la audiencia de una prueba A/B que recibe la variante ganadora. */
export const ESTADOS_ENVIO = ['espera', 'pendiente', 'enviando', 'enviado', 'fallido', 'cancelado'] as const;

export const envios = sqliteTable(
  'envios',
  {
    id: text('id').primaryKey(),
    campanaId: text('campana_id')
      .notNull()
      .references(() => campanas.id),
    contactoId: text('contacto_id')
      .notNull()
      .references(() => contactos.id),
    estado: text('estado', { enum: ESTADOS_ENVIO }).notNull().default('pendiente'),
    intentos: integer('intentos').notNull().default(0),
    lote: text('lote'),
    reclamado: integer('reclamado'),
    resendId: text('resend_id'),
    enviado: integer('enviado'),
    entregado: integer('entregado'),
    abierto: integer('abierto'),
    clic: integer('clic'),
    rebote: integer('rebote'),
    queja: integer('queja'),
    baja: integer('baja'),
    error: text('error'),
    /** Variante de asunto en una prueba A/B. */
    variante: text('variante', { enum: ['a', 'b'] }),
  },
  (t) => [
    uniqueIndex('envios_campana_contacto').on(t.campanaId, t.contactoId),
    index('envios_estado').on(t.estado, t.campanaId),
    index('envios_resend').on(t.resendId),
  ],
);

/** Plantillas de campaña: punto de partida para campañas nuevas. */
export const plantillas = sqliteTable('plantillas', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  asunto: text('asunto').notNull(),
  preheader: text('preheader'),
  cuerpo: text('cuerpo').notNull(),
  locale: text('locale', { enum: ['es', 'en'] }).notNull(),
  autor: text('autor').notNull(),
  creada: integer('creada').notNull(),
});

/**
 * Correos automáticos editables desde la bandeja, por clave e idioma ("bienvenida:es"). Sin fila,
 * sale el texto por defecto de src/marketing/automaticos.ts.
 */
export const automaticos = sqliteTable('automaticos', {
  clave: text('clave').primaryKey(),
  asunto: text('asunto').notNull(),
  preheader: text('preheader'),
  cuerpo: text('cuerpo').notNull(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  actualizado: integer('actualizado').notNull(),
  autor: text('autor'),
});

/**
 * Gasto del asesor con IA por día de Bogotá (USD estimados con el `usage` de la API). Sostiene
 * el tope diario, que falla cerrado: si esta tabla no se puede leer, el asesor no responde.
 */
export const gastoAsesor = sqliteTable('gasto_asesor', {
  /** AAAA-MM-DD en America/Bogota. */
  dia: text('dia').primaryKey(),
  usd: real('usd').notNull(),
});

export type Contacto = typeof contactos.$inferSelect;
export type Campana = typeof campanas.$inferSelect;
export type Envio = typeof envios.$inferSelect;
export type Plantilla = typeof plantillas.$inferSelect;
export type Automatico = typeof automaticos.$inferSelect;
