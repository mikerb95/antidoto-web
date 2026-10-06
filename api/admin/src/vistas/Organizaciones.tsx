// Organizaciones (clientes) y su ficha: contactos, proyectos, solicitudes y conversaciones del chat
// que las trajeron, en un solo lugar.
import { useState } from 'preact/hooks';
import type { Estado, ServicioId } from '@api/dominio';
import { api, mensajeError, useDatos } from '../api';
import { navegar } from '../ruteo';
import { usePuede } from '../sesion';
import { ESTADOS, SERVICIOS } from '../textos';
import { fecha, pesos } from '../formato';
import { Boton, Buscador, Cabecera, Campo, Cifra, Cifras, FalloCarga, Insignia, Tarjeta, Vacio, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';
import { Icono } from '../ui/iconos';
import { ESTADOS_PROYECTO, type EstadoProyecto } from './Proyectos';
import { TONO_ESTADO } from './Solicitudes';
import { AccesosPortal } from './AccesosPortal';

export default function Organizaciones({ params }: { params: string[] }) {
  return params[0] ? <Ficha id={params[0]} /> : <Lista />;
}

function Lista() {
  const puede = usePuede();
  const [q, setQ] = useState('');
  const [nueva, setNueva] = useState(false);
  const d = useDatos<{ organizaciones: { id: string; nombre: string; sector: string | null; proyectos: number; activos: number }[] }>(`/admin/api/organizaciones${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  return (
    <>
      <Cabecera
        titulo="Organizaciones"
        descripcion="Los clientes con los que hay o hubo proyectos. Se crean solas al convertir una solicitud ganada en proyecto."
        acciones={
          puede('proyectos.editar') && (
            <Boton variante="primario" aria-expanded={nueva} onClick={() => setNueva(!nueva)}>
              <Icono nombre="mas" /> Nueva organización
            </Boton>
          )
        }
      />
      {nueva && (
        <Tarjeta titulo="Nueva organización">
          <form
            class="formulario fila-formulario"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await api<{ organizacion: { id: string } }>('/admin/api/organizaciones', { body: Object.fromEntries(new FormData(e.target as HTMLFormElement)) });
                navegar(`/admin/organizaciones/${r.organizacion.id}`);
              } catch (err) {
                avisar(mensajeError(err, 'Revisa el nombre.'), 'error');
              }
            }}
          >
            <Campo etiqueta="Nombre">
              <input name="nombre" required maxLength={160} />
            </Campo>
            <Campo etiqueta="NIT">
              <input name="nit" maxLength={40} />
            </Campo>
            <Campo etiqueta="Sector">
              <input name="sector" maxLength={80} />
            </Campo>
            <Boton type="submit" variante="primario">
              Crear
            </Boton>
          </form>
        </Tarjeta>
      )}
      <div class="barra-filtros">
        <div class="filtros-derecha filtros-izq">
          <Buscador etiqueta="Buscar organizaciones" placeholder="Nombre" valor={q} alCambiar={setQ} />
        </div>
      </div>
      <div class="tarjeta sin-relleno">
        {d.error ? (
          <FalloCarga error={d.error} reintentar={d.recargar} />
        ) : !d.datos ? (
          <Cargando />
        ) : !d.datos.organizaciones.length ? (
          <Vacio titulo="Todavía no hay organizaciones">Aparecen al crear el primer proyecto.</Vacio>
        ) : (
          <ul class="lista-filas">
            {d.datos.organizaciones.map((o) => (
              <li>
                <a class="lf-enlace" href={`/admin/organizaciones/${o.id}`}>
                  <span class="lf-principal">
                    <span class="lf-titulo">{o.nombre}</span>
                    <span class="lf-sub">{o.sector ?? 'Sin sector'}</span>
                  </span>
                  <span class="lf-meta">
                    {o.activos ? `${o.activos} activos · ` : ''}
                    {o.proyectos} {o.proyectos === 1 ? 'proyecto' : 'proyectos'}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

interface FichaOrg {
  organizacion: { id: string; nombre: string; nit: string | null; sector: string | null; sitio: string | null; notas: string | null; creado: number };
  contactos: { id: string; nombre: string | null; email: string | null; telefono: string | null; cargo: string | null; anonimizado: number | null }[];
  proyectos: { id: string; codigo: string; nombre: string; linea: ServicioId; estado: EstadoProyecto; valor: number | null; entrega: string | null }[];
  solicitudes: { id: string; nombre: string | null; servicio: ServicioId; estado: Estado; creado: number; conversacionId: string | null; anonimizado: number | null }[];
  conversaciones: { id: string; creada: number; preguntas: number; servicio: ServicioId | null }[];
}

function Ficha({ id }: { id: string }) {
  const d = useDatos<FichaOrg>(`/admin/api/organizaciones/${id}`);
  const puede = usePuede();
  const editable = puede('proyectos.editar');
  if (d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!d.datos) return <Cargando />;
  const { organizacion: o, contactos, proyectos, solicitudes, conversaciones } = d.datos;
  const hacer = async (ruta: string, metodo: string, cuerpo?: unknown, exito?: string) => {
    try {
      d.poner(await api<FichaOrg>(ruta, { method: metodo, body: cuerpo }));
      if (exito) avisar(exito, 'exito');
      return true;
    } catch (e) {
      avisar(mensajeError(e, 'Revisa los datos.'), 'error');
      return false;
    }
  };
  const valorTotal = proyectos.reduce((a, p) => a + (p.valor ?? 0), 0);
  const visibles = contactos.filter((c) => !c.anonimizado);

  return (
    <>
      <Cabecera titulo={o.nombre} volver={{ href: '/admin/organizaciones', texto: 'Organizaciones' }} descripcion={[o.sector, o.nit ? `NIT ${o.nit}` : null, `cliente desde el ${fecha(o.creado)}`].filter(Boolean).join(' · ')} />
      <Cifras>
        <Cifra etiqueta="Proyectos" valor={proyectos.length} nota={`${proyectos.filter((p) => ['planeado', 'en_curso', 'en_pausa'].includes(p.estado)).length} activos`} />
        {puede('proyectos.valor') && <Cifra etiqueta="Valor de los proyectos" valor={pesos(valorTotal)} nota="suma de todos" />}
        {puede('leads.ver') && <Cifra etiqueta="Solicitudes" valor={solicitudes.length} nota="que llegaron por el cotizador" />}
        {puede('asesor.ver') && <Cifra etiqueta="Conversaciones" valor={conversaciones.length} nota="con el chat antes de cotizar" />}
      </Cifras>
      <div class="editor-campana">
        <div class="columna-principal">
          <Tarjeta titulo="Proyectos" sinRelleno>
            {proyectos.length ? (
              <ul class="lista-filas">
                {proyectos.map((p) => (
                  <li>
                    <a class="lf-enlace" href={`/admin/proyectos/${p.id}`}>
                      <span class="lf-principal">
                        <span class="lf-titulo">{p.nombre}</span>
                        <span class="lf-sub">
                          {p.codigo} · {SERVICIOS[p.linea]}
                          {p.valor ? ` · ${pesos(p.valor)}` : ''}
                        </span>
                      </span>
                      <Insignia tono={ESTADOS_PROYECTO[p.estado].tono}>{ESTADOS_PROYECTO[p.estado].texto}</Insignia>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio titulo="Sin proyectos" />
            )}
          </Tarjeta>
          {puede('leads.ver') && (
            <Tarjeta titulo="Solicitudes" sinRelleno>
              {solicitudes.length ? (
                <ul class="lista-filas">
                  {solicitudes.map((s) => (
                    <li>
                      <a class="lf-enlace" href={`/admin/solicitudes/${s.id}`}>
                        <span class="lf-principal">
                          <span class="lf-titulo">{s.anonimizado ? 'Datos suprimidos' : s.nombre}</span>
                          <span class="lf-sub">
                            {SERVICIOS[s.servicio]} · {fecha(s.creado)}
                          </span>
                        </span>
                        <Insignia tono={TONO_ESTADO[s.estado]}>{ESTADOS[s.estado]}</Insignia>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vacio titulo="Sin solicitudes vinculadas" />
              )}
            </Tarjeta>
          )}
          {puede('asesor.ver') && conversaciones.length > 0 && (
            <Tarjeta titulo="Conversaciones con el chat" sinRelleno>
              <ul class="lista-filas">
                {conversaciones.map((c) => (
                  <li>
                    <a class="lf-enlace" href={`/admin/conversaciones/${c.id}`}>
                      <span class="lf-principal">
                        <span class="lf-titulo">Conversación del {fecha(c.creada)}</span>
                        <span class="lf-sub">
                          {c.preguntas} preguntas{c.servicio ? ` · ${SERVICIOS[c.servicio]}` : ''}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>
        <div class="editor-lateral">
          <Tarjeta titulo="Datos">
            <form
              class="formulario"
              onSubmit={(e) => {
                e.preventDefault();
                void hacer(`/admin/api/organizaciones/${o.id}`, 'PATCH', Object.fromEntries(new FormData(e.target as HTMLFormElement)), 'Guardado');
              }}
            >
              <fieldset disabled={!editable}>
                <Campo etiqueta="Nombre">
                  <input name="nombre" defaultValue={o.nombre} required maxLength={160} />
                </Campo>
                <div class="fila-campos">
                  <Campo etiqueta="NIT">
                    <input name="nit" defaultValue={o.nit ?? ''} maxLength={40} />
                  </Campo>
                  <Campo etiqueta="Sector">
                    <input name="sector" defaultValue={o.sector ?? ''} maxLength={80} />
                  </Campo>
                </div>
                <Campo etiqueta="Sitio web">
                  <input name="sitio" defaultValue={o.sitio ?? ''} maxLength={200} />
                </Campo>
                <Campo etiqueta="Notas internas">
                  <textarea name="notas" rows={3} defaultValue={o.notas ?? ''} maxLength={5000} />
                </Campo>
                {editable && (
                  <Boton type="submit" variante="primario">
                    Guardar
                  </Boton>
                )}
              </fieldset>
            </form>
          </Tarjeta>
          <Tarjeta titulo="Contactos">
            {visibles.length ? (
              <ul class="lista-simple">
                {visibles.map((c) => (
                  <li>
                    <span>
                      <strong>{c.nombre ?? c.email}</strong>
                      <span class="fila-sub">{[c.cargo, c.email, c.telefono].filter(Boolean).join(' · ')}</span>
                    </span>
                    {puede('datos.suprimir') && (
                      <Boton
                        chico
                        variante="fantasma"
                        onClick={async () =>
                          (await confirmar({ titulo: 'Suprimir contacto', texto: 'Se borran sus datos personales (Ley 1581). No se puede deshacer.', confirmar: 'Suprimir', peligro: true })) &&
                          hacer(`/admin/api/contactos-cliente/${c.id}`, 'DELETE', undefined, 'Contacto suprimido')
                        }
                      >
                        Suprimir
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p class="suave texto-chico">Sin contactos.</p>
            )}
            {editable && (
              <form
                class="formulario"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  if (await hacer(`/admin/api/organizaciones/${o.id}/contactos`, 'POST', Object.fromEntries(new FormData(form)), 'Contacto agregado')) form.reset();
                }}
              >
                <div class="fila-campos">
                  <Campo etiqueta="Nombre">
                    <input name="nombre" maxLength={120} />
                  </Campo>
                  <Campo etiqueta="Cargo">
                    <input name="cargo" maxLength={120} />
                  </Campo>
                </div>
                <div class="fila-campos">
                  <Campo etiqueta="Correo">
                    <input name="email" type="email" />
                  </Campo>
                  <Campo etiqueta="Teléfono">
                    <input name="telefono" inputMode="tel" maxLength={40} />
                  </Campo>
                </div>
                <Boton type="submit">Agregar contacto</Boton>
              </form>
            )}
          </Tarjeta>
          {puede('portal.gestionar') && <AccesosPortal organizacionId={o.id} contactos={contactos} />}
        </div>
      </div>
    </>
  );
}
