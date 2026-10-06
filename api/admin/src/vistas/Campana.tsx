// Una campaña: editor (borrador), programada o resultados (enviando, enviada, cancelada).
import { useEffect, useRef, useState } from 'preact/hooks';
import { SERVICIOS as LISTA_SERVICIOS } from '@api/dominio';
import { api, mensajeError, useDatos, ErrorApi } from '../api';
import { navegar } from '../ruteo';
import { usePuede } from '../sesion';
import { AYUDA_FORMATO, ESTADOS_CAMPANA, IDIOMAS, SERVICIOS } from '../textos';
import { cuenta, fecha, paraInput, pct } from '../formato';
import type { Campana as TCampana, DetalleCampana, Plantilla } from '../tipos';
import { Boton, Cabecera, Campo, Casilla, Cifra, Cifras, FalloCarga, Insignia, Tarjeta, Cargando, Aviso } from '../ui/base';
import { avisar, confirmar, preguntar } from '../ui/dialogos';
import { TablaDatos } from '../ui/graficas';
import { TONO_CAMPANA } from './Campanas';

export default function Campana({ params }: { params: string[] }) {
  const id = params[0]!;
  const nueva = id === 'nueva';
  const d = useDatos<DetalleCampana>(nueva ? null : `/admin/api/campanas/${id}`);
  const recargar = d.recargar;

  // Mientras sale, se refresca sola cada 10 s.
  useEffect(() => {
    if (d.datos?.campana.estado !== 'enviando') return;
    const t = setInterval(recargar, 10_000);
    return () => clearInterval(t);
  }, [d.datos?.campana.estado]);

  const volver = { href: '/admin/campanas', texto: 'Campañas' };
  if (nueva) return (<><Cabecera titulo="Nueva campaña" volver={volver} /><Editor c={null} audiencia={0} /></>);
  if (d.error) return (<><Cabecera titulo="Campaña" volver={volver} /><FalloCarga error={d.error} reintentar={recargar} /></>);
  if (!d.datos) return <Cargando />;
  const c = d.datos.campana;
  return (
    <>
      <Cabecera
        titulo={c.asunto}
        volver={volver}
        descripcion={
          <>
            <Insignia tono={TONO_CAMPANA[c.estado]!}>{ESTADOS_CAMPANA[c.estado]}</Insignia> {IDIOMAS[c.locale]} · creada por {c.autor}
          </>
        }
      />
      {c.estado === 'borrador' ? (
        <Editor c={c} audiencia={d.datos.audiencia} alGuardar={(x) => d.poner(x)} />
      ) : c.estado === 'programada' ? (
        <Programada d={d.datos} alCambiar={recargar} />
      ) : (
        <Resultados d={d.datos} alCambiar={recargar} />
      )}
    </>
  );
}

function BotonDuplicar({ c }: { c: TCampana }) {
  const puede = usePuede();
  if (!puede('marketing.editar')) return null;
  return (
    <Boton
      onClick={async () => {
        try {
          const r = await api<{ campana: TCampana }>(`/admin/api/campanas/${c.id}/duplicar`, { method: 'POST' });
          avisar('Copia creada como borrador', 'exito');
          navegar(`/admin/campanas/${r.campana.id}`);
        } catch (e) {
          avisar(mensajeError(e), 'error');
        }
      }}
    >
      Duplicar
    </Boton>
  );
}

function VistaPrevia({ src, titulo = 'Vista previa del correo' }: { src: string; titulo?: string }) {
  return (
    <div class="vista-previa-marco">
      <iframe class="vista-previa" title={titulo} src={src} />
    </div>
  );
}

