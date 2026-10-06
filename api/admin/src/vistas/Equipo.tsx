// Equipo: quién entra al panel y con qué rol. Solo quien tiene equipo.gestionar cambia algo.
import { ROLES as LISTA_ROLES, type Rol } from '@api/dominio';
import { api, mensajeError, useDatos, ErrorApi } from '../api';
import { usePuede, useYo } from '../sesion';
import { ROLES } from '../textos';
import { fecha } from '../formato';
import type { Usuario } from '../tipos';
import { Boton, Cabecera, Campo, FalloCarga, Insignia, Tarjeta, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';

export default function Equipo() {
  const yo = useYo();
  const puede = usePuede();
  const gestiona = puede('equipo.gestionar');
  const d = useDatos<{ usuarios: Usuario[] }>('/admin/api/usuarios');

  const cambiar = async (u: Usuario, cambios: Partial<Pick<Usuario, 'rol' | 'activo'>>) => {
    if (cambios.activo === false && !(await confirmar({ titulo: `Quitar el acceso a ${u.nombre}`, texto: 'Se cierran todas sus sesiones y ya no puede pedir enlaces de acceso. Puedes devolvérselo después.', confirmar: 'Quitar acceso', peligro: true })))
      return;
    try {
      d.poner(await api<{ usuarios: Usuario[] }>(`/admin/api/usuarios/${u.id}`, { method: 'PATCH', body: cambios }));
      avisar('Equipo actualizado', 'exito');
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  };

  const agregar = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    try {
      d.poner(await api<{ usuarios: Usuario[] }>('/admin/api/usuarios', { body: Object.fromEntries(new FormData(form)) }));
      form.reset();
      avisar('Listo. Ya puede pedir su enlace de acceso.', 'exito');
    } catch (err) {
      avisar(err instanceof ErrorApi && err.datos.error === 'existe' ? 'Ese correo ya está en el equipo.' : mensajeError(err, 'Revisa el nombre y el correo.'), 'error');
    }
  };

  return (
    <>
      <Cabecera titulo="Equipo" descripcion="Personas con acceso al panel. Entran con un enlace a su correo, sin contraseñas." />
      <div class="rejilla-lateral">
        <div class="tarjeta sin-relleno">
          {d.error ? (
            <FalloCarga error={d.error} reintentar={d.recargar} />
          ) : !d.datos ? (
            <Cargando />
          ) : (
            <div class="tabla-envoltura">
              <table class="tabla tabla-filas">
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Acceso</th>
                    {gestiona && <th scope="col"><span class="sr">Acciones</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {d.datos.usuarios.map((u) => (
                    <tr class={u.activo ? '' : 'inactiva'}>
                      <td>
                        <strong>{u.nombre}</strong>
                        {u.id === yo.id && <span class="suave"> (tú)</span>}
                        <span class="fila-sub">{u.email}</span>
                      </td>
                      <td>
                        {gestiona && u.id !== yo.id ? (
                          <>
                            <label class="sr" for={`rol-${u.id}`}>
                              Rol de {u.nombre}
                            </label>
                            <select id={`rol-${u.id}`} value={u.rol} onChange={(e) => cambiar(u, { rol: (e.target as HTMLSelectElement).value as Rol })}>
                              {LISTA_ROLES.map((r) => (
                                <option value={r}>{ROLES[r].nombre}</option>
                              ))}
                            </select>
                          </>
                        ) : (
                          ROLES[u.rol]?.nombre ?? u.rol
                        )}
                      </td>
                      <td>
                        <Insignia tono={u.activo ? 'exito' : 'apagado'}>{u.activo ? 'Activo' : 'Sin acceso'}</Insignia>
                        <span class="fila-sub">desde {fecha(u.creado)}</span>
                      </td>
                      {gestiona && (
                        <td class="num">
                          {u.id !== yo.id && (
                            <Boton chico variante={u.activo ? 'fantasma' : 'secundario'} onClick={() => cambiar(u, { activo: !u.activo })}>
                              {u.activo ? 'Quitar acceso' : 'Devolver acceso'}
                            </Boton>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div class="columna-lateral">
          {gestiona && (
            <Tarjeta titulo="Agregar persona">
              <form class="formulario" onSubmit={agregar}>
                <Campo etiqueta="Nombre">
                  <input name="nombre" required maxLength={120} />
                </Campo>
                <Campo etiqueta="Correo">
                  <input name="email" type="email" required />
                </Campo>
                <Campo etiqueta="Rol">
                  <select name="rol" defaultValue="comercial">
                    {LISTA_ROLES.map((r) => (
                      <option value={r}>{ROLES[r].nombre}</option>
                    ))}
                  </select>
                </Campo>
                <Boton type="submit" variante="primario">
                  Agregar
                </Boton>
              </form>
            </Tarjeta>
          )}
          <Tarjeta titulo="Qué hace cada rol">
            <dl class="roles">
              {LISTA_ROLES.map((r) => (
                <div>
                  <dt>{ROLES[r].nombre}</dt>
                  <dd>{ROLES[r].descripcion}</dd>
                </div>
              ))}
            </dl>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
