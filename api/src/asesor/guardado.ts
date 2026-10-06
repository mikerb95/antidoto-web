// Conversaciones guardadas del asesor (90 días). Cada pregunta guarda su turno: la pregunta del
// visitante y la respuesta, con el índice que tienen en la conversación. Un reintento del mismo
// POST no duplica nada (índice único por conversación y posición) y un historial alterado en el
// navegador no reescribe lo guardado.
//
// Guardar falla ABIERTO (si la base no responde, la respuesta ya salió y se entrega igual), al
// revés que el tope de gasto, que falla cerrado.
import { eq, lt, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { conversaciones, mensajesConversacion, gastoAsesor, leads, type ServicioId } from '../db/schema';
import { DIA, uuid } from '../util';
import type { Entrada, Respuesta } from './bucle';
import { costoUsd } from './costo';
import { taparDatos } from './herramientas';
import { hoyBogota } from './presupuesto';
import { temaDe } from './temas';

export const DIAS_RETENCION = 90;

export interface Previa {
  preguntas: number;
  derivada: boolean;
}

/** Lo guardado de una conversación antes de esta pregunta (null si es nueva). Lanza si la base no responde. */
export async function previaDe(db: DrizzleD1Database, id: string): Promise<Previa | null> {
  const [c] = await db
    .select({ preguntas: conversaciones.preguntas, whatsapp: conversaciones.whatsapp, cotizador: conversaciones.cotizador })
    .from(conversaciones)
    .where(eq(conversaciones.id, id));
  return c ? { preguntas: c.preguntas, derivada: !!(c.whatsapp || c.cotizador) } : null;
}

export async function guardarTurno(db: DrizzleD1Database, o: { entrada: Entrada; r: Respuesta; previa: Previa | null; ipHash: string | null; t: number }): Promise<void> {
  const { entrada: e, r, previa, t } = o;
  const id = e.conversacion;
  if (!id) return;
  const n = e.mensajes.length - 1;
  const pregunta = taparDatos(e.mensajes[n]!.texto, e.locale);
  const costo = costoUsd(r.uso);
  const derivaAhora = !!(r.whatsapp || r.contacto);
  const servicio = (r.servicio as ServicioId | null) ?? null;
  const uno = (v: boolean) => (v ? 1 : 0);

  await db.batch([
    db
      .insert(conversaciones)
      .values({
        id,
        creada: t,
        actualizada: t,
        locale: e.locale,
        paginaInicial: e.pagina ?? null,
        paginaUltima: e.pagina ?? null,
        origen: e.origen ?? null,
        servicio,
        preguntas: 1,
        whatsapp: r.whatsapp ? t : null,
        cotizador: r.contacto ? t : null,
        guardia: uno(r.respaldo === 'guardia'),
        negativa: uno(r.respaldo === 'negativa'),
        vueltas: uno(r.respaldo === 'vueltas'),
        tokensEntrada: r.uso.entrada,
        tokensSalida: r.uso.salida,
        cacheLectura: r.uso.cacheLectura,
        cacheEscritura: r.uso.cacheEscritura,
        costoUsd: costo,
        ipHash: o.ipHash,
        expira: t + DIAS_RETENCION * DIA,
      })
      .onConflictDoUpdate({
        target: conversaciones.id,
        set: {
          actualizada: t,
          paginaUltima: e.pagina ?? null,
          servicio: sql`coalesce(${servicio}, ${conversaciones.servicio})`,
          preguntas: sql`${conversaciones.preguntas} + 1`,
          whatsapp: sql`coalesce(${conversaciones.whatsapp}, ${r.whatsapp ? t : null})`,
          cotizador: sql`coalesce(${conversaciones.cotizador}, ${r.contacto ? t : null})`,
          guardia: sql`${conversaciones.guardia} + ${uno(r.respaldo === 'guardia')}`,
          negativa: sql`${conversaciones.negativa} + ${uno(r.respaldo === 'negativa')}`,
          vueltas: sql`${conversaciones.vueltas} + ${uno(r.respaldo === 'vueltas')}`,
          tokensEntrada: sql`${conversaciones.tokensEntrada} + ${r.uso.entrada}`,
          tokensSalida: sql`${conversaciones.tokensSalida} + ${r.uso.salida}`,
          cacheLectura: sql`${conversaciones.cacheLectura} + ${r.uso.cacheLectura}`,
          cacheEscritura: sql`${conversaciones.cacheEscritura} + ${r.uso.cacheEscritura}`,
          costoUsd: sql`${conversaciones.costoUsd} + ${costo}`,
        },
      }),
    db
      .insert(mensajesConversacion)
      .values({ id: uuid(), conversacionId: id, n, rol: 'usuario', texto: pregunta, creado: t, tema: temaDe(pregunta) })
      .onConflictDoNothing({ target: [mensajesConversacion.conversacionId, mensajesConversacion.n] }),
    db
      .insert(mensajesConversacion)
      .values({
        id: uuid(),
        conversacionId: id,
        n: n + 1,
        rol: 'asesor',
        texto: r.texto,
        creado: t,
        herramientas: r.herramientas.length ? r.herramientas : null,
        whatsapp: r.whatsapp,
        respaldo: r.respaldo,
        tokensEntrada: r.uso.entrada + r.uso.cacheLectura + r.uso.cacheEscritura,
        tokensSalida: r.uso.salida,
        costoUsd: costo,
      })
      .onConflictDoNothing({ target: [mensajesConversacion.conversacionId, mensajesConversacion.n] }),
    // Contadores del día: conversación nueva, pregunta, primera derivación y rechazos de la guardia.
    db
      .insert(gastoAsesor)
      .values({
        dia: hoyBogota(t),
        usd: 0,
        conversaciones: uno(!previa),
        preguntas: 1,
        derivaciones: uno(derivaAhora && !previa?.derivada),
        guardia: uno(r.respaldo === 'guardia'),
      })
      .onConflictDoUpdate({
        target: gastoAsesor.dia,
        set: {
          conversaciones: sql`${gastoAsesor.conversaciones} + ${uno(!previa)}`,
          preguntas: sql`${gastoAsesor.preguntas} + 1`,
          derivaciones: sql`${gastoAsesor.derivaciones} + ${uno(derivaAhora && !previa?.derivada)}`,
          guardia: sql`${gastoAsesor.guardia} + ${uno(r.respaldo === 'guardia')}`,
        },
      }),
  ]);
}

/** Borra una conversación y sus mensajes, y la desvincula del lead. */
export async function borrarConversacion(db: DrizzleD1Database, id: string): Promise<boolean> {
  const [, , borradas] = await db.batch([
    db.delete(mensajesConversacion).where(eq(mensajesConversacion.conversacionId, id)),
    db.update(leads).set({ conversacionId: null }).where(eq(leads.conversacionId, id)),
    db.delete(conversaciones).where(eq(conversaciones.id, id)).returning({ id: conversaciones.id }),
  ]);
  return (borradas as { id: string }[]).length > 0;
}

/** Borra lo vencido (cron horario). Con subconsultas: D1 acepta hasta 100 parámetros por consulta. */
export async function limpiarConversaciones(db: DrizzleD1Database, t: number): Promise<number> {
  const vencidas = sql`(select ${conversaciones.id} from ${conversaciones} where ${conversaciones.expira} < ${t})`;
  const [, , borradas] = await db.batch([
    db.delete(mensajesConversacion).where(sql`${mensajesConversacion.conversacionId} in ${vencidas}`),
    db.update(leads).set({ conversacionId: null }).where(sql`${leads.conversacionId} in ${vencidas}`),
    db.delete(conversaciones).where(lt(conversaciones.expira, t)).returning({ id: conversaciones.id }),
  ]);
  return (borradas as { id: string }[]).length;
}
