// Mi cuenta: datos propios y sesiones abiertas en otros navegadores.
import { api, mensajeError, useDatos } from '../api';
import { useYo } from '../sesion';
import { ROLES } from '../textos';
import { dispositivo, fecha, hace } from '../formato';
import { Boton, Cabecera, Datos, FalloCarga, Insignia, Tarjeta, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';

interface SesionAbierta {
  id: string | null;
  creada: number;
  ultimoUso: number;
  expira: number;
  userAgent: string | null;
  actual: boolean;
}

export default function Cuenta() {
  const yo = useYo();
  const d = useDatos<{ sesiones: SesionAbierta[] }>('/admin/api/yo/sesiones');

  const revocar = async (s: SesionAbierta) => {
    try {
      d.poner(await api(`/admin/api/yo/sesiones/${s.id}/revocar`, { method: 'POST' }));
      avisar('Sesión cerrada', 'exito');
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  };

  const cerrarTodas = async () => {
    if (!(await confirmar({ titulo: 'Cerrar todas las sesiones', texto: 'Se cierran todas tus sesiones, también esta. Para volver a entrar pides un enlace nuevo.', confirmar: 'Cerrar todas', peligro: true }))) return;
    await api('/auth/salir?todas=1', { method: 'POST' }).catch(() => null);
    location.href = '/admin/';
  };

  const otras = d.datos?.sesiones.filter((s) => !s.actual && s.id) ?? [];
  return (
    <>
      <Cabecera titulo="Mi cuenta" />
      <div class="rejilla-2">
        <Tarjeta titulo="Tus datos">
          <Datos filas={[['Nombre', yo.nombre], ['Correo', yo.email], ['Rol', ROLES[yo.rol]?.nombre ?? yo.rol]]} />
          <p class="suave texto-chico">{ROLES[yo.rol]?.descripcion}</p>
          <p class="suave texto-chico">Para cambiar tu nombre, correo o rol, pídeselo a una persona con rol Admin.</p>
        </Tarjeta>
        <Tarjeta
          titulo="Sesiones abiertas"
          acciones={
            <Boton variante="peligro" chico onClick={cerrarTodas}>
              Cerrar todas
            </Boton>
          }
        >
          {d.error ? (
            <FalloCarga error={d.error} reintentar={d.recargar} />
          ) : !d.datos ? (
            <Cargando />
          ) : (
            <ul class="lista-simple">
              {d.datos.sesiones.map((s) => (
                <li>
                  <span>
                    <strong>{dispositivo(s.userAgent)}</strong>
                    <span class="fila-sub">
                      Abierta el {fecha(s.creada)} · usada {hace(s.ultimoUso)} · vence el {fecha(s.expira)}
                    </span>
                  </span>
                  {s.actual ? (
                    <Insignia tono="exito">Esta sesión</Insignia>
                  ) : (
                    s.id && (
                      <Boton chico variante="fantasma" onClick={() => revocar(s)}>
                        Cerrar
                      </Boton>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
          {otras.length === 0 && d.datos && <p class="suave texto-chico">No tienes sesiones abiertas en otros navegadores.</p>}
        </Tarjeta>
      </div>
    </>
  );
}
