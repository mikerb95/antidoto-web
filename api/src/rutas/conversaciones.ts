// Conversaciones del chat con IA en el panel: lista filtrable, detalle, borrado, métricas y CSV
// (este último sin el texto de los mensajes).
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { conversaciones, mensajesConversacion, gastoAsesor, leads, SERVICIOS, type ServicioId } from '../db/schema';
import { borrarConversacion, DIAS_RETENCION } from '../asesor/guardado';
import { ajustesAsesor, hoyBogota } from '../asesor/presupuesto';
import { celdaCsv } from '../admin';
import { puede } from '../permisos';
import { ahora, json, DIA } from '../util';
import { auditar, sinPermiso, type Ctx } from './contexto';

const POR_PAGINA = 40;
const RE_ID = /^\/admin\/api\/conversaciones\/([0-9a-f-]{36})$/;
export const RESULTADOS = ['whatsapp', 'cotizador', 'guardia', 'sin_cierre'] as const;

export async function rutasConversaciones(c: Ctx): Promise<Response | null> {
  const { ruta, metodo } = c;
  if (!ruta.startsWith('/admin/api/conversaciones')) return null;
  if (ruta === '/admin/api/conversaciones' && metodo === 'GET') return sinPermiso(c, 'asesor.ver') ?? listar(c);
  if (ruta === '/admin/api/conversaciones/metricas' && metodo === 'GET') return sinPermiso(c, 'asesor.ver') ?? metricas(c);
  if (ruta === '/admin/api/conversaciones.csv' && metodo === 'GET') return sinPermiso(c, 'asesor.ver') ?? csv(c);
  const m = ruta.match(RE_ID);
  if (m && metodo === 'GET') return sinPermiso(c, 'asesor.ver') ?? ver(c, m[1]!);
  if (m && metodo === 'DELETE') {
    const no = sinPermiso(c, 'datos.suprimir');
    if (no) return no;
    const ok = await borrarConversacion(c.db, m[1]!);
    return auditar(c, ok ? json({ ok: true }) : json({ error: 'no existe' }, 404), 'conversacion.suprimir', 'conversacion', m[1]!);
  }
  return null;
}

function filtros(url: URL): SQL[] {
  const p = url.searchParams;
  const f: SQL[] = [];
  const desde = Number(p.get('desde'));
  if (desde > 0) f.push(gte(conversaciones.actualizada, desde));
  const hasta = Number(p.get('hasta'));
  if (hasta > 0) f.push(lt(conversaciones.actualizada, hasta));
  const servicio = p.get('servicio');
  if (servicio && SERVICIOS.includes(servicio as ServicioId)) f.push(eq(conversaciones.servicio, servicio as ServicioId));
  const pagina = p.get('pagina_sitio');
  if (pagina) f.push(eq(conversaciones.paginaInicial, pagina.slice(0, 40)));
  const resultado = p.get('resultado');
  if (resultado === 'whatsapp') f.push(isNotNull(conversaciones.whatsapp));
  if (resultado === 'cotizador') f.push(isNotNull(conversaciones.cotizador));
  if (resultado === 'guardia') f.push(sql`${conversaciones.guardia} > 0`);
  if (resultado === 'sin_cierre') f.push(and(isNull(conversaciones.whatsapp), isNull(conversaciones.cotizador))!);
  const q = p.get('q')?.trim().slice(0, 80).replace(/[%_]/g, '');
  if (q) f.push(sql`exists (select 1 from conversacion_mensajes m where m.conversacion_id = conversaciones.id and m.texto like ${`%${q}%`})`);
  return f;
}

async function listar(c: Ctx): Promise<Response> {
  const pagina = Math.max(0, Number(c.url.searchParams.get('pagina')) || 0);
  const f = filtros(c.url);
  const donde = f.length ? and(...f) : undefined;
  // Nombres explícitos: dentro de un select, drizzle escribe las columnas sin tabla y "id" sería el del mensaje.
  const primera = sql<string | null>`(select m.texto from conversacion_mensajes m where m.conversacion_id = conversaciones.id and m.n = 0)`;
  const [filas, [total]] = await Promise.all([
    c.db
      .select({
        id: conversaciones.id,
        creada: conversaciones.creada,
        actualizada: conversaciones.actualizada,
        locale: conversaciones.locale,
        paginaInicial: conversaciones.paginaInicial,
        origen: conversaciones.origen,
        servicio: conversaciones.servicio,
        preguntas: conversaciones.preguntas,
        whatsapp: conversaciones.whatsapp,
        cotizador: conversaciones.cotizador,
        guardia: conversaciones.guardia,
        costoUsd: conversaciones.costoUsd,
        leadId: conversaciones.leadId,
        primera,
      })
      .from(conversaciones)
      .where(donde)
      .orderBy(desc(conversaciones.actualizada))
      .limit(POR_PAGINA)
      .offset(pagina * POR_PAGINA),
    c.db.select({ n: sql<number>`count(*)` }).from(conversaciones).where(donde),
  ]);
  return json({ conversaciones: filas, total: total?.n ?? 0, pagina, porPagina: POR_PAGINA, retencionDias: DIAS_RETENCION });
}

