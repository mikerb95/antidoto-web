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
  /** Sal para el hash de IP. Sin ella se usa una fija y el hash es menos privado. */
  SAL_IP?: string;
}
