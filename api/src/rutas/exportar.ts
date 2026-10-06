// Exportaciones a CSV además de las solicitudes (src/admin.ts) y las conversaciones: contactos de
// novedades y proyectos. Todas con celdaCsv (sin fórmulas) y quedan en la auditoría.
import { desc, eq } from 'drizzle-orm';
import { contactos, proyectos, organizaciones, usuarios } from '../db/schema';
import { celdaCsv } from '../admin';
import { puede } from '../permisos';
import { auditar, sinPermiso, type Ctx } from './contexto';

const fecha = (ms: number | null) => (ms ? new Date(ms - 5 * 3_600_000).toISOString().slice(0, 10) : '');

function csv(nombre: string, cabeza: string[], filas: unknown[][]): Response {
  const cuerpo = [cabeza.join(','), ...filas.map((f) => f.map(celdaCsv).join(','))].join('\r\n');
  return new Response('﻿' + cuerpo, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nombre}-antidoto-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

export async function rutasExportar(c: Ctx): Promise<Response | null> {
  if (c.metodo !== 'GET') return null;
  if (c.ruta === '/admin/api/contactos.csv') {
    const no = sinPermiso(c, 'marketing.editar');
    if (no) return no;
    const filas = await c.db.select().from(contactos).orderBy(desc(contactos.creado));
    return auditar(
      c,
      csv(
        'contactos',
        ['email', 'nombre', 'empresa', 'idioma', 'estado', 'origen', 'intereses', 'creado', 'confirmado', 'baja'],
        filas.filter((x) => x.motivoBaja !== 'supresion').map((x) => [x.email, x.nombre, x.empresa, x.locale, x.estado, x.origen, x.intereses.join('|'), fecha(x.creado), fecha(x.confirmado), fecha(x.baja)]),
      ),
      'contactos.exportar',
    );
  }
  if (c.ruta === '/admin/api/proyectos.csv') {
    const no = sinPermiso(c, 'proyectos.ver');
    if (no) return no;
    const conValor = puede(c.sesion.usuario.rol, 'proyectos.valor');
    const filas = await c.db
      .select({ p: proyectos, org: organizaciones.nombre, resp: usuarios.nombre })
      .from(proyectos)
      .innerJoin(organizaciones, eq(organizaciones.id, proyectos.organizacionId))
      .leftJoin(usuarios, eq(usuarios.id, proyectos.responsableId))
      .orderBy(desc(proyectos.creado));
    return auditar(
      c,
      csv(
        'proyectos',
        ['codigo', 'nombre', 'organizacion', 'linea', 'estado', 'responsable', 'inicio', 'entrega', ...(conValor ? ['valor'] : []), 'creado'],
        filas.map(({ p, org, resp }) => [p.codigo, p.nombre, org, p.linea, p.estado, resp, p.inicio, p.entrega, ...(conValor ? [p.valor] : []), fecha(p.creado)]),
      ),
      'proyectos.exportar',
    );
  }
  return null;
}
