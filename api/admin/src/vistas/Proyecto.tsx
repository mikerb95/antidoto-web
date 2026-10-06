// Ficha de un proyecto: etapas, entregables con archivos, tareas y bitácora; a la derecha, los datos
// del proyecto y la organización con sus contactos.
import { useState } from 'preact/hooks';
import { SERVICIOS as LISTA_SERVICIOS, type ServicioId } from '@api/dominio';
import { api, subir, mensajeError, useDatos, ErrorApi } from '../api';
import { usePuede } from '../sesion';
import { SERVICIOS } from '../textos';
import { fechaLarga, hace, pesos } from '../formato';
import type { Usuario } from '../tipos';
import { Boton, Cabecera, Campo, Casilla, Datos, FalloCarga, Insignia, Tarjeta, Vacio, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';
import { ESTADOS_PROYECTO, dia, type EstadoProyecto } from './Proyectos';
import { AccesosPortal } from './AccesosPortal';

const ESTADOS_ETAPA = { pendiente: 'Pendiente', en_curso: 'En curso', hecha: 'Hecha' } as const;
export const ESTADOS_ENTREGABLE = {
  borrador: { texto: 'En preparación', tono: 'apagado' },
  en_revision: { texto: 'En revisión del cliente', tono: 'info' },
  cambios: { texto: 'Con cambios pedidos', tono: 'alerta' },
  aprobado: { texto: 'Aprobado', tono: 'exito' },
} as const;

interface Archivo {
  id: string;
  nombre: string;
  bytes: number;
  version: number;
  subido: number;
  autor: string;
}
interface Entregable {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: keyof typeof ESTADOS_ENTREGABLE;
  vence: string | null;
  visibleCliente: boolean;
  version: number;
  aprobadoPor: string | null;
  aprobadoEn: number | null;
  archivos: Archivo[];
}
interface Detalle {
  proyecto: {
    id: string;
    codigo: string;
    nombre: string;
    linea: ServicioId;
    estado: EstadoProyecto;
    organizacionId: string;
    leadId: string | null;
    responsableId: string | null;
    inicio: string | null;
    entrega: string | null;
    valor: number | null;
    notas: string | null;
    misionUrl: string | null;
    creado: number;
  };
  organizacion: { id: string; nombre: string; nit: string | null; sector: string | null } | null;
  contactos: { id: string; nombre: string | null; email: string | null; telefono: string | null; cargo: string | null; anonimizado: number | null }[];
  etapas: { id: string; nombre: string; estado: keyof typeof ESTADOS_ETAPA; fecha: string | null }[];
  tareas: { id: string; titulo: string; hecha: number | null; vence: string | null; responsableId: string | null; visibleCliente: boolean }[];
  entregables: Entregable[];
  bitacora: { id: string; creado: number; autorTipo: 'equipo' | 'cliente' | 'sistema'; autor: string | null; tipo: string; texto: string | null; visibleCliente: boolean }[];
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Proyecto({ params }: { params: string[] }) {
  const id = params[0]!;
  const d = useDatos<Detalle>(`/admin/api/proyectos/${id}`);
  const equipo = useDatos<{ usuarios: Usuario[] }>('/admin/api/usuarios');
  const puede = usePuede();
  const editable = puede('proyectos.editar');
  if (d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!d.datos) return <Cargando />;
  const { proyecto: p, organizacion, contactos, etapas, tareas, entregables, bitacora } = d.datos;
  const usuarios = equipo.datos?.usuarios ?? [];
  const nombreDe = (uid: string | null) => usuarios.find((u) => u.id === uid)?.nombre;

  /** Llama a la API y repinta con la ficha que devuelve. */
  const hacer = async (ruta: string, metodo: string, cuerpo?: unknown, exito?: string) => {
    try {
      d.poner(await api<Detalle>(ruta, { method: metodo, body: cuerpo }));
      if (exito) avisar(exito, 'exito');
      return true;
    } catch (e) {
      avisar(mensajeError(e, 'Revisa los datos.'), 'error');
      return false;
    }
  };

  const hechas = etapas.filter((e) => e.estado === 'hecha').length;
  return (
    <>
      <Cabecera
        titulo={p.nombre}
        volver={{ href: '/admin/proyectos', texto: 'Proyectos' }}
        descripcion={
          <>
            <Insignia tono={ESTADOS_PROYECTO[p.estado].tono}>{ESTADOS_PROYECTO[p.estado].texto}</Insignia>
            {p.codigo} · {organizacion && <a href={`/admin/organizaciones/${organizacion.id}`}>{organizacion.nombre}</a>} · {SERVICIOS[p.linea]}
            {p.leadId && (
              <>
                {' '}
                · <a href={`/admin/solicitudes/${p.leadId}`}>Ver la solicitud</a>
              </>
            )}
          </>
        }
      />
      <div class="editor-campana">
        <div class="columna-principal">
          <Tarjeta titulo={`Etapas · ${hechas} de ${etapas.length}`}>
            <ol class="etapas">
              {etapas.map((e) => (
                <li class={`etapa e-${e.estado}`}>
                  <span class="etapa-marca" aria-hidden="true" />
                  <span class="etapa-nombre">{e.nombre}</span>
                  {editable ? (
                    <>
                      <label class="sr" for={`et-${e.id}`}>
                        Estado de {e.nombre}
                      </label>
                      <select id={`et-${e.id}`} class="select-chico" value={e.estado} onChange={(ev) => hacer(`/admin/api/etapas/${e.id}`, 'PATCH', { estado: (ev.target as HTMLSelectElement).value })}>
                        {Object.entries(ESTADOS_ETAPA).map(([k, t]) => (
                          <option value={k}>{t}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span class="suave texto-chico">{ESTADOS_ETAPA[e.estado]}</span>
                  )}
                </li>
              ))}
            </ol>
            {editable && (
              <FormLinea
                etiqueta="Nueva etapa"
                placeholder="Nombre de la etapa"
                boton="Agregar etapa"
                alEnviar={(nombre) => hacer(`/admin/api/proyectos/${p.id}/etapas`, 'POST', { nombre })}
              />
            )}
          </Tarjeta>

          <Tarjeta titulo="Entregables">
            {entregables.length ? (
              <ul class="entregables">
                {entregables.map((e) => (
                  <ItemEntregable e={e} editable={editable} hacer={hacer} recargar={d.recargar} />
                ))}
              </ul>
            ) : (
              <p class="suave texto-chico">Todavía no hay entregables. Un entregable visible para el cliente aparece en su portal para revisarlo y aprobarlo.</p>
            )}
            {editable && <FormLinea etiqueta="Nuevo entregable" placeholder="Por ejemplo: Corte 1 del video" boton="Agregar entregable" alEnviar={(titulo) => hacer(`/admin/api/proyectos/${p.id}/entregables`, 'POST', { titulo })} />}
          </Tarjeta>

          <Tarjeta titulo={`Tareas · ${tareas.filter((t) => !t.hecha).length} abiertas`}>
            {tareas.length ? (
              <ul class="tareas">
                {tareas.map((t) => (
                  <li class={t.hecha ? 'hecha' : ''}>
                    <Casilla checked={!!t.hecha} disabled={!editable} onChange={(ev) => hacer(`/admin/api/tareas/${t.id}`, 'PATCH', { hecha: (ev.target as HTMLInputElement).checked })}>
                      {t.titulo}
                    </Casilla>
                    <span class="suave texto-chico">{[nombreDe(t.responsableId), t.vence ? `vence ${dia(t.vence)}` : null].filter(Boolean).join(' · ')}</span>
                    {editable && (
                      <Boton chico variante="fantasma" aria-label={`Borrar la tarea ${t.titulo}`} onClick={() => hacer(`/admin/api/tareas/${t.id}`, 'DELETE')}>
                        Borrar
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p class="suave texto-chico">Sin tareas todavía.</p>
            )}
            {editable && <FormTarea usuarios={usuarios} alEnviar={(t) => hacer(`/admin/api/proyectos/${p.id}/tareas`, 'POST', t)} />}
          </Tarjeta>

          <Tarjeta titulo="Bitácora">
            {editable && <FormNota alEnviar={(texto, visibleCliente) => hacer(`/admin/api/proyectos/${p.id}/bitacora`, 'POST', { texto, visibleCliente }, 'Nota agregada')} />}
            {bitacora.length ? (
              <ol class="linea-tiempo">
                {bitacora.map((b) => (
                  <li>
                    <span class="lt-texto">{b.texto}</span>
                    <span class="lt-meta">
                      {fechaLarga(b.creado)} · {b.autorTipo === 'cliente' ? `Cliente (${b.autor})` : (b.autor ?? 'Sistema')}
                      {b.visibleCliente ? ' · visible para el cliente' : ''}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <Vacio titulo="Sin movimientos" />
            )}
          </Tarjeta>
        </div>

        <div class="editor-lateral">
          <DatosProyecto p={p} usuarios={usuarios} editable={editable} verValor={puede('proyectos.valor')} hacer={hacer} />
          {organizacion && (
            <Tarjeta titulo="Organización" acciones={<a href={`/admin/organizaciones/${organizacion.id}`}>Abrir ficha</a>}>
              <Datos filas={[['Nombre', organizacion.nombre], ['NIT', organizacion.nit], ['Sector', organizacion.sector]]} />
              <ul class="lista-simple">
                {contactos
                  .filter((c) => !c.anonimizado)
                  .map((c) => (
                    <li>
                      <span>
                        <strong>{c.nombre ?? c.email}</strong>
                        <span class="fila-sub">{[c.cargo, c.email, c.telefono].filter(Boolean).join(' · ')}</span>
                      </span>
                    </li>
                  ))}
              </ul>
            </Tarjeta>
          )}
          {organizacion && puede('portal.gestionar') && <AccesosPortal organizacionId={organizacion.id} contactos={contactos} />}
        </div>
      </div>
    </>
  );
}

function ItemEntregable({ e, editable, hacer, recargar }: { e: Entregable; editable: boolean; hacer: (r: string, m: string, c?: unknown, x?: string) => Promise<boolean>; recargar: () => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const subirArchivo = async (archivo: File) => {
    setSubiendo(true);
    const form = new FormData();
    form.append('archivo', archivo);
    try {
      await subir(`/admin/api/entregables/${e.id}/archivos`, form);
      avisar('Archivo subido', 'exito');
      recargar();
    } catch (err) {
      const motivo = err instanceof ErrorApi ? err.datos.error : null;
      avisar(motivo === 'grande' ? 'El archivo pasa de 50 MB. Para videos grandes, comparte un enlace en la bitácora.' : motivo === 'sin_bucket' ? 'Falta configurar el almacenamiento de archivos (R2).' : mensajeError(err), 'error');
    } finally {
      setSubiendo(false);
    }
  };
  return (
    <li class="entregable">
      <div class="entregable-cabeza">
        <div>
          <p class="entregable-titulo">{e.titulo}</p>
          <p class="suave texto-chico">
            Versión {e.version}
            {e.vence ? ` · para el ${dia(e.vence)}` : ''}
            {e.aprobadoEn ? ` · aprobado ${hace(e.aprobadoEn)} por ${e.aprobadoPor}` : ''}
          </p>
        </div>
        <Insignia tono={ESTADOS_ENTREGABLE[e.estado].tono}>{ESTADOS_ENTREGABLE[e.estado].texto}</Insignia>
      </div>
      {e.archivos.length > 0 && (
        <ul class="archivos">
          {e.archivos.map((a) => (
            <li>
              <a href={`/admin/api/archivos/${a.id}`} download>
                {a.nombre}
              </a>
              <span class="suave texto-chico">
                v{a.version} · {kb(a.bytes)} · {hace(a.subido)}
              </span>
              {editable && (
                <Boton
                  chico
                  variante="fantasma"
                  onClick={async () => (await confirmar({ titulo: 'Borrar archivo', texto: `Se borra ${a.nombre}.`, confirmar: 'Borrar', peligro: true })) && hacer(`/admin/api/archivos/${a.id}`, 'DELETE')}
                >
                  Borrar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div class="entregable-acciones">
          <label class="sr" for={`en-${e.id}`}>
            Estado de {e.titulo}
          </label>
          <select id={`en-${e.id}`} class="select-chico" value={e.estado} onChange={(ev) => hacer(`/admin/api/entregables/${e.id}`, 'PATCH', { estado: (ev.target as HTMLSelectElement).value })}>
            {Object.entries(ESTADOS_ENTREGABLE).map(([k, v]) => (
              <option value={k}>{v.texto}</option>
            ))}
          </select>
          <Casilla checked={e.visibleCliente} onChange={(ev) => hacer(`/admin/api/entregables/${e.id}`, 'PATCH', { visibleCliente: (ev.target as HTMLInputElement).checked })}>
            Visible en el portal
          </Casilla>
          <label class="btn btn-secundario btn-chico subir-archivo">
            <input type="file" class="sr" disabled={subiendo} onChange={(ev) => (ev.target as HTMLInputElement).files?.[0] && subirArchivo((ev.target as HTMLInputElement).files![0]!)} />
            {subiendo ? 'Subiendo' : 'Subir archivo'}
          </label>
          <Boton
            chico
            variante="fantasma"
            onClick={async () => (await confirmar({ titulo: 'Borrar entregable', texto: 'Se borran el entregable y sus archivos.', confirmar: 'Borrar', peligro: true })) && hacer(`/admin/api/entregables/${e.id}`, 'DELETE')}
          >
            Borrar
          </Boton>
        </div>
      )}
    </li>
  );
}

function DatosProyecto({ p, usuarios, editable, verValor, hacer }: { p: Detalle['proyecto']; usuarios: Usuario[]; editable: boolean; verValor: boolean; hacer: (r: string, m: string, c?: unknown, x?: string) => Promise<boolean> }) {
  const guardar = (e: Event) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target as HTMLFormElement));
    void hacer(`/admin/api/proyectos/${p.id}`, 'PATCH', { ...f, ...(verValor ? {} : { valor: undefined }) }, 'Proyecto guardado');
  };
  return (
    <Tarjeta titulo="Datos del proyecto">
      <form class="formulario" onSubmit={guardar}>
        <fieldset disabled={!editable}>
          <Campo etiqueta="Nombre">
            <input name="nombre" defaultValue={p.nombre} required maxLength={160} />
          </Campo>
          <div class="fila-campos">
            <Campo etiqueta="Estado">
              <select name="estado">
                {Object.entries(ESTADOS_PROYECTO).map(([k, v]) => (
                  <option value={k} selected={k === p.estado}>
                    {v.texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Línea">
              <select name="linea">
                {LISTA_SERVICIOS.map((s) => (
                  <option value={s} selected={s === p.linea}>
                    {SERVICIOS[s]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Responsable">
            <select name="responsableId">
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option value={u.id} selected={u.id === p.responsableId}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <div class="fila-campos">
            <Campo etiqueta="Inicio">
              <input type="date" name="inicio" defaultValue={p.inicio ?? ''} />
            </Campo>
            <Campo etiqueta="Entrega">
              <input type="date" name="entrega" defaultValue={p.entrega ?? ''} />
            </Campo>
          </div>
          {verValor && (
            <Campo etiqueta="Valor (COP)" ayuda={p.valor ? pesos(p.valor) : undefined}>
              <input name="valor" inputMode="numeric" defaultValue={p.valor?.toString() ?? ''} />
            </Campo>
          )}
          <Campo etiqueta="Enlace a la plataforma de misiones" ayuda="Si el proyecto usa una actividad de la plataforma, pega aquí su enlace.">
            <input name="misionUrl" type="url" defaultValue={p.misionUrl ?? ''} placeholder="https://" />
          </Campo>
          <Campo etiqueta="Notas internas">
            <textarea name="notas" rows={4} defaultValue={p.notas ?? ''} maxLength={5000} />
          </Campo>
          {editable && (
            <Boton type="submit" variante="primario">
              Guardar
            </Boton>
          )}
        </fieldset>
      </form>
    </Tarjeta>
  );
}

function FormLinea({ etiqueta, placeholder, boton, alEnviar }: { etiqueta: string; placeholder: string; boton: string; alEnviar: (v: string) => Promise<boolean> }) {
  const [v, setV] = useState('');
  return (
    <form
      class="form-linea"
      onSubmit={async (e) => {
        e.preventDefault();
        if (v.trim() && (await alEnviar(v.trim()))) setV('');
      }}
    >
      <label class="sr" htmlFor={`fl-${boton}`}>
        {etiqueta}
      </label>
      <input id={`fl-${boton}`} value={v} placeholder={placeholder} maxLength={200} onInput={(e) => setV((e.target as HTMLInputElement).value)} />
      <Boton type="submit" disabled={!v.trim()}>
        {boton}
      </Boton>
    </form>
  );
}

function FormTarea({ usuarios, alEnviar }: { usuarios: Usuario[]; alEnviar: (t: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <form
      class="form-linea"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const f = Object.fromEntries(new FormData(form));
        if (String(f.titulo).trim() && (await alEnviar(f))) form.reset();
      }}
    >
      <label class="sr" htmlFor="nueva-tarea">
        Nueva tarea
      </label>
      <input id="nueva-tarea" name="titulo" placeholder="Nueva tarea" maxLength={200} required />
      <label class="sr" htmlFor="tarea-resp">
        Responsable
      </label>
      <select id="tarea-resp" name="responsableId" class="select-chico">
        <option value="">Sin asignar</option>
        {usuarios.filter((u) => u.activo).map((u) => <option value={u.id}>{u.nombre}</option>)}
      </select>
      <label class="sr" htmlFor="tarea-vence">
        Vence
      </label>
      <input id="tarea-vence" name="vence" type="date" class="select-chico" />
      <Boton type="submit">Agregar</Boton>
    </form>
  );
}

function FormNota({ alEnviar }: { alEnviar: (t: string, visible: boolean) => Promise<boolean> }) {
  const [t, setT] = useState('');
  const [visible, setVisible] = useState(false);
  return (
    <form
      class="formulario nota-nueva"
      onSubmit={async (e) => {
        e.preventDefault();
        if (t.trim() && (await alEnviar(t.trim(), visible))) {
          setT('');
          setVisible(false);
        }
      }}
    >
      <label class="sr" htmlFor="nota-texto">
        Nota
      </label>
      <textarea id="nota-texto" rows={2} placeholder="Escribe una nota, un acuerdo o un enlace" value={t} maxLength={4000} onInput={(e) => setT((e.target as HTMLTextAreaElement).value)} />
      <div class="acciones">
        <Casilla checked={visible} onChange={(e) => setVisible((e.target as HTMLInputElement).checked)}>
          Visible para el cliente
        </Casilla>
        <Boton type="submit" disabled={!t.trim()}>
          Agregar nota
        </Boton>
      </div>
    </form>
  );
}
