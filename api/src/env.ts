import type { Client } from '@libsql/client';

export interface Env {
  /** Base de datos: Turso (libSQL) en Vercel, un archivo SQLite en local y en las pruebas. */
  DB: Client;
  /** Archivos del panel (dist-admin/). Falta en las pruebas que no lo inyectan. */
  ASSETS?: ArchivosPanel;
  ENTORNO: string;
  ORIGENES: string;
  MAIL_FROM: string;
  MAIL_EQUIPO: string;
  HORAS_SEGUIMIENTO: string;
  /** URL pública de la API; si falta se toma de la petición. Los correos que salen fuera de una petición la necesitan para los enlaces. */
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
  /** Tope de gasto diario del chat con IA, en USD. Por defecto, 1. Desde el panel se puede fijar otro. */
  ASESOR_TOPE_DIARIO_USD?: string;
  /** Imágenes del contenido del sitio (Vercel Blob, medios/). Sin él, el panel no sube imágenes. */
  MEDIOS?: Almacen;
  /** Archivos PRIVADOS de los entregables de proyectos (Blob, archivos/; solo se descargan con sesión). */
  ARCHIVOS?: Almacen;
  /**
   * Los archivos de entregables suben directo del navegador a Blob, porque una función de Vercel
   * no recibe cuerpos de más de 4,5 MB. Sin Blob (local, pruebas) pasan por la API.
   */
  SUBIDA?: SubidaDirecta;
  /** Token de GitHub (fine-grained, Actions: Read and write) para publicar el sitio desde el panel. */
  GITHUB_DISPATCH_TOKEN?: string;
  /** Repositorio del sitio, "dueño/nombre". */
  GITHUB_REPO?: string;
  /** Rama que se construye al publicar. Por defecto, main. */
  GITHUB_REF?: string;
  /** Plataforma de misiones (proyecto aparte), sin barra final. Con MISIONES_SECRETO activa la sección Misiones del panel. */
  MISIONES_URL?: string;
  /** Secreto compartido con la plataforma de misiones (PANEL_SHARED_SECRET allá), de 32 caracteres o más. */
  MISIONES_SECRETO?: string;
}

/** Subida directa del navegador al almacenamiento (Vercel Blob), con una URL firmada para una sola clave. */
export interface SubidaDirecta {
  /**
   * Responde el pedido de URL firmada del cliente de Blob (`uploadPresigned`). `permitida` decide si
   * la clave que pide el navegador es válida; si no, lanza.
   */
  firmar(req: Request, cuerpo: unknown, prefijo: 'archivos', permitida: (clave: string) => boolean, maxBytes: number): Promise<unknown>;
  /** Tamaño y tipo de un archivo ya subido, o null si no existe. */
  info(prefijo: 'archivos', clave: string): Promise<{ bytes: number; mime: string } | null>;
}

/** Archivos del panel construidos por Vite, pedidos por ruta. */
export interface ArchivosPanel {
  fetch(req: Request): Promise<Response>;
}

/** Almacenamiento de archivos por clave: Vercel Blob en producción, el disco en local y en las pruebas. */
export interface Almacen {
  get(clave: string): Promise<{ body: ReadableStream; size: number; contentType?: string } | null>;
  put(clave: string, datos: ReadableStream | ArrayBuffer | Uint8Array, opciones?: { contentType?: string }): Promise<void>;
  delete(claves: string | string[]): Promise<void>;
}