async function ver(c: Ctx, id: string): Promise<Response> {
  const [conv] = await c.db.select().from(conversaciones).where(eq(conversaciones.id, id));
  if (!conv) return json({ error: 'no existe' }, 404);
  const mensajes = await c.db.select().from(mensajesConversacion).where(eq(mensajesConversacion.conversacionId, id)).orderBy(asc(mensajesConversacion.n));
  let lead = null;
  if (conv.leadId && puede(c.sesion.usuario.rol, 'leads.ver')) {
    [lead] = await c.db.select({ id: leads.id, nombre: leads.nombre, empresa: leads.empresa, estado: leads.estado, anonimizado: leads.anonimizado }).from(leads).where(eq(leads.id, conv.leadId));
  }
  const { ipHash: _, ...visible } = conv;
  return json({ conversacion: visible, mensajes, lead: lead ?? null });
}

async function metricas(c: Ctx): Promise<Response> {
  const dias = Math.min(DIAS_RETENCION, Math.max(7, Number(c.url.searchParams.get('dias')) || 30));
  const t = ahora();
  const desdeDia = hoyBogota(t - (dias - 1) * DIA);
  const desde = t - dias * DIA;
  const rango = gte(conversaciones.creada, desde);
  const [porDia, [totales], temas, paginas, servicios, ajustes] = await Promise.all([
    c.db.select().from(gastoAsesor).where(gte(gastoAsesor.dia, desdeDia)).orderBy(asc(gastoAsesor.dia)),
    c.db
      .select({
        conversaciones: sql<number>`count(*)`,
        preguntas: sql<number>`coalesce(sum(${conversaciones.preguntas}), 0)`,
        whatsapp: sql<number>`sum(case when ${conversaciones.whatsapp} is not null then 1 else 0 end)`,
        cotizador: sql<number>`sum(case when ${conversaciones.cotizador} is not null then 1 else 0 end)`,
        derivadas: sql<number>`sum(case when ${conversaciones.whatsapp} is not null or ${conversaciones.cotizador} is not null then 1 else 0 end)`,
        guardia: sql<number>`coalesce(sum(${conversaciones.guardia}), 0)`,
        negativa: sql<number>`coalesce(sum(${conversaciones.negativa}), 0)`,
        vueltas: sql<number>`coalesce(sum(${conversaciones.vueltas}), 0)`,
        costo: sql<number>`coalesce(sum(${conversaciones.costoUsd}), 0)`,
        conLead: sql<number>`sum(case when ${conversaciones.leadId} is not null then 1 else 0 end)`,
      })
      .from(conversaciones)
      .where(rango),
    c.db
      .select({ clave: mensajesConversacion.tema, n: sql<number>`count(*)` })
      .from(mensajesConversacion)
      .where(and(eq(mensajesConversacion.rol, 'usuario'), gte(mensajesConversacion.creado, desde)))
      .groupBy(mensajesConversacion.tema)
      .orderBy(desc(sql`count(*)`)),
    c.db
      .select({ clave: conversaciones.paginaInicial, n: sql<number>`count(*)` })
      .from(conversaciones)
      .where(rango)
      .groupBy(conversaciones.paginaInicial)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    c.db
      .select({ clave: conversaciones.servicio, n: sql<number>`count(*)` })
      .from(conversaciones)
      .where(and(rango, isNotNull(conversaciones.servicio)))
      .groupBy(conversaciones.servicio)
      .orderBy(desc(sql`count(*)`)),
    ajustesAsesor(c.db, c.env.ASESOR_TOPE_DIARIO_USD).catch(() => null),
  ]);
  return json({
    dias,
    tope: ajustes?.tope ?? null,
    activo: ajustes?.activo ?? null,
    configurado: !!c.env.ANTHROPIC_API_KEY,
    porDia: porDia.map((d) => ({ dia: d.dia, usd: d.usd, conversaciones: d.conversaciones, preguntas: d.preguntas, derivaciones: d.derivaciones, guardia: d.guardia })),
    totales,
    temas,
    paginas,
    servicios,
  });
}

async function csv(c: Ctx): Promise<Response> {
  const f = filtros(c.url);
  const filas = await c.db.select().from(conversaciones).where(f.length ? and(...f) : undefined).orderBy(desc(conversaciones.creada)).limit(10_000);
  const fecha = (ms: number | null) => (ms ? new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ') : '');
  const cols = ['creada', 'actualizada', 'locale', 'pagina_inicial', 'origen', 'servicio', 'preguntas', 'whatsapp', 'cotizador', 'guardia', 'costo_usd', 'con_solicitud'];
  const cuerpo = [
    cols.join(','),
    ...filas.map((x) =>
      [fecha(x.creada), fecha(x.actualizada), x.locale, x.paginaInicial, x.origen, x.servicio, x.preguntas, x.whatsapp ? 'si' : 'no', x.cotizador ? 'si' : 'no', x.guardia, x.costoUsd.toFixed(4), x.leadId ? 'si' : 'no']
        .map(celdaCsv)
        .join(','),
    ),
  ].join('\r\n');
  return auditar(
    c,
    new Response('﻿' + cuerpo, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="conversaciones-antidoto-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
      },
    }),
    'conversaciones.exportar',
  );
}
