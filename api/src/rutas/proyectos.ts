// Proyectos y organizaciones en el panel. Una solicitud ganada se vuelve proyecto (con su
// organización y su contacto), arranca con las etapas de la plantilla de su línea y suma tareas,
// entregables con archivos (bucket privado ARCHIVOS) y una bitácora. El valor solo lo ve quien
// tiene proyectos.valor.
import { and, asc, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import {
  leads,
  organizaciones,
  contactosCliente,
  proyectos,
  etapas,
  tareas,
  entregables,
  archivosEntregable,
  bitacora,
  usuarios,
  conversaciones,
  ESTADOS_PROYECTO,
  ESTADOS_ETAPA,
  ESTADOS_ENTREGABLE,
  SERVICIOS,
  type Proyecto,
  type ServicioId,
} from '../db/schema';
import { PLANTILLAS, codigoProyecto } from '../proyectos/plantillas';
import { nombreLimpio } from '../archivos';
import { puede } from '../permisos';
import { ahora, json, uuid } from '../util';
import { auditar, sinPermiso, type Ctx } from './contexto';

export const MAX_BYTES_ARCHIVO = 50 * 1024 * 1024;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const U = '([0-9a-f-]{36})';

type Cuerpo = Record<string, unknown>;
const leer = async (c: Ctx): Promise<Cuerpo> => {
  const d = await c.req.json().catch(() => null);
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as Cuerpo) : {};
};
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const fecha = (v: unknown) => (typeof v === 'string' && RE_FECHA.test(v) ? v : null);
const entero = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v.replace(/\D/g, '')) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 1e13 ? n : null;
};

/** El valor del proyecto solo sale para quien lo puede ver. */
const visible = (c: Ctx, p: Proyecto) => (puede(c.sesion.usuario.rol, 'proyectos.valor') ? p : { ...p, valor: null });

function nota(proyectoId: string, autorTipo: 'equipo' | 'cliente' | 'sistema', autor: string | null, tipo: string, textoNota: string | null, visibleCliente = false) {
  return { id: uuid(), proyectoId, creado: ahora(), autorTipo, autor, tipo, texto: textoNota, visibleCliente };
}

export async function rutasProyectos(c: Ctx): Promise<Response | null> {
  const { ruta, metodo } = c;
  const ver = () => sinPermiso(c, 'proyectos.ver');
  const editar = () => sinPermiso(c, 'proyectos.editar');
  let m: RegExpMatchArray | null;

  if (ruta === '/admin/api/organizaciones' && metodo === 'GET') return ver() ?? listarOrganizaciones(c);
  if (ruta === '/admin/api/organizaciones' && metodo === 'POST') return editar() ?? crearOrganizacion(c);
  if ((m = ruta.match(new RegExp(`^/admin/api/organizaciones/${U}$`)))) {
    if (metodo === 'GET') return ver() ?? verOrganizacion(c, m[1]!);
    if (metodo === 'PATCH') return editar() ?? editarOrganizacion(c, m[1]!);
  }
  if ((m = ruta.match(new RegExp(`^/admin/api/organizaciones/${U}/contactos$`))) && metodo === 'POST') return editar() ?? crearContacto(c, m[1]!);
  if ((m = ruta.match(new RegExp(`^/admin/api/contactos-cliente/${U}$`)))) {
    if (metodo === 'PATCH') return editar() ?? editarContacto(c, m[1]!);
    if (metodo === 'DELETE') return sinPermiso(c, 'datos.suprimir') ?? suprimirContacto(c, m[1]!);
  }

  if (ruta === '/admin/api/proyectos' && metodo === 'GET') return ver() ?? listarProyectos(c);
  if (ruta === '/admin/api/proyectos' && metodo === 'POST') return editar() ?? crearProyecto(c, null);
  if ((m = ruta.match(new RegExp(`^/admin/api/leads/${U}/proyecto$`))) && metodo === 'POST') return editar() ?? crearProyecto(c, m[1]!);
  if ((m = ruta.match(new RegExp(`^/admin/api/proyectos/${U}$`)))) {
    if (metodo === 'GET') return ver() ?? verProyecto(c, m[1]!);
    if (metodo === 'PATCH') return editar() ?? editarProyecto(c, m[1]!);
  }
  if ((m = ruta.match(new RegExp(`^/admin/api/proyectos/${U}/(etapas|tareas|entregables|bitacora)$`))) && metodo === 'POST') {
    const no = editar();
    if (no) return no;
    const [, id, que] = m as unknown as [string, string, string];
    if (que === 'etapas') return crearEtapa(c, id);
    if (que === 'tareas') return crearTarea(c, id);
    if (que === 'entregables') return crearEntregable(c, id);
    return crearNota(c, id);
  }
  if ((m = ruta.match(new RegExp(`^/admin/api/(etapas|tareas|entregables)/${U}$`)))) {
    const no = editar();
    if (no) return no;
    const [, que, id] = m as unknown as [string, string, string];
    if (metodo === 'PATCH') return que === 'etapas' ? editarEtapa(c, id) : que === 'tareas' ? editarTarea(c, id) : editarEntregable(c, id);
    if (metodo === 'DELETE') return borrarParte(c, que as 'etapas' | 'tareas' | 'entregables', id);
  }
  if ((m = ruta.match(new RegExp(`^/admin/api/entregables/${U}/archivos$`))) && metodo === 'POST') return editar() ?? subirArchivo(c, m[1]!);
  if ((m = ruta.match(new RegExp(`^/admin/api/archivos/${U}$`)))) {
    if (metodo === 'GET') return ver() ?? descargarArchivo(c, m[1]!);
    if (metodo === 'DELETE') return editar() ?? borrarArchivo(c, m[1]!);
  }
  return null;
}

