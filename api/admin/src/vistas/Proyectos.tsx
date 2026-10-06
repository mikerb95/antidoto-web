// Proyectos: lista con filtros por estado y responsable, y alta a mano (los que vienen de una
// solicitud ganada se crean desde la ficha de la solicitud).
import { useState } from 'preact/hooks';
import { SERVICIOS as LISTA_SERVICIOS, type ServicioId } from '@api/dominio';
import { api, mensajeError, useDatos } from '../api';
import { navegar, ponerQuery, useUbicacion } from '../ruteo';
import { usePuede, useYo } from '../sesion';
import { SERVICIOS } from '../textos';
import { fecha, pesos } from '../formato';
import type { Usuario } from '../tipos';
import { Boton, Buscador, Cabecera, Campo, Chips, FalloCarga, Insignia, Tarjeta, Vacio, Cargando } from '../ui/base';
import { avisar } from '../ui/dialogos';
import { Icono } from '../ui/iconos';

export const ESTADOS_PROYECTO = {
  planeado: { texto: 'Planeado', tono: 'info' },
  en_curso: { texto: 'En curso', tono: 'medio' },
  en_pausa: { texto: 'En pausa', tono: 'alerta' },
  entregado: { texto: 'Entregado', tono: 'exito' },
  cerrado: { texto: 'Cerrado', tono: 'apagado' },
  cancelado: { texto: 'Cancelado', tono: 'apagado' },
} as const;
export type EstadoProyecto = keyof typeof ESTADOS_PROYECTO;

interface Fila {
  id: string;
  codigo: string;
  nombre: string;
  linea: ServicioId;
  estado: EstadoProyecto;
  organizacion: string;
  responsable: string | null;
  entrega: string | null;
  valor: number | null;
  tareasAbiertas: number;
  proximoEntregable: string | null;
}

/** "2026-11-04" en texto corto. */
export const dia = (f: string | null) => (f ? fecha(Date.parse(`${f}T12:00:00-05:00`)) : '');
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(Date.now());

