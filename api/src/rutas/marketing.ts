// Email marketing: contactos, campañas, plantillas y correos automáticos.
import * as mk from '../marketing/admin';
import { auditar, sinPermiso, type Ctx } from './contexto';

const RE_CONTACTO = /^\/admin\/api\/contactos\/([0-9a-f-]{36})(\/baja|\/suprimir)?$/;
const RE_CAMPANA = /^\/admin\/api\/campanas\/([0-9a-f-]{36})(\/vista|\/prueba|\/enviar|\/cancelar|\/programar|\/desprogramar|\/duplicar)?$/;
const RE_PLANTILLA = /^\/admin\/api\/plantillas\/([0-9a-f-]{36})$/;
const RE_AUTOMATICO = /^\/admin\/api\/automaticos\/([a-z]+:(?:es|en))(\/vista|\/prueba)?$/;

export async function rutasMarketing(c: Ctx): Promise<Response | null> {
  const { ruta, metodo, url, db, env, req, sesion, appUrl, diferir } = c;
  const ver = () => sinPermiso(c, 'marketing.ver');
  const editar = () => sinPermiso(c, 'marketing.editar');
  const enviar = () => sinPermiso(c, 'marketing.enviar');

  if (ruta === '/admin/api/marketing' && metodo === 'GET') return ver() ?? mk.metricasMarketing(url, db);
  if (ruta === '/admin/api/contactos/importar' && metodo === 'POST') return editar() ?? auditar(c, await mk.importarContactos(req, db), 'contactos.importar');
  if (ruta === '/admin/api/contactos' && metodo === 'GET') return ver() ?? mk.listarContactos(url, db);
  if (ruta === '/admin/api/contactos' && metodo === 'POST') return editar() ?? auditar(c, await mk.invitarContacto(req, env, db, appUrl), 'contacto.invitar');

  const contacto = ruta.match(RE_CONTACTO);
  if (contacto) {
    const [, id, accion] = contacto as unknown as [string, string, string | undefined];
    if (!accion && metodo === 'GET') return ver() ?? mk.verContacto(id, db);
    if (accion === '/baja' && metodo === 'POST') return editar() ?? auditar(c, await mk.bajaContacto(id, db), 'contacto.baja', 'contacto', id);
    if (accion === '/suprimir' && metodo === 'POST') return sinPermiso(c, 'datos.suprimir') ?? auditar(c, await mk.suprimirContacto(id, db), 'contacto.suprimir', 'contacto', id);
    return null;
  }

  if (ruta === '/admin/api/campanas' && metodo === 'GET') return ver() ?? mk.listarCampanas(db);
  if (ruta === '/admin/api/campanas' && metodo === 'POST') return editar() ?? auditar(c, await mk.crearCampana(req, db, sesion), 'campana.crear');
  const campana = ruta.match(RE_CAMPANA);
  if (campana) {
    const [, id, accion] = campana as unknown as [string, string, string | undefined];
    const a = (res: Response, nombre: string) => auditar(c, res, `campana.${nombre}`, 'campana', id);
    if (!accion && metodo === 'GET') return ver() ?? mk.verCampana(id, db);
    if (!accion && metodo === 'PATCH') return editar() ?? a(await mk.editarCampana(id, req, db), 'editar');
    if (!accion && metodo === 'DELETE') return editar() ?? a(await mk.borrarCampana(id, db), 'borrar');
    if (accion === '/vista' && metodo === 'GET') return ver() ?? mk.vistaCampana(id, env, db, appUrl);
    if (accion === '/prueba' && metodo === 'POST') return editar() ?? mk.probarCampana(id, env, db, sesion, appUrl);
    if (accion === '/enviar' && metodo === 'POST') return enviar() ?? a(await mk.enviarCampana(id, req, env, db, appUrl, diferir), 'enviar');
    if (accion === '/cancelar' && metodo === 'POST') return editar() ?? a(await mk.cancelarCampana(id, db), 'cancelar');
    if (accion === '/programar' && metodo === 'POST') return enviar() ?? a(await mk.programarCampana(id, req, env, db, appUrl), 'programar');
    if (accion === '/desprogramar' && metodo === 'POST') return editar() ?? a(await mk.desprogramarCampana(id, db), 'desprogramar');
    if (accion === '/duplicar' && metodo === 'POST') return editar() ?? a(await mk.duplicarCampana(id, db, sesion), 'duplicar');
    return null;
  }

  if (ruta === '/admin/api/plantillas' && metodo === 'GET') return ver() ?? mk.listarPlantillas(db);
  if (ruta === '/admin/api/plantillas' && metodo === 'POST') return editar() ?? auditar(c, await mk.crearPlantilla(req, db, sesion), 'plantilla.crear');
  const plantilla = ruta.match(RE_PLANTILLA);
  if (plantilla && metodo === 'DELETE') return editar() ?? auditar(c, await mk.borrarPlantilla(plantilla[1]!, db), 'plantilla.borrar', 'plantilla', plantilla[1]!);

  if (ruta === '/admin/api/automaticos' && metodo === 'GET') return ver() ?? mk.listarAutomaticos(db);
  const auto = ruta.match(RE_AUTOMATICO);
  if (auto) {
    const [, clave, accion] = auto as unknown as [string, string, string | undefined];
    if (!accion && metodo === 'PUT') return editar() ?? auditar(c, await mk.guardarAutomatico(clave, req, db, sesion), 'automatico.guardar', 'automatico', clave);
    if (!accion && metodo === 'DELETE') return editar() ?? auditar(c, await mk.restaurarAutomatico(clave, db), 'automatico.restaurar', 'automatico', clave);
    if (accion === '/vista' && metodo === 'GET') return ver() ?? mk.vistaAutomatico(clave, env, db, appUrl);
    if (accion === '/prueba' && metodo === 'POST') return editar() ?? mk.probarAutomatico(clave, env, db, sesion, appUrl);
  }
  return null;
}
