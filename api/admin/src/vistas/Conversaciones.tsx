// Conversaciones del chat con IA del sitio: lista filtrable, detalle tipo chat y métricas.
// Los teléfonos y correos llegan tapados desde la API; se guardan 90 días.
import { SERVICIOS as LISTA_SERVICIOS, type ServicioId, type Estado } from '@api/dominio';
import { api, mensajeError, useDatos } from '../api';
import { navegar, ponerQuery, useUbicacion } from '../ruteo';
import { usePuede } from '../sesion';
import { ESTADOS, SERVICIOS } from '../textos';
import { fecha, fechaLarga, hace, numero, pct, usd } from '../formato';
import { Aviso, Boton, BotonEnlace, Buscador, Cabecera, Chips, Cifra, Cifras, Datos, FalloCarga, Insignia, Paginacion, PanelLateral, Pestanas, Seccion, Tarjeta, Vacio, Cargando } from '../ui/base';
import { Barras, Columnas, Medidor } from '../ui/graficas';
import { avisar, confirmar } from '../ui/dialogos';
import { Icono } from '../ui/iconos';

export const PAGINAS: Record<string, string> = {
  inicio: 'Inicio',
  servicios: 'Servicios',
  clientes: 'Clientes',
  nosotros: 'Nosotros',
  contacto: 'Contacto',
  otra: 'Otra página',
  ...SERVICIOS,
};
const TEMAS: Record<string, string> = {
  precio: 'Precios',
  cotizacion: 'Cotización',
  fechas: 'Fechas y disponibilidad',
  lugar: 'Ciudades y lugar',
  grupo: 'Tamaño del grupo',
  formato: 'Formato y duración',
  contacto: 'Hablar con el equipo',
  servicios: 'Qué ofrecen',
  otro: 'Otros temas',
};
const RESULTADOS = [
  { valor: '', texto: 'Todas' },
  { valor: 'whatsapp', texto: 'Fueron a WhatsApp' },
  { valor: 'cotizador', texto: 'Fueron al cotizador' },
  { valor: 'sin_cierre', texto: 'Sin cierre' },
  { valor: 'guardia', texto: 'Con rechazo de la guardia' },
];
const HERRAMIENTAS: Record<string, string> = { preparar_whatsapp: 'Preparó WhatsApp', pedir_contacto: 'Mostró el cotizador' };
const RESPALDOS: Record<string, string> = { guardia: 'La guardia quitó una cifra de dinero', negativa: 'El modelo se negó a responder', vueltas: 'No llegó a una respuesta' };

interface Fila {
  id: string;
  creada: number;
  actualizada: number;
  locale: 'es' | 'en';
  paginaInicial: string | null;
  origen: string | null;
  servicio: ServicioId | null;
  preguntas: number;
  whatsapp: number | null;
  cotizador: number | null;
  guardia: number;
  costoUsd: number;
  leadId: string | null;
  primera: string | null;
}

export default function Conversaciones({ params }: { params: string[] }) {
  const { query } = useUbicacion();
  const puede = usePuede();
  const vista = query.get('vista') === 'metricas' ? 'metricas' : 'lista';
  return (
    <>
      <Cabecera
        titulo="Conversaciones del chat"
        descripcion="Lo que la gente le pregunta al asistente con IA del sitio. Se guardan 90 días, sin teléfonos ni correos."
        acciones={
          <BotonEnlace href={`/admin/api/conversaciones.csv${location.search}`} download>
            <Icono nombre="descargar" /> Exportar CSV
          </BotonEnlace>
        }
      />
      <Pestanas
        etiqueta="Vista"
        valor={vista}
        alCambiar={(v) => navegar(v === 'metricas' ? '/admin/conversaciones?vista=metricas' : '/admin/conversaciones')}
        opciones={[
          { valor: 'lista', texto: 'Conversaciones' },
          { valor: 'metricas', texto: 'Métricas' },
        ]}
      />
      {vista === 'metricas' ? <Metricas puedeAjustar={puede('config.editar')} /> : <Lista abierta={params[0] ?? null} />}
    </>
  );
}

