// Modelo de datos de la fase 1: leads del cotizador, su consentimiento (Ley 1581 de 2012),
// el historial de cada lead y el acceso del equipo al admin con enlace mágico.
// Fechas en milisegundos desde epoch (UTC). Los ids son UUID generados en el Worker.
import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import { ESTADOS, SERVICIOS, ROLES, ESTADOS_CONTACTO, ESTADOS_CAMPANA } from '../dominio';

export { ESTADOS, SERVICIOS, ROLES, ESTADOS_CONTACTO, ESTADOS_CAMPANA };
import type { ServicioId } from '../dominio';
export type { Estado, ServicioId, Rol, EstadoContacto, EstadoCampana } from '../dominio';

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
    /** Conversación del chat con IA que la persona tuvo antes de cotizar (si la autorizó). */
    conversacionId: text('conversacion_id'),
    /** Organización y proyecto, cuando la solicitud se ganó y se volvió proyecto. */
    organizacionId: text('organizacion_id'),
    proyectoId: text('proyecto_id'),

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

export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  nombre: text('nombre').notNull(),
  // En D1 la columna conserva DEFAULT 'equipo' (rol de antes de 0005): cambiarlo exige recrear
  // la tabla, que tiene llaves foráneas. El código siempre envía el rol.
  rol: text('rol', { enum: ROLES }).notNull().default('comercial'),
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
    /** Id público para listar y revocar sesiones sin mostrar el hash. */
    id: text('id'),
    usuarioId: text('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    creada: integer('creada').notNull(),
    expira: integer('expira').notNull(),
    ultimoUso: integer('ultimo_uso').notNull(),
    userAgent: text('user_agent'),
    revocada: integer('revocada'),
  },
  (t) => [index('sesiones_usuario').on(t.usuarioId), uniqueIndex('sesiones_id').on(t.id)],
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

// Bitácora de auditoría del panel: quién hizo qué y cuándo. El detalle nunca lleva datos
// personales (ni nombres, ni correos, ni teléfonos de terceros), solo ids y nombres de campos.
export const auditoria = sqliteTable(
  'auditoria',
  {
    id: text('id').primaryKey(),
    creado: integer('creado').notNull(),
    usuarioId: text('usuario_id'),
    usuarioEmail: text('usuario_email'),
    accion: text('accion').notNull(),
    entidad: text('entidad'),
    entidadId: text('entidad_id'),
    detalle: text('detalle', { mode: 'json' }).$type<Record<string, unknown>>(),
    ipHash: text('ip_hash'),
  },
  (t) => [index('auditoria_creado').on(t.creado), index('auditoria_entidad').on(t.entidad, t.entidadId)],
);

// Ajustes editables desde el panel (tope del chat con IA, interruptores). El valor va en JSON y
// se valida por clave en src/configuracion.ts.
export const configuracion = sqliteTable('configuracion', {
  clave: text('clave').primaryKey(),
  valor: text('valor', { mode: 'json' }).notNull(),
  actualizado: integer('actualizado').notNull(),
  autor: text('autor'),
});

export type Lead = typeof leads.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;

// Email marketing ------------------------------------------------------------------------
// Contactos con autorización propia para recibir novedades (separada de la del lead), con doble
// confirmación por correo. El token sirve para confirmar y para darse de baja sin iniciar sesión.

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
  // Contadores del día, sin datos personales: sobreviven al borrado de las conversaciones.
  conversaciones: integer('conversaciones').notNull().default(0),
  preguntas: integer('preguntas').notNull().default(0),
  /** Conversaciones que terminaron en WhatsApp o en el cotizador (la primera vez de cada una). */
  derivaciones: integer('derivaciones').notNull().default(0),
  guardia: integer('guardia').notNull().default(0),
});

