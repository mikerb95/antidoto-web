export interface Env {
  DB: D1Database;
  ENTORNO: string;
  ORIGENES: string;
  MAIL_FROM: string;
  MAIL_EQUIPO: string;
  HORAS_SEGUIMIENTO: string;
  /** URL pública del Worker; si falta se toma de la petición. El cron la necesita para los enlaces. */
  APP_URL?: string;
  /** Sin esta clave los correos no salen (se registran en el log) y todo lo demás sigue. */
  RESEND_API_KEY?: string;
  /** Remitente de las campañas; si falta se usa MAIL_FROM. */
  MAIL_FROM_NOVEDADES?: string;
  /** Secreto de firma del webhook de Resend (whsec_...). Sin él, el webhook rechaza todo. */
  RESEND_WEBHOOK_SECRET?: string;
  /** Sitio público (sin barra final): las páginas de confirmación, baja y preferencias viven ahí. */
  SITIO_URL?: string;
  /** Razón social y domicilio para el pie de las campañas; sin ella va una línea genérica. */
  MAIL_DIRECCION?: string;
  /** Sal para el hash de IP. Sin ella se usa una fija y el hash es menos privado. */
  SAL_IP?: string;
  /** Clave de la API de Claude para el chat con IA. Sin ella el chat no se ofrece (solo WhatsApp). */
  ANTHROPIC_API_KEY?: string;
  /** Solo con ENTORNO=local: otra URL para la API de mensajes (un Claude falso para probar el chat). */
  ANTHROPIC_URL?: string;
  /** Tope de gasto diario del chat con IA, en USD. Por defecto, 1. */
  ASESOR_TOPE_DIARIO_USD?: string;
}
