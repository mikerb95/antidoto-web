// Solicitudes del cotizador: filtros por estado y servicio, búsqueda, tabla paginada y ficha
// lateral con la gestión comercial, el historial y la autorización de datos.
import { useState } from 'preact/hooks';
import { ESTADOS as LISTA_ESTADOS, SERVICIOS as LISTA_SERVICIOS, type Estado } from '@api/dominio';
import { api, mensajeError, useDatos } from '../api';
import { navegar, ponerQuery, useUbicacion } from '../ruteo';
import { usePuede } from '../sesion';
import { ESTADOS, SERVICIOS, ESTADOS_CONTACTO } from '../textos';
import { fecha, hace, pesos, cuenta } from '../formato';
import type { DetalleLead, ListaLeads, MetricasLeads, Suscripcion, Evento } from '../tipos';
import { Boton, BotonEnlace, Buscador, Cabecera, Campo, Chips, Datos, FalloCarga, Insignia, Paginacion, PanelLateral, Seccion, Vacio, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';
import { Icono } from '../ui/iconos';

export const TONO_ESTADO: Record<Estado, string> = { nuevo: 'info', contactado: 'medio', cotizado: 'alerta', ganado: 'exito', perdido: 'apagado' };

export default function Solicitudes({ params }: { params: string[] }) {
  const { query } = useUbicacion();
  const puede = usePuede();
  const estado = query.get('estado') ?? '';
  const servicio = query.get('servicio') ?? '';
  const q = query.get('q') ?? '';
  const pagina = Number(query.get('pagina')) || 0;
  const abierto = params[0] ?? null;
  const filtros = new URLSearchParams(Object.entries({ estado, servicio, q, pagina: pagina ? String(pagina) : '' }).filter(([, v]) => v));
  const lista = useDatos<ListaLeads>(`/admin/api/leads?${filtros}`);
  const conteos = useDatos<MetricasLeads>('/admin/api/metricas?dias=730');
  const sufijo = location.search;

  const refrescar = () => {
    lista.recargar();
    conteos.recargar();
  };

  return (
    <>
      <Cabecera
        titulo="Solicitudes"
        descripcion="Lo que llega desde el cotizador del sitio. Mueve cada solicitud por el embudo y deja notas para el equipo."
        acciones={
          puede('leads.exportar') && (
            <BotonEnlace href="/admin/leads.csv" download>
              <Icono nombre="descargar" /> Exportar CSV
            </BotonEnlace>
          )
        }
      />
      <div class="barra-filtros">
        <Chips
          etiqueta="Estado"
          valor={estado}
          alCambiar={(v) => ponerQuery({ estado: v, pagina: null })}
          opciones={[{ valor: '', texto: 'Todas' }, ...LISTA_ESTADOS.map((e) => ({ valor: e, texto: ESTADOS[e], n: conteos.datos?.porEstado[e] }))]}
        />
        <div class="filtros-derecha">
          <label class="sr" for="f-servicio">
            Servicio
          </label>
          <select id="f-servicio" value={servicio} onChange={(e) => ponerQuery({ servicio: (e.target as HTMLSelectElement).value, pagina: null })}>
            <option value="">Todos los servicios</option>
            {LISTA_SERVICIOS.map((s) => (
              <option value={s}>{SERVICIOS[s]}</option>
            ))}
          </select>
          <Buscador etiqueta="Buscar solicitudes" placeholder="Nombre, empresa, correo o teléfono" valor={q} alCambiar={(v) => ponerQuery({ q: v, pagina: null })} />
        </div>
      </div>

      <div class={`dividido${abierto ? ' con-lateral' : ''}`}>
        <div class="tarjeta sin-relleno lista">
          {lista.error ? (
            <FalloCarga error={lista.error} reintentar={lista.recargar} />
          ) : !lista.datos ? (
            <Cargando />
          ) : !lista.datos.leads.length ? (
            <Vacio titulo={estado || servicio || q ? 'Nada con estos filtros' : 'Todavía no hay solicitudes'}>
              {estado || servicio || q ? 'Prueba con otros filtros o borra la búsqueda.' : 'Cuando alguien use el cotizador del sitio con la autorización marcada, aparece aquí.'}
            </Vacio>
          ) : (
            <div class={`tabla-envoltura${lista.cargando ? ' recargando' : ''}`}>
              <table class="tabla tabla-filas">
                <thead>
                  <tr>
                    <th scope="col">Quién</th>
                    <th scope="col" class="ocultar-movil">Servicio</th>
                    <th scope="col">Estado</th>
                    <th scope="col" class="num">
                      Llegó
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.datos.leads.map((l) => (
                    <tr class={l.id === abierto ? 'activa' : ''}>
                      <td>
                        <a class="fila-enlace" href={`/admin/solicitudes/${l.id}${sufijo}`}>
                          {l.anonimizado ? 'Datos suprimidos' : l.nombre}
                        </a>
                        {l.empresa && <span class="fila-sub">{l.empresa}</span>}
                      </td>
                      <td class="ocultar-movil">{SERVICIOS[l.servicio]}</td>
                      <td>
                        <Insignia tono={TONO_ESTADO[l.estado]}>{ESTADOS[l.estado]}</Insignia>
                      </td>
                      <td class="num suave" title={fecha(l.creado, true)}>
                        {hace(l.creado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lista.datos && <Paginacion total={lista.datos.total} pagina={lista.datos.pagina} porPagina={lista.datos.porPagina} alCambiar={(p) => ponerQuery({ pagina: p })} />}
        </div>
        {abierto && <DetalleSolicitud key={abierto} id={abierto} alCerrar={() => navegar(`/admin/solicitudes${sufijo}`)} alCambiar={refrescar} />}
      </div>
    </>
  );
}

function DetalleSolicitud({ id, alCerrar, alCambiar }: { id: string; alCerrar: () => void; alCambiar: () => void }) {
  const d = useDatos<DetalleLead>(`/admin/api/leads/${id}`);
  if (d.error) return <PanelLateral titulo="Solicitud" alCerrar={alCerrar}><FalloCarga error={d.error} /></PanelLateral>;
  if (!d.datos) return <PanelLateral titulo="Solicitud" alCerrar={alCerrar}><Cargando /></PanelLateral>;
  return <Ficha datos={d.datos} alCerrar={alCerrar} alGuardar={(n) => (d.poner(n), alCambiar())} />;
}

function Ficha({ datos, alCerrar, alGuardar }: { datos: DetalleLead; alCerrar: () => void; alGuardar: (d: DetalleLead) => void }) {
  const { lead: l, eventos, consentimientos, suscripcion } = datos;
  const puede = usePuede();
  const [estado, setEstado] = useState<Estado>(l.estado);
  const [guardando, setGuardando] = useState(false);
  const editable = puede('leads.editar') && !l.anonimizado;
  const tel = l.telefono?.replace(/\D/g, '') ?? '';
  const origen = [l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(' / ') || l.referente || 'Directo';

  const guardar = async (e: Event) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    setGuardando(true);
    try {
      alGuardar(
        await api<DetalleLead>(`/admin/api/leads/${l.id}`, {
          method: 'PATCH',
          body: {
            estado: f.get('estado'),
            notas: f.get('notas'),
            valorEstimado: String(f.get('valorEstimado') ?? '').replace(/\D/g, '') || null,
            motivoPerdida: f.get('motivoPerdida') || null,
          },
        }),
      );
      avisar('Cambios guardados', 'exito');
    } catch (err) {
      avisar(mensajeError(err, 'No se pudo guardar. Revisa los datos.'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const suprimir = async () => {
    const ok = await confirmar({
      titulo: 'Suprimir datos personales',
      texto: 'Se borran nombre, contacto, mensaje y notas de esta solicitud y se revoca su autorización. Si la misma persona está suscrita a novedades, también se suprime. No se puede deshacer.',
      confirmar: 'Suprimir datos',
      peligro: true,
    });
    if (!ok) return;
    try {
      alGuardar(await api<DetalleLead>(`/admin/api/leads/${l.id}/anonimizar`, { method: 'POST' }));
      avisar('Datos suprimidos', 'exito');
    } catch (err) {
      avisar(mensajeError(err), 'error');
    }
  };

  return (
    <PanelLateral etiqueta={SERVICIOS[l.servicio]} titulo={l.anonimizado ? 'Datos suprimidos' : l.nombre} alCerrar={alCerrar}>
      <div class="ficha-estado">
        <Insignia tono={TONO_ESTADO[l.estado]}>{ESTADOS[l.estado]}</Insignia>
        <span class="suave">Llegó el {fecha(l.creado, true)}</span>
      </div>
      {l.anonimizado ? (
        <p class="suave">Datos personales suprimidos el {fecha(l.anonimizado, true)}.</p>
      ) : (
        <div class="acciones">
          {l.telefono && (
            <BotonEnlace variante="primario" chico href={`https://wa.me/${tel}`} target="_blank" rel="noopener">
              WhatsApp
            </BotonEnlace>
          )}
          {l.email && (
            <BotonEnlace chico href={`mailto:${l.email}`}>
              Correo
            </BotonEnlace>
          )}
          {l.telefono && (
            <BotonEnlace chico href={`tel:${l.telefono}`}>
              Llamar
            </BotonEnlace>
          )}
        </div>
      )}

      <Datos
        filas={[
          ['Organización', l.empresa],
          ['Tipo', l.tipoOrganizacion],
          ['Correo', l.email],
          ['Teléfono', l.telefono],
          ['Fecha del evento', l.fecha],
          ['Personas', l.personas],
          ['Ciudad', l.ciudad],
          ['Origen', origen],
          ['Página', l.pagina],
          ['Idioma', l.locale === 'en' ? 'Inglés' : 'Español'],
        ]}
      />

      {l.mensaje && (
        <Seccion titulo="Mensaje">
          <p class="mensaje">{l.mensaje}</p>
        </Seccion>
      )}

      <Seccion titulo="Gestión">
        <form class="formulario" onSubmit={guardar}>
          <fieldset disabled={!editable}>
            <div class="fila-campos">
              <Campo etiqueta="Estado">
                <select name="estado" value={estado} onChange={(e) => setEstado((e.target as HTMLSelectElement).value as Estado)}>
                  {LISTA_ESTADOS.map((e) => (
                    <option value={e}>{ESTADOS[e]}</option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Valor estimado (COP)" ayuda={l.valorEstimado ? pesos(l.valorEstimado) : undefined}>
                <input name="valorEstimado" inputMode="numeric" pattern="[0-9.\s]*" defaultValue={l.valorEstimado?.toString() ?? ''} />
              </Campo>
            </div>
            {estado === 'perdido' && (
              <Campo etiqueta="Motivo de pérdida">
                <input name="motivoPerdida" maxLength={300} defaultValue={l.motivoPerdida ?? ''} />
              </Campo>
            )}
            <Campo etiqueta="Notas internas">
              <textarea name="notas" rows={4} maxLength={5000} defaultValue={l.notas ?? ''} />
            </Campo>
            {editable && (
              <div class="acciones">
                <Boton type="submit" variante="primario" disabled={guardando}>
                  {guardando ? 'Guardando' : 'Guardar cambios'}
                </Boton>
              </div>
            )}
          </fieldset>
        </form>
      </Seccion>

      {!l.anonimizado && <BloqueSuscripcion sx={suscripcion} />}

      <Seccion titulo="Historial">
        <ol class="linea-tiempo">
          {eventos.map((e) => (
            <li>
              <span class="lt-texto">{textoEvento(e)}</span>
              <span class="lt-meta">
                {fecha(e.creado, true)}
                {e.autor && ` · ${e.autor}`}
              </span>
            </li>
          ))}
        </ol>
      </Seccion>

      <Seccion titulo="Autorización de datos">
        {consentimientos.map((c) => (
          <p class="suave texto-chico">
            Versión {c.version}, aceptada el {fecha(c.aceptado, true)}
            {c.revocado ? `, revocada el ${fecha(c.revocado, true)}` : ''}. <q>{c.texto}</q>
          </p>
        ))}
        {puede('datos.suprimir') && !l.anonimizado && (
          <Boton variante="peligro" chico onClick={suprimir}>
            Suprimir datos personales
          </Boton>
        )}
      </Seccion>
    </PanelLateral>
  );
}

/** Lo que la persona hace con las novedades: dice cuándo vale la pena escribirle. */
function BloqueSuscripcion({ sx }: { sx: Suscripcion | null }) {
  if (!sx)
    return (
      <Seccion titulo="Novedades">
        <p class="suave">No está suscrita a las novedades.</p>
      </Seccion>
    );
  const partes = [ESTADOS_CONTACTO[sx.estado]];
  if (sx.pausaHasta && sx.pausaHasta > Date.now()) partes.push(`en pausa hasta el ${fecha(sx.pausaHasta)}`);
  if (sx.recibidas) partes.push(`abrió ${sx.abiertas} de ${sx.recibidas} campañas`, cuenta(sx.clics, 'clic', 'clics'));
  if (sx.ultimoClic) partes.push(`último clic el ${fecha(sx.ultimoClic, true)}`);
  else if (sx.ultimaApertura) partes.push(`última apertura el ${fecha(sx.ultimaApertura, true)}`);
  return (
    <Seccion titulo="Novedades" acciones={<a href={`/admin/contactos/${sx.id}`}>Ver contacto</a>}>
      <p class="suave">{partes.join(' · ')}</p>
      {sx.intereses.length > 0 && <p class="suave">Le interesa: {sx.intereses.map((i) => SERVICIOS[i as keyof typeof SERVICIOS] ?? i).join(', ')}</p>}
    </Seccion>
  );
}

function textoEvento(e: Evento): string {
  if (e.tipo === 'creado') return 'Llegó la solicitud';
  if (e.tipo === 'estado') {
    const [de, a] = (e.detalle ?? '').split(' → ');
    return `Estado: ${ESTADOS[de as Estado] ?? de} → ${ESTADOS[a as Estado] ?? a}`;
  }
  if (e.tipo === 'nota') return e.detalle === null ? 'Nota (suprimida)' : 'Actualizó las notas';
  if (e.tipo === 'anonimizado') return e.detalle ? `Suprimió los datos personales. ${e.detalle}` : 'Suprimió los datos personales';
  return e.detalle ?? 'Edición';
}