// Conversaciones del chat con IA (Ley 1581: aviso en el chat, 90 días y borrado a pedido).
// El id lo genera el navegador; cada pregunta guarda solo su turno (la pregunta y la respuesta),
// nunca reescribe lo anterior con el historial que reenvía el navegador. Los teléfonos y correos
// llegan ya tapados (taparDatos).
export const conversaciones = sqliteTable(
  'conversaciones',
  {
    id: text('id').primaryKey(),
    creada: integer('creada').notNull(),
    actualizada: integer('actualizada').notNull(),
    locale: text('locale', { enum: ['es', 'en'] }).notNull(),
    paginaInicial: text('pagina_inicial'),
    paginaUltima: text('pagina_ultima'),
    /** panel (burbuja del sitio) o facilitador (mundo pixel). */
    origen: text('origen'),
    servicio: text('servicio', { enum: SERVICIOS }),
    preguntas: integer('preguntas').notNull().default(0),
    /** Primera vez que preparó WhatsApp o mostró el cotizador. */
    whatsapp: integer('whatsapp'),
    cotizador: integer('cotizador'),
    guardia: integer('guardia').notNull().default(0),
    negativa: integer('negativa').notNull().default(0),
    vueltas: integer('vueltas').notNull().default(0),
    tokensEntrada: integer('tokens_entrada').notNull().default(0),
    tokensSalida: integer('tokens_salida').notNull().default(0),
    cacheLectura: integer('cache_lectura').notNull().default(0),
    cacheEscritura: integer('cache_escritura').notNull().default(0),
    costoUsd: real('costo_usd').notNull().default(0),
    ipHash: text('ip_hash'),
    leadId: text('lead_id'),
    expira: integer('expira').notNull(),
  },
  (t) => [index('conv_actualizada').on(t.actualizada), index('conv_expira').on(t.expira), index('conv_servicio').on(t.servicio, t.actualizada)],
);

export const mensajesConversacion = sqliteTable(
  'conversacion_mensajes',
  {
    id: text('id').primaryKey(),
    conversacionId: text('conversacion_id')
      .notNull()
      .references(() => conversaciones.id, { onDelete: 'cascade' }),
    /** Posición en la conversación (0 es la primera pregunta). */
    n: integer('n').notNull(),
    rol: text('rol', { enum: ['usuario', 'asesor'] }).notNull(),
    texto: text('texto').notNull(),
    creado: integer('creado').notNull(),
    herramientas: text('herramientas', { mode: 'json' }).$type<string[]>(),
    /** Mensaje de WhatsApp que armó el servidor en esa respuesta. */
    whatsapp: text('whatsapp'),
    respaldo: text('respaldo'),
    /** Tema de la pregunta (src/asesor/temas.ts). */
    tema: text('tema'),
    tokensEntrada: integer('tokens_entrada'),
    tokensSalida: integer('tokens_salida'),
    costoUsd: real('costo_usd'),
  },
  (t) => [uniqueIndex('convmsg_n').on(t.conversacionId, t.n)],
);
export type Conversacion = typeof conversaciones.$inferSelect;
export type MensajeConversacion = typeof mensajesConversacion.$inferSelect;

export type Contacto = typeof contactos.$inferSelect;
export type Campana = typeof campanas.$inferSelect;
export type Envio = typeof envios.$inferSelect;
export type Plantilla = typeof plantillas.$inferSelect;
export type Automatico = typeof automaticos.$inferSelect;

