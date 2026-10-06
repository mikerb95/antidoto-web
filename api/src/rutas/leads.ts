// Solicitudes del cotizador: lista, ficha, cambios, supresión, métricas y CSV.
import { listarLeads, verLead, editarLead, anonimizarLead, metricas, exportarCsv } from '../admin';
import { auditar, cuerpoJson, sinPermiso, type Ctx } from './contexto';

const UUID = '([0-9a-f-]{36})';
const RE_LEAD = new RegExp(`^/admin/api/leads/${UUID}(/anonimizar)?$`);

export async function rutasLeads(c: Ctx): Promise<Response | null> {
  const { ruta, metodo, url, db, sesion, req } = c;
  if (ruta === '/admin/leads.csv' && metodo === 'GET') {
    return sinPermiso(c, 'leads.exportar') ?? auditar(c, await exportarCsv(db), 'leads.exportar');
  }
  if (ruta === '/admin/api/leads' && metodo === 'GET') return sinPermiso(c, 'leads.ver') ?? listarLeads(url, db);
  if (ruta === '/admin/api/metricas' && metodo === 'GET') return sinPermiso(c, 'leads.ver') ?? metricas(url, db);

  const m = ruta.match(RE_LEAD);
  if (!m) return null;
  const id = m[1]!;
  if (m[2] && metodo === 'POST') return sinPermiso(c, 'datos.suprimir') ?? auditar(c, await anonimizarLead(id, db, sesion), 'lead.suprimir', 'lead', id);
  if (!m[2] && metodo === 'GET') return sinPermiso(c, 'leads.ver') ?? verLead(id, db);
  if (!m[2] && metodo === 'PATCH') {
    const no = sinPermiso(c, 'leads.editar');
    if (no) return no;
    // Solo los nombres de los campos y el estado (catálogo): las notas pueden tener datos personales.
    const d = await cuerpoJson(req);
    const detalle: Record<string, unknown> = { campos: Object.keys(d) };
    if (typeof d.estado === 'string') detalle.estado = d.estado;
    return auditar(c, await editarLead(id, req, db, sesion), 'lead.editar', 'lead', id, detalle);
  }
  return null;
}
