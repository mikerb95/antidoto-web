// Portal de proyectos para clientes: ver el avance, revisar entregables y aprobarlos o pedir
// cambios, y dejar comentarios. Reutiliza los componentes y estilos del panel con su propia sesión
// (cookie aparte, src/portal/ de la API).
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api, cuandoSePierdaLaSesion, mensajeError, useDatos } from '../api';
import { interceptarEnlaces, useUbicacion } from '../ruteo';
import { SERVICIOS } from '../textos';
import { fechaLarga, hace } from '../formato';
import { Aviso, Boton, Cargando, FalloCarga, Insignia, Vacio } from '../ui/base';
import { AnfitrionAvisos, AnfitrionDialogos, avisar, confirmar } from '../ui/dialogos';
import '../estilos.css';
import './portal.css';
import type { ServicioId } from '@api/dominio';

interface Yo {
  nombre: string | null;
  email: string;
  organizacion: string;
}

const ESTADO_PROYECTO: Record<string, { texto: string; tono: string }> = {
  planeado: { texto: 'Planeado', tono: 'info' },
  en_curso: { texto: 'En curso', tono: 'medio' },
  en_pausa: { texto: 'En pausa', tono: 'alerta' },
  entregado: { texto: 'Entregado', tono: 'exito' },
  cerrado: { texto: 'Cerrado', tono: 'apagado' },
};
const ESTADO_ENTREGABLE: Record<string, { texto: string; tono: string }> = {
  borrador: { texto: 'En preparación', tono: 'apagado' },
  en_revision: { texto: 'Para tu revisión', tono: 'info' },
  cambios: { texto: 'Cambios en curso', tono: 'alerta' },
  aprobado: { texto: 'Aprobado', tono: 'exito' },
};
const dia = (f: string | null) => (f ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${f}T00:00:00Z`)) : '');
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Portal() {
  const [yo, setYo] = useState<Yo | null | undefined>(undefined);
  const { ruta } = useUbicacion();
  useEffect(() => {
    cuandoSePierdaLaSesion(() => setYo(null));
    api<Yo>('/portal/api/yo')
      .then(setYo)
      .catch(() => setYo(null));
  }, []);
  if (ruta.startsWith('/portal/entrar') || yo === null) return <Entrar />;
  if (yo === undefined)
    return (
      <div class="arranque">
        <Cargando texto="Abriendo el portal" />
      </div>
    );
  const m = ruta.match(/^\/portal\/proyectos\/([0-9a-f-]{36})\/?$/);
  return (
    <div class="portal">
      <a class="saltar" href="#principal">
        Saltar al contenido
      </a>
      <header class="portal-barra">
        <a class="marca" href="/portal/">
          <span class="marca-nombre">Antídoto</span>
          <span class="marca-sub">Portal de proyectos</span>
        </a>
        <div class="portal-yo">
          <span>
            <strong>{yo.nombre ?? yo.email}</strong>
            <span class="fila-sub">{yo.organizacion}</span>
          </span>
          <Boton
            chico
            onClick={async () => {
              await api('/portal/auth/salir', { method: 'POST' }).catch(() => null);
              location.href = '/portal/';
            }}
          >
            Salir
          </Boton>
        </div>
      </header>
      <main id="principal" class="portal-contenido" tabIndex={-1}>
        {m ? <ProyectoPortal id={m[1]!} /> : <Lista yo={yo} />}
      </main>
      <AnfitrionDialogos />
      <AnfitrionAvisos />
    </div>
  );
}

function Entrar() {
  const token = new URLSearchParams(location.hash.slice(1)).get('t');
  const error = new URLSearchParams(location.search).get('error');
  const [enviado, setEnviado] = useState(false);
  return (
    <main class="entrar">
      <div class="entrar-caja">
        <p class="marca-nombre">Antídoto</p>
        {token ? (
          <>
            <h1>Entrar al portal</h1>
            <p class="suave">Confirma para abrir el portal de proyectos en este navegador.</p>
            <form method="post" action="/portal/auth/entrar">
              <input type="hidden" name="t" value={token} />
              <button class="btn btn-primario btn-bloque" type="submit">
                Entrar
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Portal de proyectos</h1>
            <p class="suave">Escribe el correo con el que el equipo de Antídoto te dio acceso y te enviamos un enlace para entrar.</p>
            {error === 'enlace' && !enviado && <Aviso tono="alerta">El enlace venció o ya se usó. Pide uno nuevo.</Aviso>}
            {enviado ? (
              <Aviso tono="exito">Si el correo tiene acceso, te llega un enlace en un minuto. Vence en 15 minutos y sirve una sola vez.</Aviso>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const email = new FormData(e.target as HTMLFormElement).get('email');
                  await fetch('/portal/auth/enlace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => null);
                  setEnviado(true);
                }}
              >
                <label class="campo">
                  <span class="campo-etq">Correo</span>
                  <input name="email" type="email" autocomplete="email" required autoFocus />
                </label>
                <button class="btn btn-primario btn-bloque" type="submit">
                  Enviarme el enlace
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}

interface Resumen {
  id: string;
  codigo: string;
  nombre: string;
  linea: ServicioId;
  estado: string;
  entrega: string | null;
  etapas: number;
  hechas: number;
  porRevisar: number;
}

function Lista({ yo }: { yo: Yo }) {
  const d = useDatos<{ proyectos: Resumen[] }>('/portal/api/proyectos');
  return (
    <>
      <header class="cabecera">
        <div class="cabecera-texto">
          <h1 id="titulo-pagina" tabIndex={-1}>
            Hola{yo.nombre ? `, ${yo.nombre.split(' ')[0]}` : ''}
          </h1>
          <p class="cabecera-desc">Los proyectos de {yo.organizacion} con Antídoto.</p>
        </div>
      </header>
      {d.error ? (
        <FalloCarga error={d.error} reintentar={d.recargar} />
      ) : !d.datos ? (
        <Cargando />
      ) : !d.datos.proyectos.length ? (
        <Vacio titulo="Todavía no hay proyectos para mostrar">Cuando el equipo de Antídoto arranque un proyecto contigo, aparece aquí.</Vacio>
      ) : (
        <ul class="portal-proyectos">
          {d.datos.proyectos.map((p) => (
            <li>
              <a class="portal-proyecto" href={`/portal/proyectos/${p.id}`}>
                <span class="pp-cabeza">
                  <span class="pp-titulo">{p.nombre}</span>
                  <Insignia tono={ESTADO_PROYECTO[p.estado]?.tono ?? 'info'}>{ESTADO_PROYECTO[p.estado]?.texto ?? p.estado}</Insignia>
                </span>
                <span class="fila-sub">
                  {SERVICIOS[p.linea]} · {p.codigo}
                  {p.entrega ? ` · entrega ${dia(p.entrega)}` : ''}
                </span>
                <span class="pp-avance" role="img" aria-label={`${p.hechas} de ${p.etapas} etapas terminadas`}>
                  <span style={{ width: `${p.etapas ? (p.hechas / p.etapas) * 100 : 0}%` }} />
                </span>
                <span class="texto-chico suave">
                  {p.hechas} de {p.etapas} etapas
                  {p.porRevisar ? <strong class="pp-revisar"> · {p.porRevisar === 1 ? '1 entregable para revisar' : `${p.porRevisar} entregables para revisar`}</strong> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface DetallePortal {
  proyecto: { id: string; codigo: string; nombre: string; linea: ServicioId; estado: string; inicio: string | null; entrega: string | null; responsable: string | null };
  etapas: { id: string; nombre: string; estado: 'pendiente' | 'en_curso' | 'hecha'; fecha: string | null }[];
  tareas: { id: string; titulo: string; hecha: number | null; vence: string | null }[];
  entregables: {
    id: string;
    titulo: string;
    descripcion: string | null;
    estado: string;
    vence: string | null;
    version: number;
    aprobadoPor: string | null;
    aprobadoEn: number | null;
    archivos: { id: string; nombre: string; bytes: number; version: number; subido: number }[];
  }[];
  bitacora: { id: string; creado: number; autorTipo: string; autor: string | null; texto: string | null }[];
}

function ProyectoPortal({ id }: { id: string }) {
  const d = useDatos<DetallePortal>(`/portal/api/proyectos/${id}`);
  const [comentario, setComentario] = useState('');
  if (d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!d.datos) return <Cargando />;
  const { proyecto: p, etapas, tareas, entregables, bitacora } = d.datos;

  const aprobar = async (eid: string, titulo: string) => {
    if (!(await confirmar({ titulo: `Aprobar ${titulo}`, texto: 'Le avisamos al equipo de Antídoto que este entregable está listo.', confirmar: 'Aprobar' }))) return;
    try {
      d.poner(await api<DetallePortal>(`/portal/api/entregables/${eid}/aprobar`, { body: {} }));
      avisar('Aprobado. Gracias.', 'exito');
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  };
  const pedirCambios = async (eid: string, texto: string) => {
    try {
      d.poner(await api<DetallePortal>(`/portal/api/entregables/${eid}/cambios`, { body: { comentario: texto } }));
      avisar('Le enviamos tus comentarios al equipo.', 'exito');
      return true;
    } catch (e) {
      avisar(mensajeError(e, 'Escribe qué quieres cambiar.'), 'error');
      return false;
    }
  };

  return (
    <>
      <header class="cabecera">
        <div class="cabecera-texto">
          <a class="volver" href="/portal/">
            <span aria-hidden="true">←</span> Mis proyectos
          </a>
          <h1 id="titulo-pagina" tabIndex={-1}>
            {p.nombre}
          </h1>
          <p class="cabecera-desc">
            <Insignia tono={ESTADO_PROYECTO[p.estado]?.tono ?? 'info'}>{ESTADO_PROYECTO[p.estado]?.texto ?? p.estado}</Insignia>
            {SERVICIOS[p.linea]} · {p.codigo}
            {p.entrega ? ` · entrega el ${dia(p.entrega)}` : ''}
            {p.responsable ? ` · te acompaña ${p.responsable}` : ''}
          </p>
        </div>
      </header>

      <section class="tarjeta">
        <h2 class="titulo-bloque">Avance</h2>
        <ol class="portal-etapas">
          {etapas.map((e) => (
            <li class={`e-${e.estado}`}>
              <span class="pe-marca" aria-hidden="true" />
              <span class="pe-nombre">{e.nombre}</span>
              <span class="pe-estado">{e.estado === 'hecha' ? 'Hecha' : e.estado === 'en_curso' ? 'En curso' : 'Pendiente'}</span>
            </li>
          ))}
        </ol>
        {tareas.length > 0 && (
          <ul class="portal-tareas">
            {tareas.map((t) => (
              <li class={t.hecha ? 'hecha' : ''}>
                {t.hecha ? 'Hecho' : 'Pendiente'}: {t.titulo}
                {t.vence && !t.hecha ? ` (para el ${dia(t.vence)})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="tarjeta">
        <h2 class="titulo-bloque">Entregables</h2>
        {entregables.length ? (
          <ul class="entregables">
            {entregables.map((e) => (
              <EntregablePortal e={e} alAprobar={() => aprobar(e.id, e.titulo)} alPedirCambios={(t) => pedirCambios(e.id, t)} />
            ))}
          </ul>
        ) : (
          <p class="suave">Todavía no hay entregables para revisar.</p>
        )}
      </section>

      <section class="tarjeta">
        <h2 class="titulo-bloque">Conversación del proyecto</h2>
        <form
          class="formulario"
          onSubmit={async (ev) => {
            ev.preventDefault();
            try {
              d.poner(await api<DetallePortal>(`/portal/api/proyectos/${p.id}/comentar`, { body: { texto: comentario } }));
              setComentario('');
              avisar('Comentario enviado al equipo.', 'exito');
            } catch (e) {
              avisar(mensajeError(e), 'error');
            }
          }}
        >
          <label class="campo">
            <span class="campo-etq">Escríbele al equipo</span>
            <textarea rows={3} maxLength={2000} value={comentario} onInput={(e) => setComentario((e.target as HTMLTextAreaElement).value)} />
          </label>
          <div class="acciones">
            <Boton type="submit" variante="primario" disabled={!comentario.trim()}>
              Enviar comentario
            </Boton>
          </div>
        </form>
        <ol class="linea-tiempo">
          {bitacora.map((b) => (
            <li>
              <span class="lt-texto">{b.texto}</span>
              <span class="lt-meta">
                {fechaLarga(b.creado)}
                {b.autor ? ` · ${b.autor}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function EntregablePortal({ e, alAprobar, alPedirCambios }: { e: DetallePortal['entregables'][number]; alAprobar: () => void; alPedirCambios: (t: string) => Promise<boolean> }) {
  const [cambios, setCambios] = useState(false);
  const [texto, setTexto] = useState('');
  const est = ESTADO_ENTREGABLE[e.estado] ?? { texto: e.estado, tono: 'info' };
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
        <Insignia tono={est.tono}>{est.texto}</Insignia>
      </div>
      {e.descripcion && <p>{e.descripcion}</p>}
      {e.archivos.length > 0 && (
        <ul class="archivos">
          {e.archivos.map((a) => (
            <li>
              <a href={`/portal/api/archivos/${a.id}`} download>
                Descargar {a.nombre}
              </a>
              <span class="suave texto-chico">
                versión {a.version} · {kb(a.bytes)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {e.estado === 'en_revision' &&
        (cambios ? (
          <form
            class="formulario"
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (await alPedirCambios(texto)) setCambios(false);
            }}
          >
            <label class="campo">
              <span class="campo-etq">¿Qué quieres cambiar?</span>
              <textarea rows={3} maxLength={2000} value={texto} onInput={(ev) => setTexto((ev.target as HTMLTextAreaElement).value)} autoFocus />
            </label>
            <div class="acciones">
              <Boton type="submit" variante="primario" disabled={!texto.trim()}>
                Enviar cambios
              </Boton>
              <Boton onClick={() => setCambios(false)}>Cancelar</Boton>
            </div>
          </form>
        ) : (
          <div class="acciones">
            <Boton variante="primario" onClick={alAprobar}>
              Aprobar
            </Boton>
            <Boton onClick={() => setCambios(true)}>Pedir cambios</Boton>
          </div>
        ))}
    </li>
  );
}

interceptarEnlaces('/portal/');
render(<Portal />, document.getElementById('app')!);