// Organizaciones -----------------------------------------------------------------------

async function listarOrganizaciones(c: Ctx): Promise<Response> {
  const q = c.url.searchParams.get('q')?.trim().slice(0, 80).replace(/[%_]/g, '');
  const filas = await c.db
    .select({
      id: organizaciones.id,
      nombre: organizaciones.nombre,
      sector: organizaciones.sector,
      actualizado: organizaciones.actualizado,
      proyectos: sql<number>`(select count(*) from proyectos p where p.organizacion_id = organizaciones.id)`,
      activos: sql<number>`(select count(*) from proyectos p where p.organizacion_id = organizaciones.id and p.estado in ('planeado','en_curso','en_pausa'))`,
    })
    .from(organizaciones)
    .where(q ? like(organizaciones.nombre, `%${q}%`) : undefined)
    .orderBy(asc(organizaciones.nombre))
    .limit(500);
  return json({ organizaciones: filas });
}

function datosOrganizacion(d: Cuerpo) {
  return { nombre: texto(d.nombre, 160), nit: texto(d.nit, 40), sector: texto(d.sector, 80), sitio: texto(d.sitio, 200), notas: texto(d.notas, 5000) };
}

async function crearOrganizacion(c: Ctx): Promise<Response> {
  const x = datosOrganizacion(await leer(c));
  if (!x.nombre) return json({ errores: { nombre: 'Falta el nombre' } }, 422);
  const t = ahora();
  const id = uuid();
  await c.db.insert(organizaciones).values({ id, ...x, nombre: x.nombre, creado: t, actualizado: t });
  return auditar(c, await verOrganizacion(c, id), 'organizacion.crear', 'organizacion', id);
}

async function editarOrganizacion(c: Ctx, id: string): Promise<Response> {
  const d = await leer(c);
  const x = datosOrganizacion(d);
  const set = Object.fromEntries(Object.entries(x).filter(([k]) => k in d));
  if ('nombre' in set && !set.nombre) return json({ errores: { nombre: 'Falta el nombre' } }, 422);
  const r = await c.db.update(organizaciones).set({ ...set, actualizado: ahora() }).where(eq(organizaciones.id, id)).returning({ id: organizaciones.id });
  if (!r.length) return json({ error: 'no existe' }, 404);
  return auditar(c, await verOrganizacion(c, id), 'organizacion.editar', 'organizacion', id, { campos: Object.keys(set) });
}

/** Ficha 360: contactos, proyectos, solicitudes y conversaciones del chat de la organización. */
async function verOrganizacion(c: Ctx, id: string): Promise<Response> {
  const [org] = await c.db.select().from(organizaciones).where(eq(organizaciones.id, id));
  if (!org) return json({ error: 'no existe' }, 404);
  const rol = c.sesion.usuario.rol;
  const [contactos, proys, solicitudes] = await Promise.all([
    c.db.select().from(contactosCliente).where(eq(contactosCliente.organizacionId, id)).orderBy(asc(contactosCliente.creado)),
    c.db.select().from(proyectos).where(eq(proyectos.organizacionId, id)).orderBy(desc(proyectos.creado)),
    puede(rol, 'leads.ver')
      ? c.db
          .select({ id: leads.id, nombre: leads.nombre, servicio: leads.servicio, estado: leads.estado, creado: leads.creado, conversacionId: leads.conversacionId, anonimizado: leads.anonimizado })
          .from(leads)
          .where(eq(leads.organizacionId, id))
          .orderBy(desc(leads.creado))
      : Promise.resolve([]),
  ]);
  const idsConv = solicitudes.map((s) => s.conversacionId).filter((x): x is string => !!x);
  const convs =
    idsConv.length && puede(rol, 'asesor.ver')
      ? await c.db
          .select({ id: conversaciones.id, creada: conversaciones.creada, preguntas: conversaciones.preguntas, servicio: conversaciones.servicio })
          .from(conversaciones)
          .where(sql`${conversaciones.id} in (${sql.join(idsConv.slice(0, 50).map((x) => sql`${x}`), sql`, `)})`)
      : [];
  return json({ organizacion: org, contactos, proyectos: proys.map((p) => visible(c, p)), solicitudes, conversaciones: convs });
}