// Contenido del sitio editable desde el panel (src/contenido/esquemas.ts): blog, casos, vacantes,
// preguntas frecuentes y clientes. `datos` y `textos` son la copia de trabajo; `publicada` es la
// foto que sirve /v1/contenido y lee el build del sitio. Editar algo publicado no cambia el sitio
// hasta volver a publicarlo.
export const contenido = sqliteTable(
  'contenido',
  {
    id: text('id').primaryKey(),
    tipo: text('tipo').notNull(),
    clave: text('clave').notNull(),
    datos: text('datos', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    textos: text('textos', { mode: 'json' }).$type<Record<string, Record<string, unknown>>>().notNull(),
    version: integer('version').notNull().default(1),
    publicada: text('publicada', { mode: 'json' }).$type<{ datos: Record<string, unknown>; textos: Record<string, Record<string, unknown>>; version: number } | null>(),
    /** Último cambio visible en el sitio (publicar, despublicar o archivar algo publicado). Null: nunca salió. */
    publicadaEn: integer('publicada_en'),
    archivada: integer('archivada'),
    creado: integer('creado').notNull(),
    actualizado: integer('actualizado').notNull(),
    autor: text('autor').notNull(),
  },
  (t) => [uniqueIndex('contenido_tipo_clave').on(t.tipo, t.clave), index('contenido_tipo_act').on(t.tipo, t.actualizado)],
);

/** Versiones anteriores de cada entrada (las últimas 20), para el historial y restaurar. */
export const versionesContenido = sqliteTable(
  'contenido_versiones',
  {
    id: text('id').primaryKey(),
    contenidoId: text('contenido_id')
      .notNull()
      .references(() => contenido.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    datos: text('datos', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    textos: text('textos', { mode: 'json' }).$type<Record<string, Record<string, unknown>>>().notNull(),
    creado: integer('creado').notNull(),
    autor: text('autor').notNull(),
  },
  (t) => [index('versiones_contenido').on(t.contenidoId, t.version)],
);

/** Imágenes subidas al bucket público MEDIOS (R2). */
export const medios = sqliteTable(
  'medios',
  {
    id: text('id').primaryKey(),
    claveR2: text('clave_r2').notNull(),
    nombre: text('nombre').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    ancho: integer('ancho').notNull(),
    alto: integer('alto').notNull(),
    creado: integer('creado').notNull(),
    autor: text('autor').notNull(),
  },
  (t) => [index('medios_creado').on(t.creado)],
);

/** Pedidos de publicar el sitio: el Worker dispara el workflow de GitHub que lo construye. */
export const publicaciones = sqliteTable(
  'publicaciones',
  {
    id: text('id').primaryKey(),
    solicitada: integer('solicitada').notNull(),
    autor: text('autor').notNull(),
    destino: text('destino', { enum: ['vista_previa', 'produccion'] }).notNull(),
    estado: text('estado', { enum: ['pendiente', 'disparada', 'fallida', 'sin_configurar'] }).notNull(),
    intentos: integer('intentos').notNull().default(0),
    disparada: integer('disparada'),
    runUrl: text('run_url'),
    error: text('error'),
  },
  (t) => [index('publicaciones_estado').on(t.estado, t.solicitada)],
);
export type Contenido = typeof contenido.$inferSelect;
export type Medio = typeof medios.$inferSelect;
export type Publicacion = typeof publicaciones.$inferSelect;

// Proyectos ---------------------------------------------------------------------------
// Una solicitud ganada se vuelve proyecto de una organización. Lo que el portal de clientes deja
// ver lleva visible_cliente. Las empresas, actividades y resultados de la plataforma de misiones
// no se duplican aquí: el proyecto solo guarda un enlace (mision_url).

export const ESTADOS_PROYECTO = ['planeado', 'en_curso', 'en_pausa', 'entregado', 'cerrado', 'cancelado'] as const;
export const ESTADOS_ETAPA = ['pendiente', 'en_curso', 'hecha'] as const;
export const ESTADOS_ENTREGABLE = ['borrador', 'en_revision', 'aprobado', 'cambios'] as const;

export const organizaciones = sqliteTable(
  'organizaciones',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    nit: text('nit'),
    sector: text('sector'),
    sitio: text('sitio'),
    notas: text('notas'),
    creado: integer('creado').notNull(),
    actualizado: integer('actualizado').notNull(),
  },
  (t) => [index('org_nombre').on(t.nombre)],
);

export const contactosCliente = sqliteTable(
  'contactos_cliente',
  {
    id: text('id').primaryKey(),
    organizacionId: text('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    nombre: text('nombre'),
    email: text('email'),
    telefono: text('telefono'),
    cargo: text('cargo'),
    creado: integer('creado').notNull(),
    anonimizado: integer('anonimizado'),
  },
  (t) => [index('ccli_org').on(t.organizacionId), index('ccli_email').on(t.email)],
);

export const proyectos = sqliteTable(
  'proyectos',
  {
    id: text('id').primaryKey(),
    codigo: text('codigo').notNull().unique(),
    organizacionId: text('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    leadId: text('lead_id'),
    nombre: text('nombre').notNull(),
    linea: text('linea', { enum: SERVICIOS }).notNull(),
    estado: text('estado', { enum: ESTADOS_PROYECTO }).notNull().default('planeado'),
    responsableId: text('responsable_id'),
    /** AAAA-MM-DD */
    inicio: text('inicio'),
    entrega: text('entrega'),
    valor: integer('valor'),
    notas: text('notas'),
    misionUrl: text('mision_url'),
    creado: integer('creado').notNull(),
    actualizado: integer('actualizado').notNull(),
  },
  (t) => [index('proy_estado').on(t.estado, t.actualizado), index('proy_org').on(t.organizacionId)],
);

export const etapas = sqliteTable(
  'proyecto_etapas',
  {
    id: text('id').primaryKey(),
    proyectoId: text('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    orden: integer('orden').notNull(),
    estado: text('estado', { enum: ESTADOS_ETAPA }).notNull().default('pendiente'),
    fecha: text('fecha'),
  },
  (t) => [index('etapas_proy').on(t.proyectoId, t.orden)],
);

export const tareas = sqliteTable(
  'proyecto_tareas',
  {
    id: text('id').primaryKey(),
    proyectoId: text('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    etapaId: text('etapa_id'),
    titulo: text('titulo').notNull(),
    responsableId: text('responsable_id'),
    vence: text('vence'),
    hecha: integer('hecha'),
    orden: integer('orden').notNull().default(0),
    visibleCliente: integer('visible_cliente', { mode: 'boolean' }).notNull().default(false),
    creado: integer('creado').notNull(),
  },
  (t) => [index('tareas_proy').on(t.proyectoId)],
);

export const entregables = sqliteTable(
  'entregables',
  {
    id: text('id').primaryKey(),
    proyectoId: text('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    etapaId: text('etapa_id'),
    titulo: text('titulo').notNull(),
    descripcion: text('descripcion'),
    estado: text('estado', { enum: ESTADOS_ENTREGABLE }).notNull().default('borrador'),
    vence: text('vence'),
    visibleCliente: integer('visible_cliente', { mode: 'boolean' }).notNull().default(false),
    version: integer('version').notNull().default(1),
    aprobadoPor: text('aprobado_por'),
    aprobadoEn: integer('aprobado_en'),
    creado: integer('creado').notNull(),
    actualizado: integer('actualizado').notNull(),
  },
  (t) => [index('entregables_proy').on(t.proyectoId)],
);

/** Archivos de los entregables, en el bucket privado ARCHIVOS: solo se descargan con sesión. */
export const archivosEntregable = sqliteTable(
  'entregable_archivos',
  {
    id: text('id').primaryKey(),
    entregableId: text('entregable_id')
      .notNull()
      .references(() => entregables.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    claveR2: text('clave_r2').notNull(),
    nombre: text('nombre').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    subido: integer('subido').notNull(),
    autor: text('autor').notNull(),
  },
  (t) => [index('archivos_entregable').on(t.entregableId)],
);

export const bitacora = sqliteTable(
  'proyecto_bitacora',
  {
    id: text('id').primaryKey(),
    proyectoId: text('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    creado: integer('creado').notNull(),
    autorTipo: text('autor_tipo', { enum: ['equipo', 'cliente', 'sistema'] }).notNull(),
    autor: text('autor'),
    tipo: text('tipo').notNull(),
    texto: text('texto'),
    visibleCliente: integer('visible_cliente', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('bitacora_proy').on(t.proyectoId, t.creado)],
);
export type Organizacion = typeof organizaciones.$inferSelect;
export type Proyecto = typeof proyectos.$inferSelect;
export type Entregable = typeof entregables.$inferSelect;

// Portal de proyectos: acceso de los clientes con enlace mágico, separado del equipo (otra tabla,
// otra cookie). Un usuario de cliente ve solo los proyectos de su organización y solo lo marcado
// como visible para el cliente.
export const usuariosCliente = sqliteTable(
  'usuarios_cliente',
  {
    id: text('id').primaryKey(),
    organizacionId: text('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    contactoId: text('contacto_id'),
    email: text('email').notNull().unique(),
    nombre: text('nombre'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    creado: integer('creado').notNull(),
    ultimoAcceso: integer('ultimo_acceso'),
  },
  (t) => [index('ucli_org').on(t.organizacionId)],
);

export const enlacesCliente = sqliteTable('enlaces_cliente', {
  hash: text('hash').primaryKey(),
  usuarioId: text('usuario_id')
    .notNull()
    .references(() => usuariosCliente.id),
  creado: integer('creado').notNull(),
  expira: integer('expira').notNull(),
  usado: integer('usado'),
});

export const sesionesCliente = sqliteTable(
  'sesiones_cliente',
  {
    hash: text('hash').primaryKey(),
    usuarioId: text('usuario_id')
      .notNull()
      .references(() => usuariosCliente.id),
    creada: integer('creada').notNull(),
    expira: integer('expira').notNull(),
    ultimoUso: integer('ultimo_uso').notNull(),
    userAgent: text('user_agent'),
    revocada: integer('revocada'),
  },
  (t) => [index('sesiones_cliente_usuario').on(t.usuarioId)],
);
export type UsuarioCliente = typeof usuariosCliente.$inferSelect;
