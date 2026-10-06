// Estado del sistema para el panel: servicios configurados, última corrida de cada cron, último
// despliegue pedido, gasto del chat y tamaño de las tablas. Sin secretos: solo si están o no.
import { desc, eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { configuracion, publicaciones, gastoAsesor } from '../db/schema';
import { ajustesAsesor, hoyBogota } from '../asesor/presupuesto';
import { configurada } from '../publicacion';
import { ahora, json } from '../util';
import { sinPermiso, type Ctx } from './contexto';

export type Cron = 'cinco' | 'hora';

/** Anota la última corrida de un cron (falla abierto: es solo para el panel). */
export async function anotarCron(db: DrizzleD1Database, cron: Cron, resumen: Record<string, number>, error?: string): Promise<void> {
  const clave = `sistema.cron.${cron}`;
  const valor = { t: ahora(), resumen, ...(error ? { error: error.slice(0, 300) } : {}) };
  await db
    .insert(configuracion)
    .values({ clave, valor, actualizado: valor.t, autor: null })
    .onConflictDoUpdate({ target: configuracion.clave, set: { valor, actualizado: valor.t } })
    .catch((e) => console.error('[sistema] no se pudo anotar el cron', e));
}

const TABLAS = ['leads', 'contactos', 'campanas', 'envios', 'conversaciones', 'conversacion_mensajes', 'contenido', 'medios', 'organizaciones', 'proyectos', 'entregable_archivos', 'usuarios', 'usuarios_cliente', 'auditoria'] as const;

export async function rutasSistema(c: Ctx): Promise<Response | null> {
  if (c.ruta !== '/admin/api/sistema' || c.metodo !== 'GET') return null;
  const no = sinPermiso(c, 'sistema.ver');
  if (no) return no;
  const { db, env } = c;
  const [crones, [ultima], hoy, asesor, conteos] = await Promise.all([
    db.select().from(configuracion).where(sql`${configuracion.clave} like 'sistema.cron.%'`),
    db.select().from(publicaciones).orderBy(desc(publicaciones.solicitada)).limit(1),
    db.select().from(gastoAsesor).where(eq(gastoAsesor.dia, hoyBogota())),
    ajustesAsesor(db, env.ASESOR_TOPE_DIARIO_USD).catch(() => null),
    Promise.all(TABLAS.map((t) => db.all<{ n: number }>(sql.raw(`select count(*) as n from ${t}`)).then((r) => [t, r[0]?.n ?? 0] as const))),
  ]);
  return json({
    servicios: {
      correo: !!env.RESEND_API_KEY,
      webhookCorreo: !!env.RESEND_WEBHOOK_SECRET,
      chatIa: !!env.ANTHROPIC_API_KEY,
      imagenes: !!env.MEDIOS,
      archivos: !!env.ARCHIVOS,
      publicacion: configurada(env),
      salIp: !!env.SAL_IP,
      panel: !!env.ASSETS,
    },
    entorno: env.ENTORNO,
    crones: Object.fromEntries(crones.map((x) => [x.clave.replace('sistema.cron.', ''), x.valor])),
    ultimaPublicacion: ultima ?? null,
    asesor: asesor ? { ...asesor, gastoHoy: hoy[0]?.usd ?? 0 } : null,
    tablas: Object.fromEntries(conteos),
  });
}
