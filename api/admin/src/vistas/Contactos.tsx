// Contactos de la lista de novedades: filtros, ficha, invitar e importar desde CSV.
import { useState } from 'preact/hooks';
import { ESTADOS_CONTACTO as LISTA_ESTADOS } from '@api/dominio';
import { api, mensajeError, useDatos, ErrorApi } from '../api';
import { navegar, ponerQuery, useUbicacion } from '../ruteo';
import { usePuede } from '../sesion';
import { ESTADOS_CONTACTO, IDIOMAS, MOTIVOS_BAJA, ORIGENES_CONTACTO, SERVICIOS } from '../textos';
import { cuenta, fecha, hace } from '../formato';
import { contactosDeCsv, type FilaImportar } from '../csv';
import type { DetalleContacto, ListaContactos } from '../tipos';
import { Aviso, Boton, Buscador, Cabecera, Campo, Chips, Datos, FalloCarga, Insignia, Paginacion, PanelLateral, Seccion, Tarjeta, Vacio, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';

export const TONO_CONTACTO: Record<string, string> = { activo: 'exito', pendiente: 'info', baja: 'apagado', rebotado: 'peligro' };

export default function Contactos({ params }: { params: string[] }) {
  const { query } = useUbicacion();
  const puede = usePuede();
  const estado = query.get('estado') ?? '';
  const q = query.get('q') ?? '';
  const pagina = Number(query.get('pagina')) || 0;
  const abierto = params[0] ?? null;
  const [panel, setPanel] = useState<'invitar' | 'importar' | null>(null);
  const filtros = new URLSearchParams(Object.entries({ estado, q, pagina: pagina ? String(pagina) : '' }).filter(([, v]) => v));
  const lista = useDatos<ListaContactos>(`/admin/api/contactos?${filtros}`);
  const sufijo = location.search;
  const total = lista.datos ? Object.values(lista.datos.conteos).reduce((a, b) => a + b, 0) : undefined;

  return (
    <>
      <Cabecera
        titulo="Contactos"
        descripcion="Personas suscritas a las novedades. Solo reciben campañas quienes confirmaron desde su correo."
        acciones={
          puede('marketing.editar') && (
            <>
              <Boton aria-expanded={panel === 'importar'} onClick={() => setPanel(panel === 'importar' ? null : 'importar')}>
                Importar CSV
              </Boton>
              <Boton variante="primario" aria-expanded={panel === 'invitar'} onClick={() => setPanel(panel === 'invitar' ? null : 'invitar')}>
                Invitar a alguien
              </Boton>
            </>
          )
        }
      />
      {panel === 'invitar' && <Invitar alListo={lista.recargar} />}
      {panel === 'importar' && <Importar alListo={lista.recargar} />}

      <div class="barra-filtros">
        <Chips
          etiqueta="Estado"
          valor={estado}
          alCambiar={(v) => ponerQuery({ estado: v, pagina: null })}
          opciones={[{ valor: '', texto: 'Todos', n: total }, ...LISTA_ESTADOS.map((e) => ({ valor: e, texto: ESTADOS_CONTACTO[e], n: lista.datos?.conteos[e] }))]}
        />
        <div class="filtros-derecha">
          <Buscador etiqueta="Buscar contactos" placeholder="Correo, nombre u organización" valor={q} alCambiar={(v) => ponerQuery({ q: v, pagina: null })} />
        </div>
      </div>

      <div class={`dividido${abierto ? ' con-lateral' : ''}`}>
        <div class="tarjeta sin-relleno lista">
          {lista.error ? (
            <FalloCarga error={lista.error} reintentar={lista.recargar} />
          ) : !lista.datos ? (
            <Cargando />
          ) : !lista.datos.contactos.length ? (
            <Vacio titulo={estado || q ? 'Nada con estos filtros' : 'Todavía no hay contactos'}>
              {estado || q ? 'Prueba con otros filtros.' : 'Se suman desde el pie del sitio, la sección de novedades, el cotizador o una invitación del equipo.'}
            </Vacio>
          ) : (
            <div class={`tabla-envoltura${lista.cargando ? ' recargando' : ''}`}>
              <table class="tabla tabla-filas">
                <thead>
                  <tr>
                    <th scope="col">Contacto</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Intereses</th>
                    <th scope="col" class="num">
                      Desde
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.datos.contactos.map((c) => (
                    <tr class={c.id === abierto ? 'activa' : ''}>
                      <td>
                        <a class="fila-enlace" href={`/admin/contactos/${c.id}${sufijo}`}>
                          {c.email}
                        </a>
                        {(c.nombre || c.empresa) && <span class="fila-sub">{[c.nombre, c.empresa].filter(Boolean).join(' · ')}</span>}
                      </td>
                      <td>
                        <Insignia tono={TONO_CONTACTO[c.estado]!}>{ESTADOS_CONTACTO[c.estado]}</Insignia>
                      </td>
                      <td class="suave texto-chico">{c.intereses.map((i) => SERVICIOS[i]).join(', ')}</td>
                      <td class="num suave" title={fecha(c.creado, true)}>
                        {hace(c.creado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lista.datos && <Paginacion total={lista.datos.total} pagina={lista.datos.pagina} porPagina={lista.datos.porPagina} alCambiar={(p) => ponerQuery({ pagina: p })} />}
        </div>
        {abierto && <Ficha key={abierto} id={abierto} alCerrar={() => navegar(`/admin/contactos${sufijo}`)} alCambiar={lista.recargar} />}
      </div>
    </>
  );
}

function Ficha({ id, alCerrar, alCambiar }: { id: string; alCerrar: () => void; alCambiar: () => void }) {
  const d = useDatos<DetalleContacto>(`/admin/api/contactos/${id}`);
  const puede = usePuede();
  if (d.error) return <PanelLateral titulo="Contacto" alCerrar={alCerrar}><FalloCarga error={d.error} /></PanelLateral>;
  if (!d.datos) return <PanelLateral titulo="Contacto" alCerrar={alCerrar}><Cargando /></PanelLateral>;
  const { contacto: c, consentimientos, envios } = d.datos;

  const accion = async (ruta: string, pregunta: { titulo: string; texto: string; confirmar: string; peligro?: boolean }) => {
    if (!(await confirmar(pregunta))) return;
    try {
      d.poner(await api<DetalleContacto>(ruta, { method: 'POST' }));
      avisar('Listo', 'exito');
      alCambiar();
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  };

  return (
    <PanelLateral etiqueta={ESTADOS_CONTACTO[c.estado]} titulo={c.nombre || c.email} alCerrar={alCerrar}>
      <Datos
        filas={[
          ['Correo', c.email],
          ['Organización', c.empresa],
          ['Idioma', IDIOMAS[c.locale]],
          ['Llegó por', ORIGENES_CONTACTO[c.origen]],
          ['Intereses', c.intereses.map((i) => SERVICIOS[i]).join(', ')],
          ['Desde', fecha(c.creado, true)],
          ['Confirmó', c.confirmado ? fecha(c.confirmado, true) : null],
          ['En pausa hasta', c.pausaHasta && c.pausaHasta > Date.now() ? fecha(c.pausaHasta) : null],
          ['Recordatorio', c.recordatorio ? fecha(c.recordatorio, true) : null],
          ['Bienvenida', c.bienvenida ? fecha(c.bienvenida, true) : null],
          ['Baja', c.baja ? `${fecha(c.baja, true)} (${MOTIVOS_BAJA[c.motivoBaja ?? ''] ?? c.motivoBaja})` : null],
          ['Solicitud', c.leadId ? <a href={`/admin/solicitudes/${c.leadId}`}>Ver solicitud</a> : null],
        ]}
      />
      <Seccion titulo="Últimas campañas">
        {envios.length ? (
          <ol class="linea-tiempo">
            {envios.map((e) => (
              <li>
                <span class="lt-texto">{e.campana}</span>
                <span class="lt-meta">
                  {e.enviado ? fecha(e.enviado) : e.estado}
                  {e.abierto ? ' · abrió' : ''}
                  {e.clic ? ' · hizo clic' : ''}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p class="suave">Todavía no ha recibido campañas.</p>
        )}
      </Seccion>
      <Seccion titulo="Autorización para novedades">
        {consentimientos.length ? (
          consentimientos.map((x) => (
            <p class="suave texto-chico">
              Versión {x.version}, aceptada el {fecha(x.aceptado, true)}
              {x.confirmado ? `, confirmada el ${fecha(x.confirmado, true)}` : ', sin confirmar'}
              {x.revocado ? `, revocada el ${fecha(x.revocado, true)}` : ''}. <q>{x.texto}</q>
            </p>
          ))
        ) : (
          <p class="suave">Sin autorización todavía: se registra cuando confirme desde su correo.</p>
        )}
        <div class="acciones">
          {puede('marketing.editar') && (c.estado === 'activo' || c.estado === 'pendiente') && (
            <Boton chico onClick={() => accion(`/admin/api/contactos/${c.id}/baja`, { titulo: 'Dar de baja', texto: 'Dejará de recibir campañas.', confirmar: 'Dar de baja' })}>
              Dar de baja
            </Boton>
          )}
          {puede('datos.suprimir') && c.motivoBaja !== 'supresion' && (
            <Boton
              variante="peligro"
              chico
              onClick={() =>
                accion(`/admin/api/contactos/${c.id}/suprimir`, {
                  titulo: 'Suprimir datos personales',
                  texto: 'Se borran el correo, el nombre y la organización, y se revoca la autorización. No se puede deshacer.',
                  confirmar: 'Suprimir datos',
                  peligro: true,
                })
              }
            >
              Suprimir datos personales
            </Boton>
          )}
        </div>
      </Seccion>
    </PanelLateral>
  );
}

function Invitar({ alListo }: { alListo: () => void }) {
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'error'; texto: string } | null>(null);
  const enviar = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    try {
      await api('/admin/api/contactos', { body: Object.fromEntries(new FormData(form)) });
      form.reset();
      setAviso({ tono: 'exito', texto: 'Invitación enviada. Aparecerá como activo cuando confirme.' });
      alListo();
    } catch (err) {
      const motivo = err instanceof ErrorApi ? err.datos.error : null;
      setAviso({
        tono: 'error',
        texto: motivo === 'baja' ? 'Esta persona se dio de baja. Solo puede volver a suscribirse por su cuenta desde el sitio.' : motivo === 'rebotado' ? 'Ese correo rebotó: la dirección no existe.' : mensajeError(err, 'Revisa el correo.'),
      });
    }
  };
  return (
    <Tarjeta titulo="Invitar a recibir novedades">
      <p class="suave texto-chico">Le llega un correo para confirmar. Solo queda suscrita si confirma.</p>
      <form class="formulario fila-formulario" onSubmit={enviar}>
        <Campo etiqueta="Correo">
          <input name="email" type="email" required />
        </Campo>
        <Campo etiqueta="Nombre">
          <input name="nombre" maxLength={120} />
        </Campo>
        <Campo etiqueta="Idioma">
          <select name="locale">
            <option value="es">Español</option>
            <option value="en">Inglés</option>
          </select>
        </Campo>
        <Boton type="submit" variante="primario">
          Enviar invitación
        </Boton>
      </form>
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
    </Tarjeta>
  );
}

function Importar({ alListo }: { alListo: () => void }) {
  const [filas, setFilas] = useState<FilaImportar[] | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const conCorreo = filas?.filter((c) => /@/.test(c.email)).length ?? 0;

  const importar = async (e: Event) => {
    e.preventDefault();
    if (!filas) return;
    if (!(await confirmar({ titulo: 'Importar contactos', texto: `Se invitará a las personas nuevas de ${filas.length} filas. Quien ya está en la lista no se toca.`, confirmar: 'Importar e invitar' }))) return;
    setOcupado(true);
    const total = { creados: 0, existentes: 0, invalidos: 0 };
    try {
      for (let i = 0; i < filas.length; i += 1000) {
        const r = await api<typeof total>('/admin/api/contactos/importar', { body: { filas: filas.slice(i, i + 1000) } });
        total.creados += r.creados;
        total.existentes += r.existentes;
        total.invalidos += r.invalidos;
      }
      setResumen(`Listo: ${cuenta(total.creados, 'invitación en cola', 'invitaciones en cola')} (salen por lotes en los próximos minutos), ${total.existentes} ya estaban y ${total.invalidos} sin correo válido.`);
      setFilas(null);
      (e.target as HTMLFormElement).reset();
      alListo();
    } catch (err) {
      setResumen(mensajeError(err, 'No se pudo importar. Revisa el archivo.'));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Tarjeta titulo="Importar contactos">
      <p class="suave texto-chico">
        Cada persona recibe una invitación para confirmar y solo queda suscrita si confirma. Importa solo a quienes ya tienen relación con Antídoto (clientes, asistentes, aliados). Quien ya
        está en la lista, incluido quien se dio de baja, no se toca.
      </p>
      <p class="suave texto-chico">
        Columnas reconocidas: <code>email</code> (o <code>correo</code>), <code>nombre</code>, <code>empresa</code>, <code>idioma</code> (es o en) e <code>intereses</code> (separados por{' '}
        <code>|</code>). Separador coma o punto y coma.
      </p>
      <form class="formulario fila-formulario" onSubmit={importar}>
        <Campo etiqueta="Archivo CSV">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const archivo = (e.target as HTMLInputElement).files?.[0];
              setResumen(null);
              setFilas(archivo ? contactosDeCsv(await archivo.text()) : null);
            }}
          />
        </Campo>
        <Boton type="submit" variante="primario" disabled={!conCorreo || ocupado}>
          {ocupado ? 'Importando' : 'Importar e invitar'}
        </Boton>
      </form>
      {filas && (
        <Aviso>
          {filas.length} filas, {conCorreo} con correo. Revisa antes de importar: a cada persona nueva le llega una invitación.
        </Aviso>
      )}
      {resumen && <Aviso tono="exito">{resumen}</Aviso>}
    </Tarjeta>
  );
}