function datosContacto(d: Cuerpo) {
  const email = texto(d.email, 200)?.toLowerCase() ?? null;
  return { nombre: texto(d.nombre, 120), email: email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null, telefono: texto(d.telefono, 40), cargo: texto(d.cargo, 120) };
}

async function crearContacto(c: Ctx, orgId: string): Promise<Response> {
  const [org] = await c.db.select({ id: organizaciones.id }).from(organizaciones).where(eq(organizaciones.id, orgId));
  if (!org) return json({ error: 'no existe' }, 404);
  const x = datosContacto(await leer(c));
  if (!x.nombre && !x.email) return json({ errores: { nombre: 'Falta el nombre o el correo' } }, 422);
  await c.db.insert(contactosCliente).values({ id: uuid(), organizacionId: orgId, ...x, creado: ahora(), anonimizado: null });
  return verOrganizacion(c, orgId);
}

async function editarContacto(c: Ctx, id: string): Promise<Response> {
  const d = await leer(c);
  const x = datosContacto(d);
  const set = Object.fromEntries(Object.entries(x).filter(([k]) => k in d));
  const r = await c.db.update(contactosCliente).set(set).where(eq(contactosCliente.id, id)).returning({ org: contactosCliente.organizacionId });
  if (!r.length) return json({ error: 'no existe' }, 404);
  return verOrganizacion(c, r[0]!.org);
}

/** Supresión (Ley 1581) de un contacto de cliente: se borran sus datos y no se puede deshacer. */
async function suprimirContacto(c: Ctx, id: string): Promise<Response> {
  const r = await c.db
    .update(contactosCliente)
    .set({ nombre: null, email: null, telefono: null, cargo: null, anonimizado: ahora() })
    .where(eq(contactosCliente.id, id))
    .returning({ org: contactosCliente.organizacionId });
  if (!r.length) return json({ error: 'no existe' }, 404);
  return auditar(c, await verOrganizacion(c, r[0]!.org), 'contacto_cliente.suprimir', 'organizacion', r[0]!.org);
}

// Proyectos ------------------------------------------------------------------------

async function listarProyectos(c: Ctx): Promise<Response> {
  const p = c.url.searchParams;
  const f: SQL[] = [];
  const estado = p.get('estado');
  if (estado === 'activos') f.push(sql`${proyectos.estado} in ('planeado','en_curso','en_pausa')`);
  else if (ESTADOS_PROYECTO.includes(estado as (typeof ESTADOS_PROYECTO)[number])) f.push(eq(proyectos.estado, estado as (typeof ESTADOS_PROYECTO)[number]));
  const responsable = p.get('responsable');
  if (responsable) f.push(eq(proyectos.responsableId, responsable.slice(0, 40)));
  const q = p.get('q')?.trim().slice(0, 80).replace(/[%_]/g, '');
  if (q) f.push(or(like(proyectos.nombre, `%${q}%`), like(proyectos.codigo, `%${q}%`), like(organizaciones.nombre, `%${q}%`))!);
  const filas = await c.db
    .select({
      p: proyectos,
      organizacion: organizaciones.nombre,
      responsable: usuarios.nombre,
      tareasAbiertas: sql<number>`(select count(*) from proyecto_tareas t where t.proyecto_id = proyectos.id and t.hecha is null)`,
      proximoEntregable: sql<string | null>`(select min(e.vence) from entregables e where e.proyecto_id = proyectos.id and e.estado <> 'aprobado' and e.vence is not null)`,
    })
    .from(proyectos)
    .innerJoin(organizaciones, eq(organizaciones.id, proyectos.organizacionId))
    .leftJoin(usuarios, eq(usuarios.id, proyectos.responsableId))
    .where(f.length ? and(...f) : undefined)
    .orderBy(desc(proyectos.actualizado))
    .limit(300);
  const conteos = await c.db.select({ estado: proyectos.estado, n: sql<number>`count(*)` }).from(proyectos).groupBy(proyectos.estado);
  return json({
    proyectos: filas.map((x) => ({ ...visible(c, x.p), organizacion: x.organizacion, responsable: x.responsable, tareasAbiertas: x.tareasAbiertas, proximoEntregable: x.proximoEntregable })),
    conteos: Object.fromEntries(conteos.map((x) => [x.estado, x.n])),
  });
}

