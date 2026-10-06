// Editor de una entrada de contenido. El formulario sale del esquema del tipo
// (src/contenido/esquemas.ts de la API): campos comunes y, si el tipo se traduce, pestañas por
// idioma. Guardar deja un borrador; publicar pide todo en los dos idiomas.
import { useEffect, useState } from 'preact/hooks';
import { ESQUEMAS, IDIOMAS, TIPOS_CONTENIDO, type Campo as TCampo, type Idioma, type TipoContenido } from '@api/contenido/esquemas';
import { api, mensajeError, useDatos, ErrorApi } from '../api';
import { navegar, useUbicacion } from '../ruteo';
import { usePuede } from '../sesion';
import { fechaLarga, hace } from '../formato';
import { markdownAHtml } from '../markdown';
import { Aviso, Boton, Cabecera, Campo, Casilla, FalloCarga, Insignia, Pestanas, Tarjeta, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';
import { SelectorImagen, type Medio } from '../ui/Medios';
import { ESTADO, type EstadoContenido } from './Contenido';

interface Entrada {
  id: string;
  tipo: TipoContenido;
  clave: string;
  datos: Record<string, unknown>;
  textos: Partial<Record<Idioma, Record<string, unknown>>>;
  version: number;
  estado: EstadoContenido;
  titulo: string;
  publicadaEn: number | null;
  actualizado: number;
  autor: string;
}
interface Detalle {
  entrada: Entrada;
  versiones: { version: number; creado: number; autor: string }[];
  medios: Record<string, Medio>;
}

const IDIOMA = { es: 'Español', en: 'Inglés' } as const;

export default function EditorContenido({ params }: { params: string[] }) {
  const id = params[0]!;
  const { query } = useUbicacion();
  const nueva = id === 'nuevo';
  const tipoNuevo = (TIPOS_CONTENIDO.includes(query.get('tipo') as TipoContenido) ? query.get('tipo') : 'blog') as TipoContenido;
  const d = useDatos<Detalle>(nueva ? null : `/admin/api/contenido/${id}`);
  if (!nueva && d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!nueva && !d.datos) return <Cargando />;
  return <Formulario key={d.datos?.entrada.version ?? 'nueva'} tipo={nueva ? tipoNuevo : d.datos!.entrada.tipo} detalle={nueva ? null : d.datos!} alCambiar={(x) => d.poner(x)} />;
}

function Formulario({ tipo, detalle, alCambiar }: { tipo: TipoContenido; detalle: Detalle | null; alCambiar: (d: Detalle) => void }) {
  const esquema = ESQUEMAS[tipo];
  const puede = usePuede();
  const editable = puede('contenido.editar') && detalle?.entrada.estado !== 'archivado';
  const e = detalle?.entrada;
  const [clave, setClave] = useState(e?.clave ?? '');
  const [datos, setDatos] = useState<Record<string, unknown>>(e?.datos ?? {});
  const [textos, setTextos] = useState<Partial<Record<Idioma, Record<string, unknown>>>>(e?.textos ?? { es: {}, en: {} });
  const [idioma, setIdioma] = useState<Idioma>('es');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!sucio) return;
    const aviso = (ev: BeforeUnloadEvent) => ev.preventDefault();
    addEventListener('beforeunload', aviso);
    return () => removeEventListener('beforeunload', aviso);
  }, [sucio]);

  const ponerDato = (k: string, v: unknown) => {
    setDatos((x) => ({ ...x, [k]: v }));
    setSucio(true);
  };
  const ponerTexto = (i: Idioma, k: string, v: unknown) => {
    setTextos((x) => ({ ...x, [i]: { ...(x[i] ?? {}), [k]: v } }));
    setSucio(true);
  };

  /** Sugiere la clave y los slugs desde el título mientras estén vacíos. */
  const sugerir = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

  const mostrarErrores = (err: unknown, porDefecto: string) => {
    if (err instanceof ErrorApi && err.datos.errores && typeof err.datos.errores === 'object') {
      const lista = err.datos.errores as Record<string, string>;
      setErrores(lista);
      const enOtro = IDIOMAS.find((i) => i !== idioma && Object.keys(lista).some((k) => k.startsWith(`${i}.`)));
      if (enOtro && !Object.keys(lista).some((k) => k.startsWith(`${idioma}.`))) setIdioma(enOtro);
      avisar(`Revisa ${Object.keys(lista).length === 1 ? 'el campo marcado' : `los ${Object.keys(lista).length} campos marcados`}.`, 'error');
    } else if (err instanceof ErrorApi && err.datos.error === 'version') {
      avisar('Alguien guardó cambios mientras editabas. Recarga para ver la última versión.', 'error');
    } else avisar(mensajeError(err, porDefecto), 'error');
  };

  const guardar = async (): Promise<Detalle | null> => {
    setOcupado(true);
    setErrores({});
    try {
      const cuerpo = { tipo, clave, datos, textos, ...(e ? { version: e.version } : {}) };
      const r = e ? await api<Detalle>(`/admin/api/contenido/${e.id}`, { method: 'PUT', body: cuerpo }) : await api<Detalle>('/admin/api/contenido', { body: cuerpo });
      setSucio(false);
      if (!e) {
        avisar('Borrador creado', 'exito');
        navegar(`/admin/contenido/${r.entrada.id}`, { reemplazar: true });
      } else {
        avisar('Cambios guardados', 'exito');
        alCambiar(r);
      }
      return r;
    } catch (err) {
      mostrarErrores(err, 'No se pudo guardar.');
      return null;
    } finally {
      setOcupado(false);
    }
  };

  const accion = async (ruta: string, exito: string, pregunta?: Parameters<typeof confirmar>[0]) => {
    if (!e) return;
    if (pregunta && !(await confirmar(pregunta))) return;
    if (sucio && !(await guardar())) return;
    setOcupado(true);
    setErrores({});
    try {
      alCambiar(await api<Detalle>(`/admin/api/contenido/${e.id}${ruta}`, { method: 'POST' }));
      avisar(exito, 'exito');
    } catch (err) {
      mostrarErrores(err, 'No se pudo completar.');
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async () => {
    if (!e || !(await confirmar({ titulo: 'Borrar borrador', texto: 'Se borra esta entrada y su historial. No se puede deshacer.', confirmar: 'Borrar', peligro: true }))) return;
    try {
      await api(`/admin/api/contenido/${e.id}`, { method: 'DELETE' });
      navegar(`/admin/contenido?tipo=${tipo}`);
    } catch (err) {
      avisar(mensajeError(err), 'error');
    }
  };

  const erroresIdioma = (i: Idioma) => Object.keys(errores).filter((k) => k.startsWith(`${i}.`)).length;
  const titulo = e?.titulo && e.titulo !== 'Sin título' ? e.titulo : `${e ? '' : 'Nuevo: '}${esquema.nombre.toLowerCase()}`;

  return (
    <>
      <Cabecera
        titulo={titulo}
        volver={{ href: `/admin/contenido?tipo=${tipo}`, texto: esquema.plural }}
        descripcion={
          e ? (
            <>
              <Insignia tono={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Insignia> Editado {hace(e.actualizado)} por {e.autor}
              {sucio && <Insignia tono="info">Sin guardar</Insignia>}
            </>
          ) : (
            esquema.descripcion
          )
        }
      />
      <div class="editor-campana">
        <form
          class="tarjeta formulario"
          onSubmit={(ev) => {
            ev.preventDefault();
            void guardar();
          }}
        >
          <fieldset disabled={!editable}>
            <div class="fila-campos">
              <Campo
                etiqueta="Clave"
                error={errores.clave}
                ayuda={e?.publicadaEn ? 'No cambia después de publicar: une los dos idiomas.' : 'Identifica la entrada. Si es igual a la de una pregunta o cliente del código, lo reemplaza.'}
              >
                <input value={clave} maxLength={60} required onInput={(ev) => (setClave((ev.target as HTMLInputElement).value), setSucio(true))} readOnly={!!e?.publicadaEn} />
              </Campo>
            </div>
            {esquema.comunes.map((c) => (
              <CampoEsquema c={c} valor={datos[c.nombre]} error={errores[`datos.${c.nombre}`]} alCambiar={(v) => ponerDato(c.nombre, v)} medios={detalle?.medios} deshabilitado={!editable} />
            ))}
            {esquema.porIdioma.length > 0 && (
              <div class="idiomas">
                <Pestanas
                  etiqueta="Idioma"
                  valor={idioma}
                  alCambiar={setIdioma}
                  opciones={IDIOMAS.map((i) => ({ valor: i, texto: erroresIdioma(i) ? `${IDIOMA[i]} (${erroresIdioma(i)})` : IDIOMA[i] }))}
                />
                {IDIOMAS.map((i) => (
                  <div class="formulario" hidden={i !== idioma} role="tabpanel" aria-label={IDIOMA[i]} lang={i}>
                    {esquema.porIdioma.map((c) => (
                      <CampoEsquema
                        c={c}
                        valor={textos[i]?.[c.nombre]}
                        error={errores[`${i}.${c.nombre}`]}
                        alCambiar={(v) => {
                          ponerTexto(i, c.nombre, v);
                          // El título sugiere la dirección y la clave mientras estén vacías.
                          if (c.nombre === 'title' && typeof v === 'string') {
                            if (!textos[i]?.slug) ponerTexto(i, 'slug', sugerir(v));
                            if (i === 'es' && !clave && !e) setClave(sugerir(v));
                          }
                        }}
                        deshabilitado={!editable}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {editable && (
              <div class="acciones">
                <Boton type="submit" variante="primario" disabled={ocupado}>
                  {e ? 'Guardar cambios' : 'Crear borrador'}
                </Boton>
              </div>
            )}
          </fieldset>
        </form>

        <div class="editor-lateral">
          {e ? (
            <>
              <Tarjeta titulo="Publicación">
                <p class="suave texto-chico">
                  {e.estado === 'publicado'
                    ? 'Está publicada. Si la editas, el sitio sigue mostrando esta versión hasta que publiques los cambios.'
                    : e.estado === 'cambios'
                      ? 'Hay cambios guardados que todavía no están publicados.'
                      : e.estado === 'archivado'
                        ? 'Archivada: no sale en el sitio.'
                        : 'Es un borrador: no sale en el sitio.'}
                  {e.publicadaEn ? ` Último cambio en el sitio: ${fechaLarga(e.publicadaEn)}.` : ''}
                </p>
                {puede('contenido.publicar') && (
                  <div class="acciones">
                    {(e.estado === 'borrador' || e.estado === 'cambios') && (
                      <Boton variante="primario" disabled={ocupado} onClick={() => accion('/publicar', 'Publicada. Publica el sitio para que salga.')}>
                        {e.estado === 'cambios' ? 'Publicar cambios' : 'Publicar'}
                      </Boton>
                    )}
                    {(e.estado === 'publicado' || e.estado === 'cambios') && (
                      <Boton disabled={ocupado} onClick={() => accion('/despublicar', 'Despublicada', { titulo: 'Despublicar', texto: 'Deja de salir en el sitio con la próxima publicación. La entrada queda como borrador.', confirmar: 'Despublicar' })}>
                        Despublicar
                      </Boton>
                    )}
                    {e.estado === 'archivado' ? (
                      <Boton disabled={ocupado} onClick={() => accion('/desarchivar', 'Volvió a borradores')}>
                        Sacar del archivo
                      </Boton>
                    ) : (
                      <Boton variante="fantasma" disabled={ocupado} onClick={() => accion('/archivar', 'Archivada', { titulo: 'Archivar', texto: 'Sale del sitio con la próxima publicación y queda en el archivo con su historial.', confirmar: 'Archivar' })}>
                        Archivar
                      </Boton>
                    )}
                  </div>
                )}
                {!e.publicadaEn && puede('contenido.editar') && (
                  <Boton variante="peligro" chico onClick={borrar}>
                    Borrar borrador
                  </Boton>
                )}
                {(e.estado === 'publicado' || e.estado === 'cambios') && <Aviso>Después de publicar, usa "Publicar el sitio" en la lista de contenido para que el cambio salga.</Aviso>}
              </Tarjeta>
              <Tarjeta titulo="Historial">
                {detalle!.versiones.length ? (
                  <ul class="lista-simple">
                    {detalle!.versiones.map((v) => (
                      <li>
                        <span>
                          Versión {v.version}
                          <span class="fila-sub">
                            {fechaLarga(v.creado)} · {v.autor}
                          </span>
                        </span>
                        {editable && (
                          <Boton
                            chico
                            variante="fantasma"
                            onClick={() => accion(`/restaurar/${v.version}`, `Se restauró la versión ${v.version}`, { titulo: `Restaurar la versión ${v.version}`, texto: 'La copia actual queda en el historial. Lo publicado no cambia hasta que publiques.', confirmar: 'Restaurar' })}
                          >
                            Restaurar
                          </Boton>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p class="suave texto-chico">Cada vez que guardes, la versión anterior queda aquí (las últimas 20).</p>
                )}
              </Tarjeta>
            </>
          ) : (
            <Aviso>Crea el borrador para publicarlo, ver su historial y restaurar versiones. Puedes guardarlo incompleto.</Aviso>
          )}
        </div>
      </div>
    </>
  );
}

function CampoEsquema({ c, valor, error, alCambiar, medios, deshabilitado }: { c: TCampo; valor: unknown; error?: string; alCambiar: (v: unknown) => void; medios?: Record<string, Medio>; deshabilitado: boolean }) {
  const requerido = 'requerido' in c && c.requerido;
  const etiqueta = (
    <>
      {c.etiqueta}
      {requerido ? '' : <span class="opcional"> (opcional)</span>}
    </>
  );
  const texto = typeof valor === 'string' ? valor : '';
  const alEscribir = (ev: Event) => alCambiar((ev.target as HTMLInputElement).value);
  switch (c.tipo) {
    case 'texto':
    case 'slug':
      return (
        <Campo etiqueta={etiqueta} ayuda={c.ayuda} error={error}>
          <input value={texto} onInput={alEscribir} maxLength={c.tipo === 'texto' ? c.max : 80} />
        </Campo>
      );
    case 'parrafo':
      return (
        <Campo etiqueta={etiqueta} ayuda={c.ayuda ?? (c.max ? `Hasta ${c.max} caracteres (${texto.length}).` : undefined)} error={error}>
          <textarea value={texto} onInput={alEscribir} rows={c.max && c.max > 400 ? 5 : 3} maxLength={c.max} />
        </Campo>
      );
    case 'markdown':
      return <CampoMarkdown etiqueta={etiqueta} ayuda={c.ayuda} error={error} valor={texto} alCambiar={alCambiar} />;
    case 'fecha':
      return (
        <Campo etiqueta={etiqueta} ayuda={c.ayuda} error={error}>
          <input type="date" value={texto} onInput={alEscribir} />
        </Campo>
      );
    case 'numero':
      return (
        <Campo etiqueta={etiqueta} ayuda={c.ayuda} error={error}>
          <input type="number" inputMode="numeric" min={c.min} max={c.max} value={typeof valor === 'number' ? String(valor) : ''} onInput={(ev) => alCambiar((ev.target as HTMLInputElement).value === '' ? null : Number((ev.target as HTMLInputElement).value))} />
        </Campo>
      );
    case 'opcion':
      return (
        <Campo etiqueta={etiqueta} ayuda={c.ayuda} error={error}>
          <select onChange={(ev) => alCambiar((ev.target as HTMLSelectElement).value || null)}>
            <option value="" selected={!texto}>
              {requerido ? 'Elige una opción' : 'Ninguna'}
            </option>
            {c.opciones.map(([k, t]) => (
              <option value={k} selected={texto === k}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
      );
    case 'varias': {
      const lista = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <fieldset class="grupo-casillas">
          <legend>{etiqueta}</legend>
          {c.opciones.map(([k, t]) => (
            <Casilla checked={lista.includes(k)} onChange={(ev) => alCambiar((ev.target as HTMLInputElement).checked ? [...lista, k] : lista.filter((x) => x !== k))}>
              {t}
            </Casilla>
          ))}
          {error && <span class="campo-msj">{error}</span>}
        </fieldset>
      );
    }
    case 'si-no':
      return (
        <Casilla checked={valor === true} onChange={(ev) => alCambiar((ev.target as HTMLInputElement).checked)}>
          {c.etiqueta}
        </Casilla>
      );
    case 'imagen':
      return (
        <div class={`campo${error ? ' campo-error' : ''}`}>
          <span class="campo-etq">{etiqueta}</span>
          <SelectorImagen valor={texto || null} alCambiar={alCambiar} etiqueta={c.etiqueta} info={texto ? medios?.[texto] : undefined} deshabilitado={deshabilitado} />
          {c.ayuda && <span class="campo-ayuda">{c.ayuda}</span>}
          {error && <span class="campo-msj">{error}</span>}
        </div>
      );
  }
}

function CampoMarkdown({ etiqueta, ayuda, error, valor, alCambiar }: { etiqueta: preact.ComponentChildren; ayuda?: string; error?: string; valor: string; alCambiar: (v: string) => void }) {
  const [vista, setVista] = useState(false);
  return (
    <div class={`campo campo-markdown${error ? ' campo-error' : ''}`}>
      <div class="markdown-cabeza">
        <span class="campo-etq">{etiqueta}</span>
        <div class="chips" role="group" aria-label="Modo">
          <button type="button" class="chip" aria-pressed={!vista} onClick={() => setVista(false)}>
            Escribir
          </button>
          <button type="button" class="chip" aria-pressed={vista} onClick={() => setVista(true)}>
            Vista previa
          </button>
        </div>
      </div>
      {vista ? (
        // markdownAHtml escapa todo el HTML antes de dar formato: no hay forma de inyectar etiquetas.
        <div class="prosa-previa" dangerouslySetInnerHTML={{ __html: markdownAHtml(valor) || '<p>Sin texto todavía.</p>' }} />
      ) : (
        <textarea class="mono-texto" rows={14} value={valor} onInput={(ev) => alCambiar((ev.target as HTMLTextAreaElement).value)} aria-label={typeof etiqueta === 'string' ? etiqueta : undefined} />
      )}
      <span class="campo-ayuda">{ayuda ? `${ayuda} ` : ''}Formato: ## Subtítulo, **negrita**, *cursiva*, [enlace](https://...), listas con guion.</span>
      {error && <span class="campo-msj">{error}</span>}
    </div>
  );
}
