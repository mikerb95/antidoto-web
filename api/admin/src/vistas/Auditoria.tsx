// Bitácora de auditoría: quién cambió qué en el panel. Sin datos personales en el detalle.
import { useDatos } from '../api';
import { ponerQuery, useUbicacion } from '../ruteo';
import { fechaLarga } from '../formato';
import type { RegistroAuditoria, Usuario } from '../tipos';
import { Cabecera, FalloCarga, Paginacion, Vacio, Cargando } from '../ui/base';

const ACCIONES: Record<string, string> = {
  'lead.editar': 'Editó una solicitud',
  'lead.suprimir': 'Suprimió los datos de una solicitud',
  'leads.exportar': 'Exportó las solicitudes a CSV',
  'contacto.invitar': 'Invitó a un contacto',
  'contactos.importar': 'Importó contactos',
  'contacto.baja': 'Dio de baja a un contacto',
  'contacto.suprimir': 'Suprimió los datos de un contacto',
  'campana.crear': 'Creó una campaña',
  'campana.editar': 'Editó una campaña',
  'campana.borrar': 'Borró una campaña',
  'campana.enviar': 'Envió una campaña',
  'campana.programar': 'Programó una campaña',
  'campana.desprogramar': 'Quitó la programación de una campaña',
  'campana.cancelar': 'Detuvo el envío de una campaña',
  'campana.duplicar': 'Duplicó una campaña',
  'plantilla.crear': 'Guardó una plantilla',
  'plantilla.borrar': 'Borró una plantilla',
  'automatico.guardar': 'Editó un correo automático',
  'automatico.restaurar': 'Restauró un correo automático',
  'usuario.crear': 'Agregó a una persona al equipo',
  'usuario.editar': 'Cambió el acceso de una persona',
  'sesion.revocar': 'Cerró una de sus sesiones',
  'config.cambiar': 'Cambió los ajustes',
  'conversacion.suprimir': 'Borró una conversación del chat',
  'contenido.crear': 'Creó contenido del sitio',
  'contenido.editar': 'Editó contenido del sitio',
  'contenido.publicar': 'Publicó contenido del sitio',
  'contenido.despublicar': 'Despublicó contenido del sitio',
  'contenido.archivar': 'Archivó contenido del sitio',
  'contenido.restaurar': 'Restauró una versión de contenido',
  'medio.subir': 'Subió una imagen',
  'medio.borrar': 'Borró una imagen',
  'sitio.publicar': 'Pidió publicar el sitio',
  'proyecto.crear': 'Creó un proyecto',
  'proyecto.editar': 'Editó un proyecto',
  'organizacion.crear': 'Creó una organización',
  'organizacion.editar': 'Editó una organización',
  'entregable.archivo': 'Subió un archivo a un entregable',
  'portal.invitar': 'Dio acceso al portal a un cliente',
  'portal.quitar': 'Quitó el acceso al portal a un cliente',
};

const ENLACES: Record<string, (id: string) => string> = {
  lead: (id) => `/admin/solicitudes/${id}`,
  contacto: (id) => `/admin/contactos/${id}`,
  campana: (id) => `/admin/campanas/${id}`,
  conversacion: (id) => `/admin/conversaciones/${id}`,
  contenido: (id) => `/admin/contenido/${id}`,
  proyecto: (id) => `/admin/proyectos/${id}`,
  organizacion: (id) => `/admin/organizaciones/${id}`,
};

export default function Auditoria() {
  const { query } = useUbicacion();
  const usuario = query.get('usuario') ?? '';
  const accion = query.get('accion') ?? '';
  const pagina = Number(query.get('pagina')) || 0;
  const filtros = new URLSearchParams(Object.entries({ usuario, accion, pagina: pagina ? String(pagina) : '' }).filter(([, v]) => v));
  const d = useDatos<{ registros: RegistroAuditoria[]; total: number; pagina: number; porPagina: number }>(`/admin/api/auditoria?${filtros}`);
  const equipo = useDatos<{ usuarios: Usuario[] }>('/admin/api/usuarios');
  const grupos = [...new Set(Object.keys(ACCIONES).map((a) => a.split('.')[0]!))];
  const NOMBRES_GRUPO: Record<string, string> = {
    lead: 'Solicitudes', leads: 'Solicitudes (exportar)', contacto: 'Contactos', contactos: 'Contactos (importar)', campana: 'Campañas', plantilla: 'Plantillas', automatico: 'Correos automáticos',
    usuario: 'Equipo', sesion: 'Sesiones', config: 'Ajustes', conversacion: 'Conversaciones', contenido: 'Contenido', medio: 'Imágenes', sitio: 'Publicación',
    proyecto: 'Proyectos', organizacion: 'Organizaciones', entregable: 'Entregables', portal: 'Portal',
  };

  return (
    <>
      <Cabecera titulo="Auditoría" descripcion="Cada cambio hecho desde el panel, con quién y cuándo. No guarda datos personales." />
      <div class="barra-filtros">
        <div class="filtros-derecha filtros-izq">
          <label class="sr" for="f-usuario">
            Persona
          </label>
          <select id="f-usuario" value={usuario} onChange={(e) => ponerQuery({ usuario: (e.target as HTMLSelectElement).value, pagina: null })}>
            <option value="">Todo el equipo</option>
            {equipo.datos?.usuarios.map((u) => (
              <option value={u.id}>{u.nombre}</option>
            ))}
          </select>
          <label class="sr" for="f-accion">
            Tipo de cambio
          </label>
          <select id="f-accion" value={accion} onChange={(e) => ponerQuery({ accion: (e.target as HTMLSelectElement).value, pagina: null })}>
            <option value="">Todos los cambios</option>
            {grupos.map((g) => (
              <option value={`${g}.`}>{NOMBRES_GRUPO[g] ?? g}</option>
            ))}
          </select>
        </div>
      </div>
      <div class="tarjeta sin-relleno">
        {d.error ? (
          <FalloCarga error={d.error} reintentar={d.recargar} />
        ) : !d.datos ? (
          <Cargando />
        ) : !d.datos.registros.length ? (
          <Vacio titulo="Sin registros">Los cambios que haga el equipo desde el panel aparecen aquí.</Vacio>
        ) : (
          <div class={`tabla-envoltura${d.cargando ? ' recargando' : ''}`}>
            <table class="tabla tabla-filas">
              <thead>
                <tr>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Quién</th>
                  <th scope="col">Qué</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {d.datos.registros.map((r) => (
                  <tr>
                    <td class="suave sin-salto">{fechaLarga(r.creado)}</td>
                    <td>{r.usuarioEmail ?? 'Sistema'}</td>
                    <td>
                      {r.entidad && r.entidadId && ENLACES[r.entidad] ? <a href={ENLACES[r.entidad]!(r.entidadId)}>{ACCIONES[r.accion] ?? r.accion}</a> : (ACCIONES[r.accion] ?? r.accion)}
                    </td>
                    <td class="suave texto-chico">{detalle(r.detalle)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.datos && <Paginacion total={d.datos.total} pagina={d.datos.pagina} porPagina={d.datos.porPagina} alCambiar={(p) => ponerQuery({ pagina: p })} />}
      </div>
    </>
  );
}

function detalle(d: Record<string, unknown> | null): string {
  if (!d) return '';
  return Object.entries(d)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}