async function siguienteCodigo(c: Ctx): Promise<string> {
  const anio = new Date().getUTCFullYear();
  const [f] = await c.db
    .select({ n: sql<number>`count(*)` })
    .from(proyectos)
    .where(like(proyectos.codigo, `P-${anio}-%`));
  return codigoProyecto(anio, (f?.n ?? 0) + 1);
}

/** Crea un proyecto, a mano o desde una solicitud ganada (con su organización y su contacto). */
async function crearProyecto(c: Ctx, leadId: string | null): Promise<Response> {
  const d = await leer(c);
  const t = ahora();
  let orgId = typeof d.organizacionId === 'string' ? d.organizacionId : null;
  let linea = (SERVICIOS.includes(d.linea as ServicioId) ? d.linea : null) as ServicioId | null;
  let nombre = texto(d.nombre, 160);
  let valor = entero(d.valor);
  const previas: BatchItem<'sqlite'>[] = [];

  if (leadId) {
    const [lead] = await c.db.select().from(leads).where(eq(leads.id, leadId));
    if (!lead) return json({ error: 'no existe' }, 404);
    if (lead.estado !== 'ganado') return json({ error: 'no_ganado' }, 409);
    if (lead.proyectoId) return json({ error: 'ya_tiene', proyectoId: lead.proyectoId }, 409);
    linea ??= lead.servicio;
    valor ??= lead.valorEstimado;
    if (!orgId) {
      // Reutiliza la organización con el mismo nombre; si no hay, la crea.
      const nombreOrg = lead.empresa?.trim() || lead.nombre?.trim() || 'Sin nombre';
      const [existente] = await c.db.select({ id: organizaciones.id }).from(organizaciones).where(sql`lower(${organizaciones.nombre}) = lower(${nombreOrg})`);
      orgId = existente?.id ?? uuid();
      if (!existente) previas.push(c.db.insert(organizaciones).values({ id: orgId, nombre: nombreOrg, creado: t, actualizado: t }));
    }
    if (lead.nombre || lead.email) {
      const [ya] = lead.email ? await c.db.select({ id: contactosCliente.id }).from(contactosCliente).where(and(eq(contactosCliente.organizacionId, orgId), eq(contactosCliente.email, lead.email))) : [];
      if (!ya) previas.push(c.db.insert(contactosCliente).values({ id: uuid(), organizacionId: orgId, nombre: lead.nombre, email: lead.email, telefono: lead.telefono, cargo: null, creado: t, anonimizado: null }));
    }
    nombre ??= `${SERVICIO_NOMBRE[linea]}${lead.empresa ? ` para ${lead.empresa}` : ''}`;
  }
  if (!orgId) return json({ errores: { organizacionId: 'Elige la organización' } }, 422);
  if (!leadId) {
    const [org] = await c.db.select({ id: organizaciones.id }).from(organizaciones).where(eq(organizaciones.id, orgId));
    if (!org) return json({ errores: { organizacionId: 'La organización no existe' } }, 422);
  }
  if (!linea) return json({ errores: { linea: 'Elige la línea de servicio' } }, 422);
  if (!nombre) return json({ errores: { nombre: 'Falta el nombre' } }, 422);
  if (!puede(c.sesion.usuario.rol, 'proyectos.valor')) valor = null;

  const id = uuid();
  const codigo = await siguienteCodigo(c);
  // Organización y contacto primero: el proyecto los referencia.
  await c.db.batch([
    ...(previas as [BatchItem<'sqlite'>]),
    c.db.insert(proyectos).values({
      id,
      codigo,
      organizacionId: orgId,
      leadId,
      nombre,
      linea,
      estado: 'planeado',
      responsableId: typeof d.responsableId === 'string' ? d.responsableId : c.sesion.usuario.id,
      inicio: fecha(d.inicio),
      entrega: fecha(d.entrega),
      valor,
      notas: texto(d.notas, 5000),
      misionUrl: null,
      creado: t,
      actualizado: t,
    }),
    ...PLANTILLAS[linea].map((n, i) => c.db.insert(etapas).values({ id: uuid(), proyectoId: id, nombre: n, orden: i, estado: 'pendiente', fecha: null })),
    c.db.insert(bitacora).values(nota(id, 'sistema', c.sesion.usuario.email, 'creado', leadId ? 'Proyecto creado desde una solicitud ganada.' : 'Proyecto creado.')),
    ...(leadId ? [c.db.update(leads).set({ organizacionId: orgId, proyectoId: id }).where(eq(leads.id, leadId))] : []),
  ]);
  return auditar(c, await verProyecto(c, id), 'proyecto.crear', 'proyecto', id, { linea, desdeSolicitud: !!leadId });
}

