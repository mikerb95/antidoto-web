// Métricas: embudo de solicitudes y lista de novedades. El periodo va arriba y manda sobre todo
// lo de solicitudes; la lista de novedades se mide siempre por semanas.
import { ESTADOS as LISTA_ESTADOS } from '@api/dominio';
import { useDatos } from '../api';
import { ponerQuery, useUbicacion } from '../ruteo';
import { usePuede } from '../sesion';
import { ESTADOS, SERVICIOS, ORIGENES_CONTACTO } from '../textos';
import { fecha, mes, pesos, pct, numero } from '../formato';
import type { MetricasLeads, MetricasMarketing } from '../tipos';
import { Cabecera, Cifra, Cifras, FalloCarga, Tarjeta, Cargando } from '../ui/base';
import { Barras, Columnas } from '../ui/graficas';

const PERIODOS = [
  { dias: 30, texto: 'Últimos 30 días' },
  { dias: 90, texto: 'Últimos 90 días' },
  { dias: 365, texto: 'Último año' },
];

export default function Metricas() {
  const { query } = useUbicacion();
  const puede = usePuede();
  const dias = Number(query.get('dias')) || 90;
  const m = useDatos<MetricasLeads>(`/admin/api/metricas?dias=${dias}`);
  const mk = useDatos<MetricasMarketing>(puede('marketing.ver') ? '/admin/api/marketing?semanas=12' : null);

  return (
    <>
      <Cabecera titulo="Métricas" descripcion="Cómo llegan y se cierran las solicitudes, y cómo crece la lista de novedades." />
      <div class="barra-filtros">
        <div class="chips" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button type="button" class="chip" aria-pressed={p.dias === dias} onClick={() => ponerQuery({ dias: p.dias === 90 ? null : p.dias })}>
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      {m.error ? (
        <FalloCarga error={m.error} reintentar={m.recargar} />
      ) : !m.datos ? (
        <Cargando />
      ) : (
        <div class={m.cargando ? 'recargando' : ''}>
          <h2 class="titulo-bloque">Solicitudes</h2>
          <Cifras>
            <Cifra etiqueta="Solicitudes" valor={numero(m.datos.total)} nota={`en ${dias} días`} />
            <Cifra etiqueta="Tasa de cierre" valor={m.datos.tasaCierre === null ? 'Sin cierres' : `${Math.round(m.datos.tasaCierre * 100)} %`} nota="ganadas sobre ganadas más perdidas" />
            <Cifra
              etiqueta="Primera respuesta"
              valor={m.datos.horasPrimeraRespuesta === null ? 'Sin datos' : `${m.datos.horasPrimeraRespuesta.toFixed(1)} h`}
              nota="mediana, de nuevo a contactado"
            />
            <Cifra etiqueta="Valor ganado" valor={pesos(m.datos.porServicio.reduce((a, s) => a + (s.valorGanado || 0), 0))} nota="según el valor estimado" />
          </Cifras>
          <div class="rejilla-2">
            <Tarjeta titulo="Embudo">
              <Barras filas={LISTA_ESTADOS.map((e) => ({ etiqueta: ESTADOS[e], n: m.datos!.porEstado[e], href: `/admin/solicitudes?estado=${e}` }))} />
            </Tarjeta>
            <Tarjeta titulo="Por servicio">
              <Barras filas={m.datos.porServicio.map((s) => ({ etiqueta: SERVICIOS[s.clave as keyof typeof SERVICIOS] ?? s.clave, n: s.n, extra: `${s.ganados} ganadas` }))} />
            </Tarjeta>
            <Tarjeta titulo="De dónde llegan">
              <Barras filas={m.datos.porOrigen.map((o) => ({ etiqueta: o.clave, n: o.n }))} />
            </Tarjeta>
            <Tarjeta titulo="Solicitudes por mes">
              <Columnas titulo="Solicitudes" puntos={m.datos.porMes.map((x) => ({ etiqueta: mes(x.clave), n: x.n }))} />
            </Tarjeta>
          </div>
        </div>
      )}

      {puede('marketing.ver') &&
        (mk.error ? (
          <FalloCarga error={mk.error} reintentar={mk.recargar} />
        ) : mk.datos ? (
          <ListaNovedades m={mk.datos} />
        ) : null)}
    </>
  );
}

function ListaNovedades({ m }: { m: MetricasMarketing }) {
  const creados = m.origenes.reduce((a, o) => a + o.total, 0);
  const confirmados = m.origenes.reduce((a, o) => a + o.confirmados, 0);
  const serie = (valores: number[]) => valores.map((n, i) => ({ etiqueta: fecha(m.semanas[i]), detalle: `Semana del ${fecha(m.semanas[i])}`, n }));
  return (
    <>
      <h2 class="titulo-bloque">Lista de novedades</h2>
      <Cifras>
        <Cifra etiqueta="Activos" valor={numero(m.conteos.activo)} nota={m.pausados ? `${m.pausados} en pausa` : 'reciben campañas'} href="/admin/contactos?estado=activo" />
        <Cifra etiqueta="Sin confirmar" valor={numero(m.conteos.pendiente)} nota="esperan su correo" href="/admin/contactos?estado=pendiente" />
        <Cifra etiqueta="Confirman" valor={creados ? pct(confirmados, creados) : 'Sin datos'} nota="del último año" />
        <Cifra etiqueta="Abren" valor={m.campanas.enviados ? pct(m.campanas.abiertos, m.campanas.enviados) : 'Sin envíos'} nota="campañas de estas semanas" />
      </Cifras>
      <div class="rejilla-3">
        <Tarjeta titulo="Altas por semana">
          <Columnas titulo="Altas" puntos={serie(m.altas)} alto={120} />
        </Tarjeta>
        <Tarjeta titulo="Confirmaciones por semana">
          <Columnas titulo="Confirmaciones" puntos={serie(m.confirmados)} alto={120} />
        </Tarjeta>
        <Tarjeta titulo="Bajas por semana">
          <Columnas titulo="Bajas" puntos={serie(m.bajas)} alto={120} />
        </Tarjeta>
      </div>
      <Tarjeta titulo="Confirmación por origen">
        <Barras filas={m.origenes.map((o) => ({ etiqueta: ORIGENES_CONTACTO[o.origen] ?? o.origen, n: o.total, extra: `${pct(o.confirmados, o.total)} confirma` }))} />
      </Tarjeta>
    </>
  );
}
