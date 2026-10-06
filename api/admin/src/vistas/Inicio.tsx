// Inicio: lo que pide atención hoy. Cada bloque aparece según el rol.
import type { Estado, ServicioId } from '@api/dominio';
import { useDatos } from '../api';
import { useYo } from '../sesion';
import { ESTADOS, SERVICIOS, ESTADOS_CAMPANA } from '../textos';
import { fecha, hace, numero, usd } from '../formato';
import { Cabecera, Cifra, Cifras, FalloCarga, Insignia, Tarjeta, Cargando, Vacio } from '../ui/base';
import { Medidor } from '../ui/graficas';
import { TONO_ESTADO } from './Solicitudes';
import { TONO_CAMPANA } from './Campanas';
import type { ComponentChildren } from 'preact';

export interface DatosInicio {
  leads?: {
    sinRespuesta: number;
    horasSeguimiento: number;
    semana: number;
    abiertos: number;
    recientes: { id: string; nombre: string | null; empresa: string | null; servicio: ServicioId; estado: Estado; creado: number; anonimizado: number | null }[];
  };
  novedades?: { activos: number; enCurso: { id: string; asunto: string; estado: string; programada: number | null }[] };
  asesor?: { configurado: boolean; activo: boolean; tope: number; gastoHoy: number } | null;
  [bloque: string]: unknown;
}

/** Bloques que suman las fases siguientes (conversaciones, proyectos...), en orden. */
export const BLOQUES_INICIO: { cifras?: (d: DatosInicio) => ComponentChildren; tarjetas?: (d: DatosInicio) => ComponentChildren }[] = [];

const saludo = () => {
  const h = Number(new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false }).format(Date.now()));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

export default function Inicio() {
  const yo = useYo();
  const d = useDatos<DatosInicio>('/admin/api/inicio');
  return (
    <>
      <Cabecera titulo={`${saludo()}, ${yo.nombre.split(' ')[0]}`} descripcion="Lo que pide atención hoy." />
      {d.error ? (
        <FalloCarga error={d.error} reintentar={d.recargar} />
      ) : !d.datos ? (
        <Cargando />
      ) : (
        <Contenido d={d.datos} />
      )}
    </>
  );
}

function Contenido({ d }: { d: DatosInicio }) {
  const { leads, novedades, asesor } = d;
  return (
    <>
      <Cifras>
        {leads && (
          <Cifra
            etiqueta="Sin respuesta"
            valor={numero(leads.sinRespuesta)}
            nota={`solicitudes nuevas de más de ${leads.horasSeguimiento} h`}
            href="/admin/solicitudes?estado=nuevo"
            tono={leads.sinRespuesta ? 'alerta' : undefined}
          />
        )}
        {leads && <Cifra etiqueta="Esta semana" valor={numero(leads.semana)} nota="solicitudes nuevas" href="/admin/solicitudes" />}
        {leads && <Cifra etiqueta="En curso" valor={numero(leads.abiertos)} nota="nuevas, contactadas o cotizadas" href="/admin/metricas" />}
        {novedades && <Cifra etiqueta="Lista de novedades" valor={numero(novedades.activos)} nota="contactos activos" href="/admin/contactos?estado=activo" />}
        {BLOQUES_INICIO.map((b) => b.cifras?.(d))}
      </Cifras>

      <div class="rejilla-inicio">
        {leads && (
          <Tarjeta titulo="Últimas solicitudes" acciones={<a href="/admin/solicitudes">Ver todas</a>} sinRelleno>
            {leads.recientes.length ? (
              <ul class="lista-filas">
                {leads.recientes.map((l) => (
                  <li>
                    <a href={`/admin/solicitudes/${l.id}`} class="lf-enlace">
                      <span class="lf-principal">
                        <span class="lf-titulo">{l.anonimizado ? 'Datos suprimidos' : l.nombre}</span>
                        <span class="lf-sub">{[l.empresa, SERVICIOS[l.servicio]].filter(Boolean).join(' · ')}</span>
                      </span>
                      <Insignia tono={TONO_ESTADO[l.estado]}>{ESTADOS[l.estado]}</Insignia>
                      <span class="lf-meta">{hace(l.creado)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio titulo="Todavía no hay solicitudes" />
            )}
          </Tarjeta>
        )}

        {asesor !== undefined && (
          <Tarjeta titulo="Chat con IA" acciones={<a href="/admin/ajustes">Ajustes</a>}>
            {asesor === null ? (
              <p class="suave">No se pudo leer el gasto de hoy. Mientras tanto, el chat no responde (falla cerrado).</p>
            ) : !asesor.configurado ? (
              <p class="suave">Sin clave de la API de Claude: el sitio ofrece solo WhatsApp.</p>
            ) : (
              <>
                <p class="gasto">
                  <strong>{usd(asesor.gastoHoy)}</strong> <span class="suave">de {usd(asesor.tope)} hoy</span>
                </p>
                <Medidor valor={asesor.gastoHoy} max={asesor.tope} etiqueta="Gasto del chat hoy frente al tope" />
                <p class="suave texto-chico">
                  {!asesor.activo ? 'Apagado desde Ajustes.' : asesor.gastoHoy >= asesor.tope ? 'Llegó al tope: vuelve a medianoche.' : 'Encendido. El tope se reinicia a medianoche, hora de Colombia.'}
                </p>
              </>
            )}
          </Tarjeta>
        )}

        {novedades && novedades.enCurso.length > 0 && (
          <Tarjeta titulo="Campañas en curso" acciones={<a href="/admin/campanas">Ver campañas</a>} sinRelleno>
            <ul class="lista-filas">
              {novedades.enCurso.map((c) => (
                <li>
                  <a href={`/admin/campanas/${c.id}`} class="lf-enlace">
                    <span class="lf-principal">
                      <span class="lf-titulo">{c.asunto}</span>
                      {c.programada && <span class="lf-sub">Sale el {fecha(c.programada, true)}</span>}
                    </span>
                    <Insignia tono={TONO_CAMPANA[c.estado] ?? 'info'}>{ESTADOS_CAMPANA[c.estado as keyof typeof ESTADOS_CAMPANA] ?? c.estado}</Insignia>
                  </a>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
        {BLOQUES_INICIO.map((b) => b.tarjetas?.(d))}
      </div>
    </>
  );
}
