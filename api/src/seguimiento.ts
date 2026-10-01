// Cron horario: avisa al equipo de los leads que siguen en "nuevo" pasado el plazo (una sola
// vez por lead) y limpia enlaces y sesiones vencidos.
import { and, eq, isNull, isNotNull, lt, or } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { leads, enlaces, sesiones } from './db/schema';
import { enviar, correoSeguimiento } from './correo';
import type { Env } from './env';
import { ahora, HORA, DIA } from './util';

export async function seguimiento(env: Env, db: DrizzleD1Database): Promise<{ avisados: number }> {
  const t = ahora();
  const horas = Math.max(1, Number(env.HORAS_SEGUIMIENTO) || 24);
  const pendientes = await db
    .select()
    .from(leads)
    .where(and(eq(leads.estado, 'nuevo'), lt(leads.creado, t - horas * HORA), isNull(leads.avisoSeguimiento), isNull(leads.anonimizado)))
    .limit(100);

  if (pendientes.length) {
    const appUrl = (env.APP_URL ?? '').replace(/\/$/, '');
    const enviado = await enviar(env, { para: env.MAIL_EQUIPO, ...correoSeguimiento(pendientes, appUrl, horas) });
    // Solo se marcan si el correo salió; si no, se reintenta en la próxima hora.
    if (enviado) {
      const [primero, ...resto] = pendientes.map((l) => db.update(leads).set({ avisoSeguimiento: t }).where(eq(leads.id, l.id)));
      await db.batch([primero!, ...resto]);
    }
  }

  await db.delete(enlaces).where(lt(enlaces.creado, t - DIA));
  await db.delete(sesiones).where(or(lt(sesiones.expira, t), and(isNotNull(sesiones.revocada), lt(sesiones.revocada, t - 30 * DIA))));
  return { avisados: pendientes.length };
}
