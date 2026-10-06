// Quién de la organización entra al portal de proyectos. Se da acceso a un contacto con correo y
// le llega una invitación; quitarlo cierra sus sesiones.
import { useState } from 'preact/hooks';
import { api, mensajeError, useDatos, ErrorApi } from '../api';
import { hace } from '../formato';
import { Boton, Insignia, Tarjeta } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';

interface Acceso {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
  ultimoAcceso: number | null;
}

export function AccesosPortal({ organizacionId, contactos }: { organizacionId: string; contactos: { id: string; nombre: string | null; email: string | null; anonimizado: number | null }[] }) {
  const d = useDatos<{ accesos: Acceso[]; portal: string }>(`/admin/api/organizaciones/${organizacionId}/accesos`);
  const [elegido, setElegido] = useState('');
  const conAcceso = new Set(d.datos?.accesos.filter((a) => a.activo).map((a) => a.email));
  const candidatos = contactos.filter((c) => c.email && !c.anonimizado && !conAcceso.has(c.email));

  const invitar = async () => {
    try {
      d.poner(await api(`/admin/api/organizaciones/${organizacionId}/accesos`, { body: { contactoId: elegido } }));
      setElegido('');
      avisar('Acceso dado. Le llegó una invitación por correo.', 'exito');
    } catch (e) {
      avisar(e instanceof ErrorApi && e.datos.error === 'otra_organizacion' ? 'Ese correo ya tiene acceso al portal con otra organización.' : mensajeError(e), 'error');
    }
  };
  const cambiar = async (a: Acceso) => {
    if (a.activo && !(await confirmar({ titulo: 'Quitar acceso al portal', texto: `${a.nombre ?? a.email} deja de ver los proyectos y se cierran sus sesiones.`, confirmar: 'Quitar acceso', peligro: true }))) return;
    try {
      d.poner(await api(`/admin/api/accesos/${a.id}/${a.activo ? 'quitar' : 'devolver'}`, { method: 'POST' }));
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  };

  return (
    <Tarjeta titulo="Portal de proyectos">
      <p class="suave texto-chico">
        El cliente ve el avance, descarga los entregables visibles, los aprueba o pide cambios y comenta.{' '}
        {d.datos && (
          <a href={d.datos.portal} target="_blank" rel="noopener">
            Abrir el portal
          </a>
        )}
      </p>
      {d.datos?.accesos.length ? (
        <ul class="lista-simple">
          {d.datos.accesos.map((a) => (
            <li>
              <span>
                <strong>{a.nombre ?? a.email}</strong>
                <span class="fila-sub">
                  {a.email} · {a.ultimoAcceso ? `entró ${hace(a.ultimoAcceso)}` : 'no ha entrado'}
                </span>
              </span>
              {a.activo ? <Insignia tono="exito">Con acceso</Insignia> : <Insignia tono="apagado">Sin acceso</Insignia>}
              <Boton chico variante="fantasma" onClick={() => cambiar(a)}>
                {a.activo ? 'Quitar' : 'Devolver'}
              </Boton>
            </li>
          ))}
        </ul>
      ) : (
        <p class="suave texto-chico">Nadie de esta organización tiene acceso todavía.</p>
      )}
      {candidatos.length > 0 ? (
        <div class="form-linea">
          <label class="sr" for={`acceso-${organizacionId}`}>
            Contacto
          </label>
          <select id={`acceso-${organizacionId}`} value={elegido} onChange={(e) => setElegido((e.target as HTMLSelectElement).value)}>
            <option value="">Elige un contacto</option>
            {candidatos.map((c) => (
              <option value={c.id}>
                {c.nombre ? `${c.nombre} (${c.email})` : c.email}
              </option>
            ))}
          </select>
          <Boton disabled={!elegido} onClick={invitar}>
            Dar acceso
          </Boton>
        </div>
      ) : (
        !contactos.some((c) => c.email && !c.anonimizado) && <p class="suave texto-chico">Para dar acceso, agrega primero un contacto con correo a la organización.</p>
      )}
    </Tarjeta>
  );
}