const NOMBRE_ESTADO: Record<Proyecto['estado'], string> = { planeado: 'Planeado', en_curso: 'En curso', en_pausa: 'En pausa', entregado: 'Entregado', cerrado: 'Cerrado', cancelado: 'Cancelado' };

const SERVICIO_NOMBRE: Record<ServicioId, string> = {
  formaciones: 'Formación vivencial',
  audiovisual: 'Producción audiovisual',
  catering: 'Catering',
  diseno: 'Diseño de productos',
  ia: 'Capacitación en IA',
};

async function verProyecto(c: Ctx, id: string): Promise<Response> {
  const [p] = await c.db.select().from(proyectos).where(eq(proyectos.id, id));
  if (!p) return json({ error: 'no existe' }, 404);
  const [org, ets, tas, ens, bit, archivos, contactos] = await Promise.all([
    c.db.select().from(organizaciones).where(eq(organizaciones.id, p.organizacionId)),
    c.db.select().from(etapas).where(eq(etapas.proyectoId, id)).orderBy(asc(etapas.orden)),
    c.db.select().from(tareas).where(eq(tareas.proyectoId, id)).orderBy(asc(tareas.orden), asc(tareas.creado)),
    c.db.select().from(entregables).where(eq(entregables.proyectoId, id)).orderBy(asc(entregables.creado)),
    c.db.select().from(bitacora).where(eq(bitacora.proyectoId, id)).orderBy(desc(bitacora.creado)).limit(200),
    c.db
      .select({ a: archivosEntregable })
      .from(archivosEntregable)
      .innerJoin(entregables, eq(entregables.id, archivosEntregable.entregableId))
      .where(eq(entregables.proyectoId, id))
      .orderBy(desc(archivosEntregable.subido)),
    c.db.select().from(contactosCliente).where(eq(contactosCliente.organizacionId, p.organizacionId)),
  ]);
  return json({
    proyecto: visible(c, p),
    organizacion: org[0] ?? null,
    contactos,
    etapas: ets,
    tareas: tas,
    entregables: ens.map((e) => ({ ...e, archivos: archivos.filter((x) => x.a.entregableId === e.id).map((x) => x.a) })),
    bitacora: bit,
  });
}

async function editarProyecto(c: Ctx, id: string): Promise<Response> {
  const [p] = await c.db.select().from(proyectos).where(eq(proyectos.id, id));
  if (!p) return json({ error: 'no existe' }, 404);
  const d = await leer(c);
  const set: Partial<Proyecto> = {};
  const errores: Record<string, string> = {};
  if ('nombre' in d) set.nombre = texto(d.nombre, 160) ?? (errores.nombre = 'Falta el nombre', p.nombre);
  if ('estado' in d) ESTADOS_PROYECTO.includes(d.estado as Proyecto['estado']) ? (set.estado = d.estado as Proyecto['estado']) : (errores.estado = 'Estado inválido');
  if ('linea' in d) SERVICIOS.includes(d.linea as ServicioId) ? (set.linea = d.linea as ServicioId) : (errores.linea = 'Línea inválida');
  if ('responsableId' in d) set.responsableId = typeof d.responsableId === 'string' && d.responsableId ? d.responsableId : null;
  if ('inicio' in d) set.inicio = fecha(d.inicio);
  if ('entrega' in d) set.entrega = fecha(d.entrega);
  if ('notas' in d) set.notas = texto(d.notas, 5000);
  if ('misionUrl' in d) set.misionUrl = typeof d.misionUrl === 'string' && /^https:\/\/\S+$/.test(d.misionUrl) ? d.misionUrl.slice(0, 300) : null;
  if ('valor' in d && puede(c.sesion.usuario.rol, 'proyectos.valor')) set.valor = entero(d.valor);
  if (Object.keys(errores).length) return json({ errores }, 422);
  if (!Object.keys(set).length) return json({ errores: { cuerpo: 'Nada que cambiar' } }, 422);
  const notas = [];
  if (set.estado && set.estado !== p.estado) notas.push(c.db.insert(bitacora).values(nota(id, 'sistema', c.sesion.usuario.email, 'estado', `Estado del proyecto: ${NOMBRE_ESTADO[p.estado]} → ${NOMBRE_ESTADO[set.estado]}`, true)));
  await c.db.batch([c.db.update(proyectos).set({ ...set, actualizado: ahora() }).where(eq(proyectos.id, id)), ...notas]);
  return auditar(c, await verProyecto(c, id), 'proyecto.editar', 'proyecto', id, { campos: Object.keys(set), ...(set.estado ? { estado: set.estado } : {}) });
}

