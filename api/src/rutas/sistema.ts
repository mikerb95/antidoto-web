// Estado del sistema para el panel: servicios configurados, última revisión de pendientes, último
// despliegue pedido, gasto del chat y tamaño de las tablas. Sin secretos: solo si están o no.
import { desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/conexion';
import { configuracion, publicaciones, gastoAsesor } from '../db/schema';
import { ajustesAsesor, hoyBogota } from '../asesor/presupuesto';
import { configurada } from '../publicacion';
import { misionesConfiguradas } from '../misiones';
import { githubConfigurado } from '../github';
import { ahora, json } from '../util';
import { sinPermiso, type Ctx } from './contexto';

const CLAVE_REVISION = 'sistema.pendientes';

/** Anota la última revisión de pendientes (src/pendientes.ts). Falla abierto: es solo para el panel. */
export async function anotarRevision(db: Db, resumen: Record<string, number>): Promise<void> {
  const clave = CLAVE_REVISION;
  const valor = { t: ahora(), resumen };
  await db
    .insert(configuracion)
    .values({ clave, valor, actualizado: valor.t, autor: null })
    .onConflictDoUpdate({ target: configuracion.clave, set: { valor, actualizado: valor.t } })
    .catch((e) => console.error('[sistema] no se pudo anotar la revisión', e));
}

const TABLAS = ['leads', 'contactos', 'campanas', 'envios', 'conversaciones', 'conversacion_mensajes', 'contenido', 'medios', 'organizaciones', 'proyectos', 'entregable_archivos', 'usuarios', 'usuarios_cliente', 'auditoria'] as const;

export async function rutasSistema(c: Ctx): Promise<Response | null> {
  if (c.ruta !== '/admin/api/sistema' || c.metodo !== 'GET') return null;
  const no = sinPermiso(c, 'sistema.ver');
  if (no) return no;
  const { db, env } = c;
  const [[revision], [ultima], hoy, asesor, conteos] = await Promise.all([
    db.select().from(configuracion).where(eq(configuracion.clave, CLAVE_REVISION)),
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
      misiones: misionesConfiguradas(env),
      github: githubConfigurado(env),
      salIp: !!env.SAL_IP,
      panel: !!env.ASSETS,
    },
    entorno: env.ENTORNO,
    revision: revision?.valor ?? null,
    ultimaPublicacion: ultima ?? null,
    asesor: asesor ? { ...asesor, gastoHoy: hoy[0]?.usd ?? 0 } : null,
    tablas: Object.fromEntries(conteos),
  });
}
