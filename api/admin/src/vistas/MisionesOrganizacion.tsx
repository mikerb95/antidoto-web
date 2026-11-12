// Misiones de una organización: su empresa en la plataforma de actividades, con los códigos y el
// avance de cada una. Quien puede gestionar misiones la enlaza con una empresa que ya existe o la
// crea con el mismo nombre, para no escribirla dos veces.
import { useState } from 'preact/hooks';
import { api, useDatos } from '../api';
import { cuenta } from '../formato';
import { usePuede } from '../sesion';
import { Boton, Campo, Insignia, Tarjeta } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';
import { abrirMisiones, mensajeMisiones, ESTADOS_ACTIVIDAD, type ActividadMisiones, type EmpresaMisiones } from '../misiones';

interface Datos {
  configurada: boolean;
  empresa: { id: number; nombre: string; archivada: boolean } | null;
  actividades: ActividadMisiones[];
  /** La empresa enlazada ya no existe en la plataforma. */
  perdida?: boolean;
}

type Opcion = EmpresaMisiones & { organizacion: { id: string; nombre: string } | null };

export function MisionesOrganizacion({ organizacionId, nombre }: { organizacionId: string; nombre: string }) {
  const puede = usePuede();
  const gestiona = puede('misiones.gestionar') && puede('proyectos.editar');
  const ruta = `/admin/api/organizaciones/${organizacionId}/misiones`;
  const d = useDatos<Datos>(ruta);
  const [ocupado, setOcupado] = useState(false);

  const guardar = async (cuerpo: unknown, exito: string) => {
    setOcupado(true);
    try {
      d.poner(await api<Datos>(ruta, { method: 'PUT', body: cuerpo }));
      avisar(exito, 'exito');
    } catch (e) {
      const datos = (e as { datos?: { error?: string; organizacion?: { nombre: string }; errores?: Record<string, string> } }).datos;
      if (datos?.error === 'enlazada') avisar(`Esa empresa ya está enlazada con ${datos.organizacion?.nombre ?? 'otra organización'}.`, 'error');
      else avisar(Object.values(datos?.errores ?? {})[0] ?? mensajeMisiones(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  if (d.error)
    return (
      <Tarjeta titulo="Misiones">
        <p class="suave texto-chico">
          La plataforma de misiones no respondió.{' '}
          <button type="button" class="enlace" onClick={d.recargar}>
            Intentar de nuevo
          </button>
        </p>
      </Tarjeta>
    );
  if (!d.datos || !d.datos.configurada) return null;
  const { empresa, actividades, perdida } = d.datos;

  if (!empresa)
    return (
      <Tarjeta titulo="Misiones">
        <p class="suave texto-chico">{perdida ? 'La empresa enlazada ya no existe en la plataforma de misiones.' : 'Esta organización todavía no tiene empresa en la plataforma de misiones.'}</p>
        {gestiona && <Enlazar nombre={nombre} ocupado={ocupado} guardar={guardar} />}
      </Tarjeta>
    );

  return (
    <Tarjeta titulo="Misiones">
      <p class="texto-chico">
        <strong>{empresa.nombre}</strong> {empresa.archivada && <Insignia tono="alerta">Archivada</Insignia>}
      </p>
      {actividades.length ? (
        <ul class="lista-simple">
          {actividades.map((a) => (
            <li>
              <span>
                <strong>{a.actividad}</strong>
                <span class="fila-sub">
                  Código {a.codigo} · {cuenta(a.participantes, 'participante', 'participantes')} · {a.avance} % de avance
                </span>
              </span>
              <Insignia tono={ESTADOS_ACTIVIDAD[a.estado].tono}>{ESTADOS_ACTIVIDAD[a.estado].texto}</Insignia>
            </li>
          ))}
        </ul>
      ) : (
        <p class="suave texto-chico">Sin actividades asignadas.</p>
      )}
      {gestiona && (
        <div class="fila-botones">
          <Boton chico onClick={() => abrirMisiones(`/admin/empresas/${empresa.id}`)}>
            Abrir en la plataforma
          </Boton>
          <Boton
            chico
            variante="fantasma"
            disabled={ocupado}
            onClick={async () =>
              (await confirmar({ titulo: 'Quitar el enlace', texto: 'La empresa y sus resultados siguen en la plataforma de misiones; solo dejan de verse en esta ficha.', confirmar: 'Quitar enlace' })) &&
              guardar({ empresaId: null }, 'Enlace quitado')
            }
          >
            Quitar enlace
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}

function Enlazar({ nombre, ocupado, guardar }: { nombre: string; ocupado: boolean; guardar: (cuerpo: unknown, exito: string) => Promise<void> }) {
  const d = useDatos<{ empresas: Opcion[] }>('/admin/api/misiones/empresas');
  const libres = (d.datos?.empresas ?? []).filter((e) => !e.organizacion && !e.archivada);
  // Si ya hay una empresa con el mismo nombre, esa es la que se propone.
  const igual = libres.find((e) => e.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  return (
    <form
      class="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const id = Number(new FormData(e.target as HTMLFormElement).get('empresaId'));
        if (id) void guardar({ empresaId: id }, 'Empresa enlazada');
      }}
    >
      {libres.length > 0 && (
        <>
          <Campo etiqueta="Enlazar con una empresa que ya existe">
            <select name="empresaId" required defaultValue={igual ? String(igual.id) : ''}>
              <option value="">Elige una empresa</option>
              {libres.map((e) => (
                <option value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </Campo>
          <Boton type="submit" chico disabled={ocupado}>
            Enlazar
          </Boton>
        </>
      )}
      {!igual && (
        <Boton type="button" chico variante={libres.length ? 'fantasma' : 'secundario'} disabled={ocupado} onClick={() => guardar({ crear: true }, 'Empresa creada y enlazada')}>
          Crear la empresa "{nombre}"
        </Boton>
      )}
    </form>
  );
}