async function existeProyecto(c: Ctx, id: string) {
  const [p] = await c.db.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.id, id));
  return !!p;
}
const tocar = (c: Ctx, id: string) => c.db.update(proyectos).set({ actualizado: ahora() }).where(eq(proyectos.id, id));

async function crearEtapa(c: Ctx, id: string): Promise<Response> {
  if (!(await existeProyecto(c, id))) return json({ error: 'no existe' }, 404);
  const d = await leer(c);
  const nombre = texto(d.nombre, 120);
  if (!nombre) return json({ errores: { nombre: 'Falta el nombre' } }, 422);
  const [m] = await c.db.select({ n: sql<number>`coalesce(max(${etapas.orden}), -1)` }).from(etapas).where(eq(etapas.proyectoId, id));
  await c.db.batch([c.db.insert(etapas).values({ id: uuid(), proyectoId: id, nombre, orden: (m?.n ?? -1) + 1, estado: 'pendiente', fecha: fecha(d.fecha) }), tocar(c, id)]);
  return verProyecto(c, id);
}

async function editarEtapa(c: Ctx, etapaId: string): Promise<Response> {
  const [e] = await c.db.select().from(etapas).where(eq(etapas.id, etapaId));
  if (!e) return json({ error: 'no existe' }, 404);
  const d = await leer(c);
  const set: Partial<typeof etapas.$inferInsert> = {};
  if ('nombre' in d && texto(d.nombre, 120)) set.nombre = texto(d.nombre, 120)!;
  if ('estado' in d && ESTADOS_ETAPA.includes(d.estado as (typeof ESTADOS_ETAPA)[number])) set.estado = d.estado as (typeof ESTADOS_ETAPA)[number];
  if ('fecha' in d) set.fecha = fecha(d.fecha);
  if ('orden' in d && Number.isInteger(d.orden)) set.orden = d.orden as number;
  const extra = set.estado && set.estado !== e.estado && set.estado === 'hecha' ? [c.db.insert(bitacora).values(nota(e.proyectoId, 'sistema', c.sesion.usuario.email, 'etapa', `Etapa terminada: ${e.nombre}`, true))] : [];
  await c.db.batch([c.db.update(etapas).set(set).where(eq(etapas.id, etapaId)), tocar(c, e.proyectoId), ...extra]);
  return verProyecto(c, e.proyectoId);
}

async function crearTarea(c: Ctx, id: string): Promise<Response> {
  if (!(await existeProyecto(c, id))) return json({ error: 'no existe' }, 404);
  const d = await leer(c);
  const titulo = texto(d.titulo, 200);
  if (!titulo) return json({ errores: { titulo: 'Falta la tarea' } }, 422);
  await c.db.batch([
    c.db.insert(tareas).values({
      id: uuid(),
      proyectoId: id,
      etapaId: typeof d.etapaId === 'string' ? d.etapaId : null,
      titulo,
      responsableId: typeof d.responsableId === 'string' && d.responsableId ? d.responsableId : null,
      vence: fecha(d.vence),
      hecha: null,
      orden: 0,
      visibleCliente: d.visibleCliente === true,
      creado: ahora(),
    }),
    tocar(c, id),
  ]);
  return verProyecto(c, id);
}

async function editarTarea(c: Ctx, tareaId: string): Promise<Response> {
  const [x] = await c.db.select().from(tareas).where(eq(tareas.id, tareaId));
  if (!x) return json({ error: 'no existe' }, 404);
  const d = await leer(c);
  const set: Partial<typeof tareas.$inferInsert> = {};
  if ('titulo' in d && texto(d.titulo, 200)) set.titulo = texto(d.titulo, 200)!;
  if ('hecha' in d) set.hecha = d.hecha === true ? ahora() : null;
  if ('vence' in d) set.vence = fecha(d.vence);
  if ('responsableId' in d) set.responsableId = typeof d.responsableId === 'string' && d.responsableId ? d.responsableId : null;
  if ('etapaId' in d) set.etapaId = typeof d.etapaId === 'string' && d.etapaId ? d.etapaId : null;
  if ('visibleCliente' in d) set.visibleCliente = d.visibleCliente === true;
  await c.db.batch([c.db.update(tareas).set(set).where(eq(tareas.id, tareaId)), tocar(c, x.proyectoId)]);
  return verProyecto(c, x.proyectoId);
}

