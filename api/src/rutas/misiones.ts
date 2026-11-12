// Plataforma de misiones dentro del panel: resumen para Inicio y Métricas, entrada sin otra
// contraseña y enlace entre una organización y su empresa de allá. Los datos de misiones no se
// copian: se leen de su API cada vez, y la organización solo guarda el id de la empresa.
import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { organizaciones } from '../db/schema';
import { ErrorMisiones, enlaceEntrada, misionesConfiguradas, pedirMisiones, urlMisiones, type ActividadMisiones, type EmpresaMisiones, type ResumenMisiones } from '../misiones';
import { puede } from '../permisos';
import { ahora, json } from '../util';
import { auditar, cuerpoJson, sinPermiso, type Ctx } from './contexto';

const U = '([0-9a-f-]{36})';

/** La plataforma no respondió: el panel lo muestra como un aviso, no como un error propio. */
const caida = (e: unknown): Response => {
  if (!(e instanceof ErrorMisiones)) throw e;
  if (e.status !== 503) console.error('[misiones]', e.message, e.status);
  return json({ error: 'misiones', motivo: e.message }, 502);
};

export async function rutasMisiones(c: Ctx): Promise<Response | null> {
  const { ruta, metodo } = c;
  const ver = () => sinPermiso(c, 'misiones.ver');
  const gestionar = () => sinPermiso(c, 'misiones.gestionar');
  let m: RegExpMatchArray | null;

  if (ruta === '/admin/api/misiones' && metodo === 'GET') return ver() ?? resumen(c);
  if (ruta === '/admin/api/misiones/empresas' && metodo === 'GET') return ver() ?? empresas(c);
  if (ruta === '/admin/api/misiones/pase' && metodo === 'POST') return gestionar() ?? pase(c);
  if ((m = ruta.match(new RegExp(`^/admin/api/organizaciones/${U}/misiones$`)))) {
    if (metodo === 'GET') return sinPermiso(c, 'proyectos.ver') ?? ver() ?? deOrganizacion(c, m[1]!);
    if (metodo === 'PUT') return sinPermiso(c, 'proyectos.editar') ?? gestionar() ?? enlazar(c, m[1]!);
  }
  return null;
}

async function resumen(c: Ctx): Promise<Response> {
  if (!misionesConfiguradas(c.env)) return json({ configurada: false });
  try {
    const r = await pedirMisiones<ResumenMisiones>(c.env, '/api/panel/resumen');
    return json({ configurada: true, url: urlMisiones(c.env), puedeEntrar: puede(c.sesion.usuario.rol, 'misiones.gestionar'), resumen: r });
  } catch (e) {
    return caida(e);
  }
}

async function empresas(c: Ctx): Promise<Response> {
  if (!misionesConfiguradas(c.env)) return json({ configurada: false, empresas: [] });
  try {
    const [r, enlazadas] = await Promise.all([
      pedirMisiones<{ empresas: EmpresaMisiones[] }>(c.env, '/api/panel/empresas'),
      c.db.select({ id: organizaciones.id, nombre: organizaciones.nombre, empresaId: organizaciones.misionEmpresaId }).from(organizaciones).where(isNotNull(organizaciones.misionEmpresaId)),
    ]);
    const porEmpresa = new Map(enlazadas.map((o) => [o.empresaId, { id: o.id, nombre: o.nombre }]));
    return json({ configurada: true, empresas: r.empresas.map((e) => ({ ...e, organizacion: porEmpresa.get(e.id) ?? null })) });
  } catch (e) {
    return caida(e);
  }
}

async function pase(c: Ctx): Promise<Response> {
  if (!misionesConfiguradas(c.env)) return json({ error: 'sin_configurar' }, 409);
  const d = await cuerpoJson(c.req);
  const { email, nombre } = c.sesion.usuario;
  const url = await enlaceEntrada(c.env, { email, nombre }, d.destino);
  return auditar(c, json({ url }), 'misiones.entrar');
}

async function deOrganizacion(c: Ctx, id: string): Promise<Response> {
  const [org] = await c.db.select({ empresaId: organizaciones.misionEmpresaId }).from(organizaciones).where(eq(organizaciones.id, id));
  if (!org) return json({ error: 'no existe' }, 404);
  if (!misionesConfiguradas(c.env)) return json({ configurada: false, empresa: null, actividades: [] });
  if (org.empresaId === null) return json({ configurada: true, empresa: null, actividades: [] });
  try {
    const r = await pedirMisiones<{ empresa: { id: number; nombre: string; archivada: boolean }; actividades: ActividadMisiones[] }>(c.env, `/api/panel/empresas/${org.empresaId}`);
    return json({ configurada: true, ...r });
  } catch (e) {
    // La empresa ya no existe allá: se avisa para que alguien la vuelva a enlazar.
    if (e instanceof ErrorMisiones && e.status === 404) return json({ configurada: true, empresa: null, actividades: [], perdida: true });
    return caida(e);
  }
}

/** PUT { empresaId } enlaza una empresa que ya existe, { crear: true } la crea con el nombre de la organización y { empresaId: null } quita el enlace. */
async function enlazar(c: Ctx, id: string): Promise<Response> {
  const [org] = await c.db.select({ id: organizaciones.id, nombre: organizaciones.nombre }).from(organizaciones).where(eq(organizaciones.id, id));
  if (!org) return json({ error: 'no existe' }, 404);
  const d = await cuerpoJson(c.req);
  const guardar = (empresaId: number | null) => c.db.update(organizaciones).set({ misionEmpresaId: empresaId, actualizado: ahora() }).where(eq(organizaciones.id, id));

  if (d.empresaId === null) {
    await guardar(null);
    return auditar(c, await deOrganizacion(c, id), 'organizacion.misiones.desenlazar', 'organizacion', id);
  }
  if (!misionesConfiguradas(c.env)) return json({ error: 'sin_configurar' }, 409);

  let empresaId: number;
  let creada = false;
  try {
    if (d.crear === true) {
      const r = await pedirMisiones<{ empresa: { id: number; creada: boolean } }>(c.env, '/api/panel/empresas', { nombre: org.nombre, actor: c.sesion.usuario.email });
      empresaId = r.empresa.id;
      creada = r.empresa.creada;
    } else {
      if (typeof d.empresaId !== 'number' || !Number.isInteger(d.empresaId) || d.empresaId <= 0) return json({ errores: { empresaId: 'Elige una empresa' } }, 422);
      // Se confirma que existe antes de guardar el enlace.
      await pedirMisiones(c.env, `/api/panel/empresas/${d.empresaId}`);
      empresaId = d.empresaId;
    }
  } catch (e) {
    if (e instanceof ErrorMisiones && e.status === 404) return json({ errores: { empresaId: 'Esa empresa ya no existe' } }, 422);
    if (e instanceof ErrorMisiones && e.status === 422) return json({ errores: { nombre: 'El nombre de la organización debe tener entre 2 y 80 caracteres para crear su empresa' } }, 422);
    return caida(e);
  }

  // Una empresa de misiones pertenece a una sola organización.
  const [otra] = await c.db.select({ id: organizaciones.id, nombre: organizaciones.nombre }).from(organizaciones).where(and(eq(organizaciones.misionEmpresaId, empresaId), ne(organizaciones.id, id)));
  if (otra) return json({ error: 'enlazada', organizacion: otra }, 409);

  await guardar(empresaId);
  return auditar(c, await deOrganizacion(c, id), 'organizacion.misiones.enlazar', 'organizacion', id, { empresaId, creada });
}
