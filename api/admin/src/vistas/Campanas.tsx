// Campañas de novedades, correos automáticos y plantillas.
import { mensajeError, api, useDatos } from '../api';
import { usePuede } from '../sesion';
import { ESTADOS_CAMPANA, IDIOMAS, SERVICIOS } from '../textos';
import { fecha, pct } from '../formato';
import type { Automatico, Campana, Plantilla } from '../tipos';
import { Boton, BotonEnlace, Cabecera, FalloCarga, Insignia, Tarjeta, Vacio, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';
import { Icono } from '../ui/iconos';

export const TONO_CAMPANA: Record<string, string> = { borrador: 'apagado', programada: 'info', enviando: 'alerta', enviada: 'exito', cancelada: 'apagado' };
const NOMBRES_AUTOMATICOS: Record<string, string> = { bienvenida: 'Bienvenida' };
export const nombreAutomatico = (a: { clave: string; locale: 'es' | 'en' }) => `${NOMBRES_AUTOMATICOS[a.clave.split(':')[0]!] ?? a.clave} en ${IDIOMAS[a.locale].toLowerCase()}`;

export default function Campanas() {
  const puede = usePuede();
  const campanas = useDatos<{ campanas: Campana[] }>('/admin/api/campanas');
  const automaticos = useDatos<{ automaticos: Automatico[] }>('/admin/api/automaticos');
  const plantillas = useDatos<{ plantillas: Plantilla[] }>('/admin/api/plantillas');

  const borrarPlantilla = async (p: Plantilla) => {
    if (!(await confirmar({ titulo: 'Borrar plantilla', texto: `Se borra la plantilla "${p.nombre}". Las campañas creadas con ella no cambian.`, confirmar: 'Borrar', peligro: true }))) return;
    try {
      await api(`/admin/api/plantillas/${p.id}`, { method: 'DELETE' });
      plantillas.recargar();
      avisar('Plantilla borrada', 'exito');
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  };

  return (
    <>
      <Cabecera
        titulo="Campañas"
        descripcion="Correos a la lista de novedades. Salen por lotes y solo a contactos activos que confirmaron."
        acciones={
          puede('marketing.editar') && (
            <BotonEnlace variante="primario" href="/admin/campanas/nueva">
              <Icono nombre="mas" /> Nueva campaña
            </BotonEnlace>
          )
        }
      />
      <div class="tarjeta sin-relleno">
        {campanas.error ? (
          <FalloCarga error={campanas.error} reintentar={campanas.recargar} />
        ) : !campanas.datos ? (
          <Cargando />
        ) : !campanas.datos.campanas.length ? (
          <Vacio titulo="Todavía no hay campañas">Escribe la primera con "Nueva campaña". Puedes probarla en tu correo antes de enviarla.</Vacio>
        ) : (
          <div class="tabla-envoltura">
            <table class="tabla tabla-filas">
              <thead>
                <tr>
                  <th scope="col">Asunto</th>
                  <th scope="col">Estado</th>
                  <th scope="col" class="num">
                    Enviados
                  </th>
                  <th scope="col" class="num">
                    Abren
                  </th>
                  <th scope="col" class="num">
                    Clics
                  </th>
                  <th scope="col" class="num">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {campanas.datos.campanas.map((c) => {
                  const st = c.stats;
                  return (
                    <tr>
                      <td>
                        <a class="fila-enlace" href={`/admin/campanas/${c.id}`}>
                          {c.asunto}
                        </a>
                        <span class="fila-sub">
                          {IDIOMAS[c.locale]}
                          {c.intereses.length ? ` · ${c.intereses.map((i) => SERVICIOS[i]).join(', ')}` : ' · Para todos'}
                          {c.asuntoB ? ' · Prueba A/B' : ''}
                        </span>
                      </td>
                      <td>
                        <Insignia tono={TONO_CAMPANA[c.estado]!}>{ESTADOS_CAMPANA[c.estado]}</Insignia>
                      </td>
                      <td class="num">{st?.destinatarios ? `${st.enviados} de ${st.destinatarios}` : ''}</td>
                      <td class="num">{st?.enviados ? pct(st.abiertos, st.enviados) : ''}</td>
                      <td class="num">{st?.enviados ? pct(st.clics, st.enviados) : ''}</td>
                      <td class="num suave">{fecha(c.iniciada || c.programada || c.creada, c.estado === 'programada')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div class="rejilla-2">
        <Tarjeta titulo="Correos automáticos">
          <p class="suave texto-chico">Salen solos. La bienvenida llega cuando alguien confirma su suscripción; si hay un regalo (una guía, por ejemplo), su enlace va ahí.</p>
          {automaticos.datos ? (
            <ul class="lista-simple">
              {automaticos.datos.automaticos.map((a) => (
                <li>
                  <a href={`/admin/automaticos/${encodeURIComponent(a.clave)}`}>{nombreAutomatico(a)}</a>
                  <span class="suave texto-chico">{a.personalizado ? 'Editado' : 'Texto por defecto'}</span>
                  <Insignia tono={a.activo ? 'exito' : 'apagado'}>{a.activo ? 'Activo' : 'Apagado'}</Insignia>
                </li>
              ))}
            </ul>
          ) : (
            <Cargando />
          )}
        </Tarjeta>
        <Tarjeta titulo="Plantillas">
          <p class="suave texto-chico">Se guardan desde el editor de una campaña con "Guardar como plantilla" y se usan al empezar una nueva.</p>
          {plantillas.datos ? (
            plantillas.datos.plantillas.length ? (
              <ul class="lista-simple">
                {plantillas.datos.plantillas.map((p) => (
                  <li>
                    <span>
                      <strong>{p.nombre}</strong>
                      <span class="suave texto-chico">
                        {' '}
                        · {IDIOMAS[p.locale]} · {p.asunto}
                      </span>
                    </span>
                    {puede('marketing.editar') && (
                      <Boton variante="fantasma" chico onClick={() => borrarPlantilla(p)}>
                        Borrar
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p class="suave">Todavía no hay plantillas.</p>
            )
          ) : (
            <Cargando />
          )}
        </Tarjeta>
      </div>
    </>
  );
}