async function crearEntregable(c: Ctx, id: string): Promise<Response> {
  if (!(await existeProyecto(c, id))) return json({ error: 'no existe' }, 404);
  const d = await leer(c);
  const titulo = texto(d.titulo, 200);
  if (!titulo) return json({ errores: { titulo: 'Falta el nombre del entregable' } }, 422);
  const t = ahora();
  await c.db.batch([
    c.db.insert(entregables).values({
      id: uuid(),
      proyectoId: id,
      etapaId: typeof d.etapaId === 'string' ? d.etapaId : null,
      titulo,
      descripcion: texto(d.descripcion, 2000),
      estado: 'borrador',
      vence: fecha(d.vence),
      visibleCliente: d.visibleCliente === true,
      version: 1,
      aprobadoPor: null,
      aprobadoEn: null,
      creado: t,
      actualizado: t,
    }),
    tocar(c, id),
  ]);
  return verProyecto(c, id);
}

/** Avisa a quien corresponda cuando un entregable pasa a revisión (portal de clientes, F5). */
export type AlRevisar = (c: Ctx, proyectoId: string, entregableId: string) => Promise<void>;
let alRevisar: AlRevisar | null = null;
export const cuandoPaseARevision = (f: AlRevisar) => (alRevisar = f);

async function editarEntregable(c: Ctx, entId: string): Promise<Response> {
  const [e] = await c.db.select().from(entregables).where(eq(entregables.id, entId));
  if (!e) return json({ error: 'no existe' }, 404);
  const d = await leer(c);
  const set: Partial<typeof entregables.$inferInsert> = { actualizado: ahora() };
  if ('titulo' in d && texto(d.titulo, 200)) set.titulo = texto(d.titulo, 200)!;
  if ('descripcion' in d) set.descripcion = texto(d.descripcion, 2000);
  if ('vence' in d) set.vence = fecha(d.vence);
  if ('etapaId' in d) set.etapaId = typeof d.etapaId === 'string' && d.etapaId ? d.etapaId : null;
  if ('visibleCliente' in d) set.visibleCliente = d.visibleCliente === true;
  if ('estado' in d) {
    if (!ESTADOS_ENTREGABLE.includes(d.estado as (typeof ESTADOS_ENTREGABLE)[number])) return json({ errores: { estado: 'Estado inválido' } }, 422);
    set.estado = d.estado as (typeof ESTADOS_ENTREGABLE)[number];
    // Una nueva ronda de revisión es una versión nueva.
    if (set.estado === 'en_revision' && e.estado === 'cambios') set.version = e.version + 1;
    if (set.estado !== 'aprobado') Object.assign(set, { aprobadoPor: null, aprobadoEn: null });
    else Object.assign(set, { aprobadoPor: c.sesion.usuario.email, aprobadoEn: ahora() });
  }
  const notas =
    set.estado && set.estado !== e.estado
      ? [c.db.insert(bitacora).values(nota(e.proyectoId, 'equipo', c.sesion.usuario.email, 'entregable', `${e.titulo}: ${ESTADO_ENTREGABLE[set.estado]}`, e.visibleCliente || set.visibleCliente === true))]
      : [];
  await c.db.batch([c.db.update(entregables).set(set).where(eq(entregables.id, entId)), tocar(c, e.proyectoId), ...notas]);
  if (set.estado === 'en_revision' && e.estado !== 'en_revision' && (set.visibleCliente ?? e.visibleCliente) && alRevisar) c.diferir(alRevisar(c, e.proyectoId, entId).catch((x) => console.error('[proyectos] aviso de revisión', x)));
  return verProyecto(c, e.proyectoId);
}

export const ESTADO_ENTREGABLE: Record<(typeof ESTADOS_ENTREGABLE)[number], string> = { borrador: 'en preparación', en_revision: 'en revisión', aprobado: 'aprobado', cambios: 'con cambios pedidos' };

async function borrarParte(c: Ctx, que: 'etapas' | 'tareas' | 'entregables', id: string): Promise<Response> {
  const tabla = que === 'etapas' ? etapas : que === 'tareas' ? tareas : entregables;
  const [x] = await c.db.select({ proyectoId: tabla.proyectoId }).from(tabla).where(eq(tabla.id, id));
  if (!x) return json({ error: 'no existe' }, 404);
  if (que === 'entregables') {
    const archivos = await c.db.select().from(archivosEntregable).where(eq(archivosEntregable.entregableId, id));
    for (const a of archivos) await c.env.ARCHIVOS?.delete(a.claveR2);
    await c.db.delete(archivosEntregable).where(eq(archivosEntregable.entregableId, id));
  }
  if (que === 'etapas') await c.db.batch([c.db.update(tareas).set({ etapaId: null }).where(eq(tareas.etapaId, id)), c.db.update(entregables).set({ etapaId: null }).where(eq(entregables.etapaId, id))]);
  await c.db.batch([c.db.delete(tabla).where(eq(tabla.id, id)), tocar(c, x.proyectoId)]);
  return verProyecto(c, x.proyectoId);
}