function Editor({ c, audiencia, alGuardar }: { c: TCampana | null; audiencia: number; alGuardar?: (d: DetalleCampana) => void }) {
  const puede = usePuede();
  const editable = puede('marketing.editar');
  const form = useRef<HTMLFormElement>(null);
  const [ab, setAb] = useState(!!c?.asuntoB);
  const [guardando, setGuardando] = useState(false);
  const [cuando, setCuando] = useState(paraInput(Date.now() + 24 * 3_600_000));
  const plantillas = useDatos<{ plantillas: Plantilla[] }>(!c ? '/admin/api/plantillas' : null);

  const leer = () => {
    const f = new FormData(form.current!);
    return {
      asunto: f.get('asunto'),
      preheader: f.get('preheader'),
      locale: f.get('locale'),
      intereses: f.getAll('intereses'),
      cuerpo: f.get('cuerpo'),
      publica: f.get('publica') === 'on',
      asuntoB: ab ? f.get('asuntoB') : null,
      abMuestra: f.get('abMuestra'),
      abHoras: f.get('abHoras'),
    };
  };

  const guardar = async (e: Event) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = c
        ? await api<DetalleCampana>(`/admin/api/campanas/${c.id}`, { method: 'PATCH', body: leer() })
        : await api<DetalleCampana>('/admin/api/campanas', { method: 'POST', body: leer() });
      avisar('Borrador guardado', 'exito');
      if (!c) navegar(`/admin/campanas/${r.campana.id}`, { reemplazar: true });
      else alGuardar?.(r);
    } catch (err) {
      avisar(mensajeError(err, 'Revisa el asunto y el mensaje.'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const usarPlantilla = (idPlantilla: string) => {
    const p = plantillas.datos?.plantillas.find((x) => x.id === idPlantilla);
    const el = form.current?.elements as unknown as Record<string, HTMLInputElement> | undefined;
    if (!p || !el) return;
    el.asunto!.value = p.asunto;
    el.preheader!.value = p.preheader ?? '';
    el.cuerpo!.value = p.cuerpo;
    el.locale!.value = p.locale;
  };

  const guardarPlantilla = async () => {
    const nombre = await preguntar({ titulo: 'Guardar como plantilla', etiqueta: 'Nombre de la plantilla', valor: c?.asunto });
    if (!nombre) return;
    try {
      await api('/admin/api/plantillas', { body: { nombre, ...leer() } });
      avisar('Plantilla guardada', 'exito');
    } catch (e) {
      avisar(mensajeError(e, 'Revisa el asunto y el mensaje.'), 'error');
    }
  };

  const probar = async () => {
    try {
      const r = await api<{ para: string }>(`/admin/api/campanas/${c!.id}/prueba`, { method: 'POST' });
      avisar(`Prueba enviada a ${r.para}${c!.asuntoB ? ' (las dos variantes)' : ''}`, 'exito');
    } catch {
      avisar('No se pudo enviar la prueba. ¿Está configurado Resend?', 'error');
    }
  };

  const enviar = async () => {
    const ok = await confirmar({
      titulo: 'Enviar campaña',
      texto: `Se enviará "${c!.asunto}" a ${cuenta(audiencia, 'contacto', 'contactos')}. Sale por lotes en los próximos minutos y no se puede deshacer.`,
      confirmar: 'Enviar ahora',
    });
    if (!ok) return;
    try {
      await api(`/admin/api/campanas/${c!.id}/enviar`, { body: { destinatarios: audiencia } });
      avisar('Enviando', 'exito');
      location.reload();
    } catch (err) {
      if (err instanceof ErrorApi && err.datos.error === 'audiencia_cambio') {
        avisar(`La audiencia cambió: ahora son ${err.datos.audiencia}. Revisa y vuelve a enviar.`, 'error');
        location.reload();
      } else avisar(err instanceof ErrorApi && err.status === 503 ? 'Falta configurar Resend para enviar.' : mensajeError(err, 'No se pudo enviar.'), 'error');
    }
  };

  const programar = async () => {
    try {
      await api(`/admin/api/campanas/${c!.id}/programar`, { body: { fecha: new Date(cuando).getTime() } });
      avisar('Campaña programada', 'exito');
      location.reload();
    } catch (err) {
      avisar(err instanceof ErrorApi && err.status === 503 ? 'Falta configurar Resend para enviar.' : 'Elige una fecha al menos 5 minutos en el futuro.', 'error');
    }
  };

  const borrar = async () => {
    if (!(await confirmar({ titulo: 'Borrar borrador', texto: 'Se borra este borrador. No se puede deshacer.', confirmar: 'Borrar', peligro: true }))) return;
    try {
      await api(`/admin/api/campanas/${c!.id}`, { method: 'DELETE' });
      navegar('/admin/campanas');
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  };

  const intereses = new Set(c?.intereses ?? []);
  return (
    <div class="editor-campana">
      <form ref={form} class="tarjeta formulario" onSubmit={guardar}>
        <fieldset disabled={!editable}>
          {!c && !!plantillas.datos?.plantillas.length && (
            <Campo etiqueta="Empezar desde una plantilla">
              <select onChange={(e) => usarPlantilla((e.target as HTMLSelectElement).value)}>
                <option value="">En blanco</option>
                {plantillas.datos.plantillas.map((p) => (
                  <option value={p.id}>
                    {p.nombre} ({IDIOMAS[p.locale]})
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo etiqueta="Asunto">
            <input name="asunto" required maxLength={150} defaultValue={c?.asunto ?? ''} />
          </Campo>
          <Casilla checked={ab} onChange={(e) => setAb((e.target as HTMLInputElement).checked)}>
            Probar dos asuntos (A/B)
          </Casilla>
          {ab && (
            <div class="caja-suave">
              <Campo etiqueta="Asunto B">
                <input name="asuntoB" maxLength={150} defaultValue={c?.asuntoB ?? ''} autoFocus />
              </Campo>
              <div class="fila-campos">
                <Campo etiqueta="Muestra (%)">
                  <input name="abMuestra" type="number" min={10} max={100} step={5} defaultValue={String(c?.abMuestra ?? 20)} />
                </Campo>
                <Campo etiqueta="Decidir a las (horas)">
                  <input name="abHoras" type="number" min={1} max={72} defaultValue={String(c?.abHoras ?? 4)} />
                </Campo>
              </div>
              <p class="suave texto-chico">
                La muestra se parte en dos mitades: una recibe el asunto A y otra el B. Pasadas las horas, el resto recibe el que tuvo más clics (o más aperturas si nadie hizo clic). Con
                muestra de 100 % es un reparto mitad y mitad.
              </p>
            </div>
          )}
          <Campo etiqueta="Texto de vista previa" ayuda="Opcional. Se ve junto al asunto en la bandeja de entrada.">
            <input name="preheader" maxLength={200} defaultValue={c?.preheader ?? ''} />
          </Campo>
          <div class="fila-campos">
            <Campo etiqueta="Idioma">
              <select name="locale">
                <option value="es" selected={(c?.locale ?? 'es') === 'es'}>
                  Español
                </option>
                <option value="en" selected={c?.locale === 'en'}>
                  Inglés
                </option>
              </select>
            </Campo>
          </div>
          <fieldset class="grupo-casillas">
            <legend>Solo a interesados en (vacío es para todos)</legend>
            {LISTA_SERVICIOS.map((s) => (
              <Casilla name="intereses" value={s} defaultChecked={intereses.has(s)}>
                {SERVICIOS[s]}
              </Casilla>
            ))}
          </fieldset>
          <Campo etiqueta="Mensaje">
            <textarea name="cuerpo" rows={16} required class="mono-texto" defaultValue={c?.cuerpo ?? ''} />
          </Campo>
          <details class="ayuda">
            <summary>Cómo dar formato</summary>
            <ul>
              {AYUDA_FORMATO.map((a) => (
                <li>
                  <code>{a}</code>
                </li>
              ))}
            </ul>
          </details>
          <Casilla name="publica" defaultChecked={!!c?.publica}>
            Publicar en el archivo de novedades del sitio cuando salga
          </Casilla>
          {editable && (
            <div class="acciones">
              <Boton type="submit" variante="primario" disabled={guardando}>
                {c ? 'Guardar cambios' : 'Crear borrador'}
              </Boton>
              {c && <Boton onClick={guardarPlantilla}>Guardar como plantilla</Boton>}
              {c && <BotonDuplicar c={c} />}
            </div>
          )}
        </fieldset>
      </form>

      <div class="editor-lateral">
        {c ? (
          <>
            <Tarjeta titulo="Envío">
              <p class="audiencia">{audiencia ? `Le llegará a ${cuenta(audiencia, 'contacto activo', 'contactos activos')}.` : 'Nadie cumple estos filtros todavía.'}</p>
              <div class="acciones">
                {editable && <Boton onClick={probar}>Enviarme una prueba</Boton>}
                {puede('marketing.enviar') && (
                  <Boton variante="primario" disabled={!audiencia} onClick={enviar}>
                    Enviar ahora
                  </Boton>
                )}
              </div>
              {puede('marketing.enviar') && (
                <div class="programar">
                  <Campo etiqueta="O programar el envío">
                    <input type="datetime-local" value={cuando} min={paraInput(Date.now() + 10 * 60_000)} onInput={(e) => setCuando((e.target as HTMLInputElement).value)} />
                  </Campo>
                  <Boton disabled={!audiencia} onClick={programar}>
                    Programar
                  </Boton>
                </div>
              )}
              {!puede('marketing.enviar') && <p class="suave texto-chico">Tu rol prepara campañas; enviarlas o programarlas lo hace alguien de Comercial o Admin.</p>}
              {editable && (
                <Boton variante="peligro" chico onClick={borrar}>
                  Borrar borrador
                </Boton>
              )}
            </Tarjeta>
            <VistaPrevia src={`/admin/api/campanas/${c.id}/vista?v=${c.actualizada}`} />
          </>
        ) : (
          <Aviso>Guarda el borrador para ver la vista previa, enviarte una prueba, programarla y saber a cuántos contactos les llega.</Aviso>
        )}
      </div>
    </div>
  );
}

function Programada({ d, alCambiar }: { d: DetalleCampana; alCambiar: () => void }) {
  const c = d.campana;
  const puede = usePuede();
  return (
    <div class="editor-campana">
      <Tarjeta titulo="Programada">
        <p class="audiencia">
          Sale el {fecha(c.programada, true)} a {cuenta(d.audiencia, 'contacto activo', 'contactos activos')} (se cuentan de nuevo al salir).
        </p>
        {c.asuntoB && (
          <p class="suave">
            Prueba A/B: "{c.asunto}" contra "{c.asuntoB}", con el {c.abMuestra} % de la audiencia y decisión a las {c.abHoras} horas.
          </p>
        )}
        <p class="suave">Para cambiarla, primero quítale la programación.</p>
        <div class="acciones">
          {puede('marketing.editar') && (
            <Boton
              variante="primario"
              onClick={async () => {
                try {
                  await api(`/admin/api/campanas/${c.id}/desprogramar`, { method: 'POST' });
                  avisar('Volvió a borrador', 'exito');
                  alCambiar();
                } catch (e) {
                  avisar(mensajeError(e), 'error');
                }
              }}
            >
              Quitar programación
            </Boton>
          )}
          <BotonDuplicar c={c} />
        </div>
      </Tarjeta>
      <VistaPrevia src={`/admin/api/campanas/${c.id}/vista?v=${c.actualizada}`} />
    </div>
  );
}

function Resultados({ d, alCambiar }: { d: DetalleCampana; alCambiar: () => void }) {
  const c = d.campana;
  const st = d.stats ?? ({} as NonNullable<DetalleCampana['stats']>);
  const puede = usePuede();
  const v = (k: 'a' | 'b') => d.variantes?.find((x) => x.variante === k) ?? { enviados: 0, abiertos: 0, clics: 0 };
  const base = st.entregados || st.enviados;
  return (
    <>
      <p class="suave">
        Iniciada el {fecha(c.iniciada, true)}
        {c.terminada ? `, terminó el ${fecha(c.terminada, true)}` : ''}.{c.publica ? ' Aparece en el archivo de novedades del sitio.' : ''}
      </p>
      <div class="acciones">
        <BotonDuplicar c={c} />
        <a class="btn btn-fantasma" href={`/v1/novedades/${c.id}`} target="_blank" rel="noopener">
          Versión web
        </a>
        {c.estado === 'enviando' && puede('marketing.editar') && (
          <Boton
            variante="peligro"
            onClick={async () => {
              if (!(await confirmar({ titulo: 'Detener el envío', texto: 'Lo que ya salió no se puede recuperar. Lo que falta no se envía.', confirmar: 'Detener', peligro: true }))) return;
              await api(`/admin/api/campanas/${c.id}/cancelar`, { method: 'POST' }).catch((e) => avisar(mensajeError(e), 'error'));
              alCambiar();
            }}
          >
            Detener envío
          </Boton>
        )}
      </div>
      {c.estado === 'enviando' && <Aviso tono="info">Salen lotes de 100 cada 5 minutos. Esta página se actualiza sola.</Aviso>}
      <Cifras>
        <Cifra etiqueta="Enviados" valor={`${st.enviados || 0} de ${st.destinatarios || 0}`} nota={st.pendientes ? `${st.pendientes} en cola` : st.fallidos ? `${st.fallidos} fallidos` : undefined} />
        <Cifra etiqueta="Entregados" valor={pct(st.entregados, st.enviados)} nota={cuenta(st.entregados, 'correo', 'correos')} />
        <Cifra etiqueta="Abren" valor={pct(st.abiertos, base)} nota={cuenta(st.abiertos, 'persona', 'personas')} />
        <Cifra etiqueta="Hacen clic" valor={pct(st.clics, base)} nota={cuenta(st.clics, 'persona', 'personas')} />
      </Cifras>
      <Cifras>
        <Cifra etiqueta="Bajas" valor={st.bajas || 0} nota="desde esta campaña" />
        <Cifra etiqueta="Rebotes" valor={st.rebotes || 0} nota="direcciones que no existen" />
        <Cifra etiqueta="Quejas" valor={st.quejas || 0} nota="marcado como spam" />
        <Cifra etiqueta="Sobre las aperturas" valor="Referencia" nota="muchos programas de correo bloquean el conteo" />
      </Cifras>
      {c.asuntoB && (
        <Tarjeta titulo="Prueba A/B de asunto">
          <p class="suave">{c.abGanador ? `Ganó la variante ${c.abGanador.toUpperCase()}: el resto de la audiencia la recibió.` : `Se decide el ${fecha(c.abDecision, true)}. Hasta entonces, el resto espera.`}</p>
          <TablaDatos
            cabeza={['Variante', 'Enviados', 'Abren', 'Clics']}
            filas={(['a', 'b'] as const).map((k) => [`${k.toUpperCase()}${c.abGanador === k ? ' (ganadora)' : ''}: ${k === 'a' ? c.asunto : c.asuntoB}`, v(k).enviados, pct(v(k).abiertos, v(k).enviados), pct(v(k).clics, v(k).enviados)])}
          />
        </Tarjeta>
      )}
      <Tarjeta titulo="Correo enviado">
        <VistaPrevia src={`/admin/api/campanas/${c.id}/vista`} titulo="Correo enviado" />
      </Tarjeta>
    </>
  );
}