export default function Proyectos() {
  const { query } = useUbicacion();
  const puede = usePuede();
  const yo = useYo();
  const estado = query.get('estado') ?? 'activos';
  const responsable = query.get('responsable') ?? '';
  const q = query.get('q') ?? '';
  const [nuevo, setNuevo] = useState(false);
  const filtros = new URLSearchParams(Object.entries({ estado, responsable, q }).filter(([, v]) => v));
  const d = useDatos<{ proyectos: Fila[]; conteos: Partial<Record<EstadoProyecto, number>> }>(`/admin/api/proyectos?${filtros}`);
  const equipo = useDatos<{ usuarios: Usuario[] }>('/admin/api/usuarios');
  const c = d.datos?.conteos ?? {};
  const activos = (c.planeado ?? 0) + (c.en_curso ?? 0) + (c.en_pausa ?? 0);

  return (
    <>
      <Cabecera
        titulo="Proyectos"
        descripcion="El trabajo con cada cliente después de ganar la solicitud: etapas, tareas, entregables y bitácora."
        acciones={
          <>
            <a class="btn btn-fantasma" href="/admin/api/proyectos.csv" download>
              <Icono nombre="descargar" /> Exportar CSV
            </a>
            {puede('proyectos.editar') && (
              <Boton variante="primario" aria-expanded={nuevo} onClick={() => setNuevo(!nuevo)}>
                <Icono nombre="mas" /> Nuevo proyecto
              </Boton>
            )}
          </>
        }
      />
      {nuevo && <NuevoProyecto equipo={equipo.datos?.usuarios ?? []} />}
      <div class="barra-filtros">
        <Chips
          etiqueta="Estado"
          valor={estado}
          alCambiar={(v) => ponerQuery({ estado: v === 'activos' ? null : v })}
          opciones={[
            { valor: 'activos', texto: 'Activos', n: activos },
            ...(['entregado', 'cerrado', 'cancelado'] as const).map((e) => ({ valor: e, texto: ESTADOS_PROYECTO[e].texto, n: c[e] ?? 0 })),
            { valor: 'todos', texto: 'Todos' },
          ]}
        />
        <div class="filtros-derecha">
          <label class="sr" for="f-resp">
            Responsable
          </label>
          <select id="f-resp" value={responsable} onChange={(e) => ponerQuery({ responsable: (e.target as HTMLSelectElement).value })}>
            <option value="">Todo el equipo</option>
            <option value={yo.id}>Mis proyectos</option>
            {equipo.datos?.usuarios.filter((u) => u.activo && u.id !== yo.id).map((u) => <option value={u.id}>{u.nombre}</option>)}
          </select>
          <Buscador etiqueta="Buscar proyectos" placeholder="Nombre, código u organización" valor={q} alCambiar={(v) => ponerQuery({ q: v })} />
        </div>
      </div>
      <div class="tarjeta sin-relleno">
        {d.error ? (
          <FalloCarga error={d.error} reintentar={d.recargar} />
        ) : !d.datos ? (
          <Cargando />
        ) : !d.datos.proyectos.length ? (
          <Vacio titulo={q || responsable || estado !== 'activos' ? 'Nada con estos filtros' : 'No hay proyectos activos'}>
            Cuando una solicitud pase a Ganado, ábrela y usa "Crear proyecto". También puedes crear uno a mano.
          </Vacio>
        ) : (
          <div class={`tabla-envoltura${d.cargando ? ' recargando' : ''}`}>
            <table class="tabla tabla-filas">
              <thead>
                <tr>
                  <th scope="col">Proyecto</th>
                  <th scope="col">Estado</th>
                  <th scope="col" class="ocultar-movil">
                    Responsable
                  </th>
                  <th scope="col" class="ocultar-movil">
                    Próximo
                  </th>
                  {puede('proyectos.valor') && (
                    <th scope="col" class="num ocultar-movil">
                      Valor
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {d.datos.proyectos.map((p) => (
                  <tr>
                    <td>
                      <a class="fila-enlace" href={`/admin/proyectos/${p.id}`}>
                        {p.nombre}
                      </a>
                      <span class="fila-sub">
                        {p.codigo} · {p.organizacion} · {SERVICIOS[p.linea]}
                      </span>
                    </td>
                    <td>
                      <Insignia tono={ESTADOS_PROYECTO[p.estado].tono}>{ESTADOS_PROYECTO[p.estado].texto}</Insignia>
                    </td>
                    <td class="ocultar-movil">{p.responsable ?? <span class="suave">Sin asignar</span>}</td>
                    <td class="ocultar-movil texto-chico">
                      {p.proximoEntregable ? (
                        <span class={p.proximoEntregable < hoy() ? 'vencido' : ''}>Entregable {dia(p.proximoEntregable)}</span>
                      ) : p.entrega ? (
                        <span>Entrega {dia(p.entrega)}</span>
                      ) : (
                        <span class="suave">Sin fecha</span>
                      )}
                      <span class="fila-sub">{p.tareasAbiertas ? `${p.tareasAbiertas} tareas abiertas` : 'Sin tareas abiertas'}</span>
                    </td>
                    {puede('proyectos.valor') && <td class="num ocultar-movil">{p.valor ? pesos(p.valor) : ''}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function NuevoProyecto({ equipo }: { equipo: Usuario[] }) {
  const yo = useYo();
  const orgs = useDatos<{ organizaciones: { id: string; nombre: string }[] }>('/admin/api/organizaciones');
  const crear = async (e: Event) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target as HTMLFormElement));
    try {
      let organizacionId = f.organizacionId as string;
      if (organizacionId === '__nueva') {
        const r = await api<{ organizacion: { id: string } }>('/admin/api/organizaciones', { body: { nombre: f.orgNueva } });
        organizacionId = r.organizacion.id;
      }
      const r = await api<{ proyecto: { id: string } }>('/admin/api/proyectos', { body: { ...f, organizacionId } });
      avisar('Proyecto creado', 'exito');
      navegar(`/admin/proyectos/${r.proyecto.id}`);
    } catch (err) {
      avisar(mensajeError(err, 'Revisa el nombre, la organización y la línea.'), 'error');
    }
  };
  const [org, setOrg] = useState('');
  return (
    <Tarjeta titulo="Nuevo proyecto">
      <form class="formulario fila-formulario" onSubmit={crear}>
        <Campo etiqueta="Nombre">
          <input name="nombre" required maxLength={160} />
        </Campo>
        <Campo etiqueta="Organización">
          <select name="organizacionId" required value={org} onChange={(e) => setOrg((e.target as HTMLSelectElement).value)}>
            <option value="">Elige una</option>
            <option value="__nueva">Nueva organización</option>
            {orgs.datos?.organizaciones.map((o) => <option value={o.id}>{o.nombre}</option>)}
          </select>
        </Campo>
        {org === '__nueva' && (
          <Campo etiqueta="Nombre de la organización">
            <input name="orgNueva" required maxLength={160} />
          </Campo>
        )}
        <Campo etiqueta="Línea de servicio">
          <select name="linea" required>
            <option value="">Elige una</option>
            {LISTA_SERVICIOS.map((s) => <option value={s}>{SERVICIOS[s]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Responsable">
          <select name="responsableId">
            {equipo.filter((u) => u.activo).map((u) => (
              <option value={u.id} selected={u.id === yo.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Entrega">
          <input name="entrega" type="date" />
        </Campo>
        <Boton type="submit" variante="primario">
          Crear proyecto
        </Boton>
      </form>
    </Tarjeta>
  );
}
