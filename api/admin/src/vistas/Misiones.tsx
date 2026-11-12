// Misiones: lo que pasa en la plataforma de actividades (proyecto aparte) sin salir del panel, y la
// puerta para entrar a ella sin otra contraseña. Los juegos, las partidas en vivo y los reportes se
// siguen manejando allá.
import { useDatos, ErrorApi } from '../api';
import { cuenta, numero, pct } from '../formato';
import { Aviso, Boton, Cabecera, Cifra, Cifras, FalloCarga, Insignia, Tarjeta, Cargando, Vacio } from '../ui/base';
import { Columnas } from '../ui/graficas';
import { Icono } from '../ui/iconos';
import { abrirMisiones, semanasMisiones, type DatosMisiones, type EmpresaMisiones, type ResumenMisiones } from '../misiones';

const ATAJOS: [string, string, string][] = [
  ['/admin/empresas', 'Empresas', 'Asignar actividades, códigos y usuarios de cada empresa.'],
  ['/admin/biblioteca', 'Biblioteca', 'Las actividades disponibles y sus textos.'],
  ['/admin/juegos', 'Juegos en vivo', 'Preguntas, partidas y sus reportes.'],
  ['/admin/ajustes', 'Ajustes', 'Textos legales y auditoría de la plataforma.'],
];

type Empresa = EmpresaMisiones & { organizacion: { id: string; nombre: string } | null };

const caida = (e: ErrorApi) => e.status === 502;

export default function Misiones() {
  const d = useDatos<DatosMisiones>('/admin/api/misiones');
  const titulo = 'Misiones';
  const descripcion = 'Las actividades que juegan los equipos de cada empresa. Se manejan en la plataforma de misiones; aquí va el resumen.';

  if (d.error && caida(d.error))
    return (
      <>
        <Cabecera titulo={titulo} descripcion={descripcion} />
        <Aviso tono="alerta">
          La plataforma de misiones no respondió. <button type="button" class="enlace" onClick={d.recargar}>Intentar de nuevo</button>
        </Aviso>
      </>
    );
  if (d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!d.datos) return <Cargando />;
  if (!d.datos.configurada || !d.datos.resumen)
    return (
      <>
        <Cabecera titulo={titulo} descripcion={descripcion} />
        <Vacio titulo="La plataforma de misiones no está conectada">
          Faltan las variables MISIONES_URL y MISIONES_SECRETO en Vercel, y PANEL_SHARED_SECRET con el mismo valor en el proyecto de misiones.
        </Vacio>
      </>
    );

  const { resumen: r, puedeEntrar } = d.datos;
  return (
    <>
      <Cabecera
        titulo={titulo}
        descripcion={descripcion}
        acciones={
          puedeEntrar && (
            <Boton variante="primario" onClick={() => abrirMisiones()}>
              <Icono nombre="externo" /> Abrir la plataforma
            </Boton>
          )
        }
      />
      <Cifras>
        <Cifra etiqueta="Actividades activas" valor={numero(r.actividades.activas)} nota={`${r.actividades.pausadas} en pausa, ${r.actividades.vencidas} vencidas`} />
        <Cifra etiqueta="Participantes" valor={numero(r.participantes)} nota="en las actividades sin archivar" />
        <Cifra etiqueta="Terminan" valor={r.participantes ? pct(r.completaron, r.participantes) : 'Sin datos'} nota="completaron su actividad" />
        <Cifra etiqueta="Empresas" valor={numero(r.empresas)} nota="con acceso a la plataforma" />
      </Cifras>

      <div class="rejilla-2">
        <EnMarcha r={r} puedeEntrar={!!puedeEntrar} />
        <Tarjeta titulo="Participantes nuevos por semana">
          <Columnas titulo="Participantes" puntos={semanasMisiones(r.semanas)} alto={140} />
        </Tarjeta>
      </div>

      <Empresas puedeEntrar={!!puedeEntrar} />

      {puedeEntrar && (
        <Tarjeta titulo="Ir a una sección de la plataforma" sinRelleno>
          <ul class="lista-filas">
            {ATAJOS.map(([destino, nombre, ayuda]) => (
              <li>
                <button type="button" class="lf-enlace" onClick={() => abrirMisiones(destino)}>
                  <span class="lf-principal">
                    <span class="lf-titulo">{nombre}</span>
                    <span class="lf-sub">{ayuda}</span>
                  </span>
                  <Icono nombre="externo" />
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  );
}

function EnMarcha({ r, puedeEntrar }: { r: ResumenMisiones; puedeEntrar: boolean }) {
  return (
    <Tarjeta titulo="En marcha" sinRelleno>
      {r.enMarcha.length ? (
        <ul class="lista-filas">
          {r.enMarcha.map((a) => {
            const cuerpo = (
              <>
                <span class="lf-principal">
                  <span class="lf-titulo">{a.actividad}</span>
                  <span class="lf-sub">
                    {a.empresa} · código {a.codigo}
                    {a.expira ? ` · vence el ${a.expira}` : ''}
                  </span>
                </span>
                <span class="lf-meta">
                  {cuenta(a.participantes, 'participante', 'participantes')} · {a.avance} %
                </span>
              </>
            );
            return (
              <li>
                {puedeEntrar ? (
                  <button type="button" class="lf-enlace" onClick={() => abrirMisiones(`/admin/empresas/${a.empresaId}`)}>
                    {cuerpo}
                  </button>
                ) : (
                  <div class="lf-enlace">{cuerpo}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Vacio titulo="No hay actividades activas" />
      )}
    </Tarjeta>
  );
}

function Empresas({ puedeEntrar }: { puedeEntrar: boolean }) {
  const d = useDatos<{ empresas: Empresa[] }>('/admin/api/misiones/empresas');
  if (d.error || !d.datos) return null;
  const empresas = d.datos.empresas.filter((e) => !e.archivada);
  return (
    <Tarjeta titulo="Empresas en la plataforma" sinRelleno>
      {empresas.length ? (
        <ul class="lista-filas">
          {empresas.map((e) => (
            <li>
              <div class="lf-enlace">
                <span class="lf-principal">
                  <span class="lf-titulo">{e.nombre}</span>
                  <span class="lf-sub">
                    {cuenta(e.actividades, 'actividad', 'actividades')} · {cuenta(e.participantes, 'participante', 'participantes')}
                  </span>
                </span>
                {e.organizacion ? (
                  <a href={`/admin/organizaciones/${e.organizacion.id}`}>Ver organización</a>
                ) : (
                  <Insignia tono="apagado">Sin organización</Insignia>
                )}
                {puedeEntrar && (
                  <Boton chico variante="fantasma" onClick={() => abrirMisiones(`/admin/empresas/${e.id}`)}>
                    Abrir
                  </Boton>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Vacio titulo="Todavía no hay empresas">Se crean desde la ficha de una organización o en la plataforma.</Vacio>
      )}
    </Tarjeta>
  );
}