async function crearNota(c: Ctx, id: string): Promise<Response> {
  if (!(await existeProyecto(c, id))) return json({ error: 'no existe' }, 404);
  const d = await leer(c);
  const t = texto(d.texto, 4000);
  if (!t) return json({ errores: { texto: 'Escribe la nota' } }, 422);
  await c.db.batch([c.db.insert(bitacora).values(nota(id, 'equipo', c.sesion.usuario.email, 'nota', t, d.visibleCliente === true)), tocar(c, id)]);
  return verProyecto(c, id);
}

// Archivos de entregables (bucket privado) ------------------------------------------------

async function subirArchivo(c: Ctx, entId: string): Promise<Response> {
  if (!c.env.ARCHIVOS) return json({ error: 'sin_bucket' }, 503);
  const [e] = await c.db.select().from(entregables).where(eq(entregables.id, entId));
  if (!e) return json({ error: 'no existe' }, 404);
  if (Number(c.req.headers.get('content-length')) > MAX_BYTES_ARCHIVO + 64 * 1024) return json({ error: 'grande' }, 413);
  const form = await c.req.formData().catch(() => null);
  const archivo = form?.get('archivo');
  if (!archivo || typeof archivo === 'string') return json({ error: 'archivo' }, 422);
  if (archivo.size > MAX_BYTES_ARCHIVO) return json({ error: 'grande' }, 413);
  const id = uuid();
  const nombre = nombreLimpio(archivo.name);
  const claveR2 = `proyectos/${e.proyectoId}/${id}`;
  const metadatos = { httpMetadata: { contentType: archivo.type || 'application/octet-stream' } };
  if (typeof FixedLengthStream === 'function') {
    // R2 necesita saber el largo de un stream; así no se carga el archivo entero en memoria.
    const { readable, writable } = new FixedLengthStream(archivo.size);
    await Promise.all([c.env.ARCHIVOS.put(claveR2, readable, metadatos), archivo.stream().pipeTo(writable)]);
  } else {
    // Fuera de workerd (pruebas en Node) no existe FixedLengthStream.
    await c.env.ARCHIVOS.put(claveR2, await archivo.arrayBuffer(), metadatos);
  }
  const t = ahora();
  await c.db.batch([
    c.db.insert(archivosEntregable).values({ id, entregableId: entId, version: e.version, claveR2, nombre, mime: (archivo.type || 'application/octet-stream').slice(0, 100), bytes: archivo.size, subido: t, autor: c.sesion.usuario.email }),
    c.db.insert(bitacora).values(nota(e.proyectoId, 'equipo', c.sesion.usuario.email, 'archivo', `${e.titulo}: archivo ${nombre}`, e.visibleCliente)),
    c.db.update(entregables).set({ actualizado: t }).where(eq(entregables.id, entId)),
    tocar(c, e.proyectoId),
  ]);
  return auditar(c, await verProyecto(c, e.proyectoId), 'entregable.archivo', 'proyecto', e.proyectoId);
}

/** Descarga un archivo de R2. Siempre como adjunto y con nosniff: nunca se muestra dentro del panel. */
export async function respuestaArchivo(env: Ctx['env'], a: typeof archivosEntregable.$inferSelect): Promise<Response> {
  const obj = await env.ARCHIVOS?.get(a.claveR2);
  if (!obj) return json({ error: 'no existe' }, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
      'content-length': String(a.bytes),
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
}

async function descargarArchivo(c: Ctx, id: string): Promise<Response> {
  const [a] = await c.db.select().from(archivosEntregable).where(eq(archivosEntregable.id, id));
  return a ? respuestaArchivo(c.env, a) : json({ error: 'no existe' }, 404);
}

async function borrarArchivo(c: Ctx, id: string): Promise<Response> {
  const [x] = await c.db
    .select({ a: archivosEntregable, proyectoId: entregables.proyectoId })
    .from(archivosEntregable)
    .innerJoin(entregables, eq(entregables.id, archivosEntregable.entregableId))
    .where(eq(archivosEntregable.id, id));
  if (!x) return json({ error: 'no existe' }, 404);
  await c.env.ARCHIVOS?.delete(x.a.claveR2);
  await c.db.delete(archivosEntregable).where(eq(archivosEntregable.id, id));
  return verProyecto(c, x.proyectoId);
}