function Lista({ abierta }: { abierta: string | null }) {
  const { query } = useUbicacion();
  const resultado = query.get('resultado') ?? '';
  const servicio = query.get('servicio') ?? '';
  const q = query.get('q') ?? '';
  const pagina = Number(query.get('pagina')) || 0;
  const filtros = new URLSearchParams(Object.entries({ resultado, servicio, q, pagina: pagina ? String(pagina) : '' }).filter(([, v]) => v));
  const d = useDatos<{ conversaciones: Fila[]; total: number; pagina: number; porPagina: number }>(`/admin/api/conversaciones?${filtros}`);
  const sufijo = location.search;

  return (
    <>
      <div class="barra-filtros">
        <Chips etiqueta="Resultado" valor={resultado} alCambiar={(v) => ponerQuery({ resultado: v, pagina: null })} opciones={RESULTADOS} />
        <div class="filtros-derecha">
          <label class="sr" for="f-serv-conv">
            Servicio
          </label>
          <select id="f-serv-conv" value={servicio} onChange={(e) => ponerQuery({ servicio: (e.target as HTMLSelectElement).value, pagina: null })}>
            <option value="">Todos los servicios</option>
            {LISTA_SERVICIOS.map((s) => (
              <option value={s}>{SERVICIOS[s]}</option>
            ))}
          </select>
          <Buscador etiqueta="Buscar en las conversaciones" placeholder="Buscar en lo que escribieron" valor={q} alCambiar={(v) => ponerQuery({ q: v, pagina: null })} />
        </div>
      </div>
      <div class={`dividido${abierta ? ' con-lateral' : ''}`}>
        <div class="tarjeta sin-relleno lista">
          {d.error ? (
            <FalloCarga error={d.error} reintentar={d.recargar} />
          ) : !d.datos ? (
            <Cargando />
          ) : !d.datos.conversaciones.length ? (
            <Vacio titulo={resultado || servicio || q ? 'Nada con estos filtros' : 'Todavía no hay conversaciones'}>
              {resultado || servicio || q ? 'Prueba con otros filtros.' : 'Cuando alguien use el chat con IA del sitio, la conversación aparece aquí.'}
            </Vacio>
          ) : (
            <ul class={`lista-filas${d.cargando ? ' recargando' : ''}`}>
              {d.datos.conversaciones.map((c) => (
                <li class={c.id === abierta ? 'activa' : ''}>
                  <a class="lf-enlace" href={`/admin/conversaciones/${c.id}${sufijo}`}>
                    <span class="lf-principal">
                      <span class="lf-titulo">{c.primera ?? 'Sin mensajes'}</span>
                      <span class="lf-sub">
                        {[c.servicio ? SERVICIOS[c.servicio] : null, c.paginaInicial !== c.servicio ? (PAGINAS[c.paginaInicial ?? ''] ?? c.paginaInicial) : null, `${c.preguntas} ${c.preguntas === 1 ? 'pregunta' : 'preguntas'}`, c.origen === 'facilitador' ? 'Facilitador' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <ResultadoConversacion c={c} />
                    <span class="lf-meta">{hace(c.actualizada)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {d.datos && <Paginacion total={d.datos.total} pagina={d.datos.pagina} porPagina={d.datos.porPagina} alCambiar={(p) => ponerQuery({ pagina: p })} />}
        </div>
        {abierta && <Detalle key={abierta} id={abierta} alCerrar={() => navegar(`/admin/conversaciones${sufijo}`)} alBorrar={d.recargar} />}
      </div>
    </>
  );
}

function ResultadoConversacion({ c }: { c: Pick<Fila, 'whatsapp' | 'cotizador' | 'guardia' | 'leadId'> }) {
  if (c.leadId) return <Insignia tono="exito">Cotizó</Insignia>;
  if (c.whatsapp) return <Insignia tono="exito">WhatsApp</Insignia>;
  if (c.cotizador) return <Insignia tono="info">Cotizador</Insignia>;
  if (c.guardia) return <Insignia tono="alerta">Guardia</Insignia>;
  return <Insignia tono="apagado">Sin cierre</Insignia>;
}

interface Mensaje {
  id: string;
  n: number;
  rol: 'usuario' | 'asesor';
  texto: string;
  creado: number;
  herramientas: string[] | null;
  whatsapp: string | null;
  respaldo: string | null;
  tema: string | null;
  costoUsd: number | null;
}
interface DetalleConv {
  conversacion: Fila & { paginaUltima: string | null; negativa: number; vueltas: number; tokensEntrada: number; tokensSalida: number; cacheLectura: number; expira: number };
  mensajes: Mensaje[];
  lead: { id: string; nombre: string | null; empresa: string | null; estado: Estado; anonimizado: number | null } | null;
}

function Detalle({ id, alCerrar, alBorrar }: { id: string; alCerrar: () => void; alBorrar: () => void }) {
  const d = useDatos<DetalleConv>(`/admin/api/conversaciones/${id}`);
  const puede = usePuede();
  if (d.error) return <PanelLateral titulo="Conversación" alCerrar={alCerrar}><FalloCarga error={d.error} /></PanelLateral>;
  if (!d.datos) return <PanelLateral titulo="Conversación" alCerrar={alCerrar}><Cargando /></PanelLateral>;
  const { conversacion: c, mensajes, lead } = d.datos;

  const borrar = async () => {
    if (!(await confirmar({ titulo: 'Borrar conversación', texto: 'Se borran todos sus mensajes. Los contadores del día no cambian. No se puede deshacer.', confirmar: 'Borrar', peligro: true }))) return;
    try {
      await api(`/admin/api/conversaciones/${id}`, { method: 'DELETE' });
      avisar('Conversación borrada', 'exito');
      alBorrar();
      alCerrar();
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  };

  return (
    <PanelLateral etiqueta={c.servicio ? SERVICIOS[c.servicio] : 'Chat con IA'} titulo={`Conversación del ${fecha(c.creada)}`} alCerrar={alCerrar} ancho="ancho">
      <div class="ficha-estado">
        <ResultadoConversacion c={c} />
        <span class="suave">
          {c.preguntas} {c.preguntas === 1 ? 'pregunta' : 'preguntas'} · {usd(c.costoUsd, 4)}
        </span>
      </div>
      {lead && (
        <Aviso tono="exito">
          <span>
            Esta persona pidió una cotización:{' '}
            <a href={`/admin/solicitudes/${lead.id}`}>{lead.anonimizado ? 'solicitud con datos suprimidos' : [lead.nombre, lead.empresa].filter(Boolean).join(', ')}</a> ({ESTADOS[lead.estado]}).
          </span>
        </Aviso>
      )}
      <ol class="chat">
        {mensajes.map((m) => (
          <li class={`chat-msg chat-${m.rol}`}>
            <span class="chat-quien">
              {m.rol === 'usuario' ? 'Visitante' : 'Asistente'} · {fecha(m.creado, true)}
              {m.rol === 'usuario' && m.tema && m.tema !== 'otro' ? ` · ${TEMAS[m.tema] ?? m.tema}` : ''}
            </span>
            <p class="chat-burbuja">{m.texto}</p>
            {m.rol === 'asesor' && (m.herramientas?.length || m.respaldo || m.whatsapp) && (
              <div class="chat-notas">
                {m.herramientas?.map((h) => <Insignia tono="info">{HERRAMIENTAS[h] ?? h}</Insignia>)}
                {m.respaldo && <Insignia tono="alerta">{RESPALDOS[m.respaldo] ?? m.respaldo}</Insignia>}
                {m.whatsapp && (
                  <details class="ayuda">
                    <summary>Mensaje de WhatsApp que armó</summary>
                    <p class="mensaje">{m.whatsapp}</p>
                  </details>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <Seccion titulo="Datos">
        <Datos
          filas={[
            ['Empezó en', PAGINAS[c.paginaInicial ?? ''] ?? c.paginaInicial],
            ['Siguió en', c.paginaUltima !== c.paginaInicial ? (PAGINAS[c.paginaUltima ?? ''] ?? c.paginaUltima) : null],
            ['Desde', c.origen === 'facilitador' ? 'Facilitador del mundo pixel' : 'Burbuja del chat'],
            ['Idioma', c.locale === 'en' ? 'Inglés' : 'Español'],
            ['Última actividad', fechaLarga(c.actualizada)],
            ['Tokens', `${numero(c.tokensEntrada + c.cacheLectura)} de entrada · ${numero(c.tokensSalida)} de salida`],
            ['Se borra el', fecha(c.expira)],
          ]}
        />
      </Seccion>
      {puede('datos.suprimir') && (
        <Boton variante="peligro" chico onClick={borrar}>
          Borrar conversación
        </Boton>
      )}
    </PanelLateral>
  );
}

interface MetricasConv {
  dias: number;
  tope: number | null;
  activo: boolean | null;
  configurado: boolean;
  porDia: { dia: string; usd: number; conversaciones: number; preguntas: number; derivaciones: number; guardia: number }[];
  totales: { conversaciones: number; preguntas: number; whatsapp: number; cotizador: number; derivadas: number; guardia: number; negativa: number; vueltas: number; costo: number; conLead: number };
  temas: { clave: string | null; n: number }[];
  paginas: { clave: string | null; n: number }[];
  servicios: { clave: string | null; n: number }[];
}

/** Días seguidos del periodo, con cero donde no hubo actividad. */
function rellenarDias<T extends { dia: string }>(filas: T[], dias: number, vacio: (dia: string) => T): T[] {
  const por = new Map(filas.map((f) => [f.dia, f]));
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
  return Array.from({ length: dias }, (_, i) => {
    const dia = fmt.format(Date.now() - (dias - 1 - i) * 86_400_000);
    return por.get(dia) ?? vacio(dia);
  });
}
const diaCorto = (dia: string) => fecha(Date.parse(`${dia}T12:00:00-05:00`));

function Metricas({ puedeAjustar }: { puedeAjustar: boolean }) {
  const { query } = useUbicacion();
  const dias = Number(query.get('dias')) || 30;
  const d = useDatos<MetricasConv>(`/admin/api/conversaciones/metricas?dias=${dias}`);
  if (d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!d.datos) return <Cargando />;
  const m = d.datos;
  const t = m.totales;
  const serie = rellenarDias(m.porDia, m.dias, (dia) => ({ dia, usd: 0, conversaciones: 0, preguntas: 0, derivaciones: 0, guardia: 0 }));
  const hoy = serie.at(-1)!;
  return (
    <div class={d.cargando ? 'recargando' : ''}>
      <div class="barra-filtros">
        <div class="chips" role="group" aria-label="Periodo">
          {[7, 30, 90].map((n) => (
            <button type="button" class="chip" aria-pressed={n === dias} onClick={() => ponerQuery({ dias: n === 30 ? null : n })}>
              Últimos {n} días
            </button>
          ))}
        </div>
      </div>
      {!m.configurado && <Aviso tono="alerta">Falta la clave de la API de Claude: el sitio ofrece solo WhatsApp.</Aviso>}
      {m.activo === false && <Aviso tono="alerta">El chat está apagado desde Ajustes.</Aviso>}
      <Cifras>
        <Cifra etiqueta="Conversaciones" valor={numero(t.conversaciones)} nota={`en ${m.dias} días`} />
        <Cifra etiqueta="Preguntas por conversación" valor={t.conversaciones ? (t.preguntas / t.conversaciones).toFixed(1) : 'Sin datos'} nota="promedio" />
        <Cifra etiqueta="Derivación" valor={pct(t.derivadas, t.conversaciones)} nota={`${t.whatsapp} a WhatsApp, ${t.cotizador} al cotizador, ${t.conLead} cotizaron`} />
        <Cifra etiqueta="Gasto" valor={usd(t.costo)} nota={t.conversaciones ? `${usd(t.costo / t.conversaciones, 4)} por conversación` : 'estimado por tokens'} />
      </Cifras>
      <div class="rejilla-2">
        <Tarjeta titulo="Gasto por día" acciones={puedeAjustar ? <a href="/admin/ajustes">Cambiar el tope</a> : undefined}>
          {m.tope !== null && (
            <>
              <p class="gasto">
                <strong>{usd(hoy.usd)}</strong> <span class="suave">hoy, de {usd(m.tope)}</span>
              </p>
              <Medidor valor={hoy.usd} max={m.tope} etiqueta="Gasto de hoy frente al tope diario" />
            </>
          )}
          <Columnas titulo="Gasto (USD)" puntos={serie.map((s) => ({ etiqueta: diaCorto(s.dia), n: s.usd }))} formato={(n) => usd(n)} referencia={m.tope ? { valor: m.tope, texto: `Tope ${usd(m.tope)}` } : undefined} />
        </Tarjeta>
        <Tarjeta titulo="Conversaciones por día">
          <Columnas titulo="Conversaciones" puntos={serie.map((s) => ({ etiqueta: diaCorto(s.dia), n: s.conversaciones }))} />
        </Tarjeta>
        <Tarjeta titulo="Qué preguntan">
          <Barras filas={m.temas.map((x) => ({ etiqueta: TEMAS[x.clave ?? 'otro'] ?? x.clave ?? 'Otros', n: x.n }))} vacio="Todavía no hay preguntas en este periodo." />
        </Tarjeta>
        <Tarjeta titulo="Servicio del que hablan">
          <Barras filas={m.servicios.map((x) => ({ etiqueta: SERVICIOS[x.clave as ServicioId] ?? x.clave ?? '', n: x.n, href: `/admin/conversaciones?servicio=${x.clave}` }))} vacio="El asistente todavía no identificó servicios." />
        </Tarjeta>
        <Tarjeta titulo="Dónde empiezan">
          <Barras filas={m.paginas.map((x) => ({ etiqueta: PAGINAS[x.clave ?? ''] ?? x.clave ?? 'Sin dato', n: x.n }))} />
        </Tarjeta>
        <Tarjeta titulo="Respuestas de respaldo">
          <p class="suave texto-chico">Veces que el asistente no dio la respuesta del modelo. Si la guardia salta mucho, conviene revisar el prompt.</p>
          <Barras
            filas={[
              { etiqueta: 'Guardia de precios', n: t.guardia, href: '/admin/conversaciones?resultado=guardia' },
              { etiqueta: 'El modelo se negó', n: t.negativa },
              { etiqueta: 'No llegó a una respuesta', n: t.vueltas },
            ]}
          />
        </Tarjeta>
      </div>
    </div>
  );
}
