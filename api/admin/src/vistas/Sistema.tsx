// Estado del sistema: qué servicios están configurados, cuándo corrieron los crons, el último
// despliegue pedido desde el panel, el gasto del chat y el tamaño de cada tabla.
import { useDatos } from '../api';
import { fechaLarga, hace, numero, usd } from '../formato';
import { Cabecera, FalloCarga, Insignia, Tarjeta, Cargando } from '../ui/base';
import { TablaDatos, Medidor } from '../ui/graficas';

interface Estado {
  servicios: Record<string, boolean>;
  entorno: string;
  crones: Record<string, { t: number; resumen: Record<string, number>; error?: string }>;
  ultimaPublicacion: { solicitada: number; destino: string; estado: string; autor: string; runUrl: string | null; error: string | null } | null;
  asesor: { tope: number; activo: boolean; gastoHoy: number } | null;
  tablas: Record<string, number>;
}

const SERVICIOS: [string, string, string][] = [
  ['correo', 'Correo (Resend)', 'RESEND_API_KEY: sin ella no salen avisos, enlaces de acceso ni campañas.'],
  ['webhookCorreo', 'Eventos de correo', 'RESEND_WEBHOOK_SECRET: entregas, aperturas, rebotes y quejas.'],
  ['chatIa', 'Chat con IA', 'ANTHROPIC_API_KEY: sin ella el sitio ofrece solo WhatsApp.'],
  ['imagenes', 'Imágenes del contenido', 'Bucket R2 MEDIOS.'],
  ['archivos', 'Archivos de proyectos', 'Bucket R2 ARCHIVOS (privado).'],
  ['publicacion', 'Publicar desde el panel', 'GITHUB_DISPATCH_TOKEN y GITHUB_REPO.'],
  ['salIp', 'Sal del hash de IP', 'SAL_IP: sin ella el hash es menos privado.'],
];
const CRONES: Record<string, [string, number]> = { cinco: ['Envíos y publicaciones (cada 5 minutos)', 5 * 60_000], hora: ['Seguimiento, recordatorios y limpieza (cada hora)', 60 * 60_000] };
const TABLAS: Record<string, string> = {
  leads: 'Solicitudes',
  contactos: 'Contactos de novedades',
  campanas: 'Campañas',
  envios: 'Envíos de campañas',
  conversaciones: 'Conversaciones del chat',
  conversacion_mensajes: 'Mensajes del chat',
  contenido: 'Entradas de contenido',
  medios: 'Imágenes',
  organizaciones: 'Organizaciones',
  proyectos: 'Proyectos',
  entregable_archivos: 'Archivos de entregables',
  usuarios: 'Personas del equipo',
  usuarios_cliente: 'Accesos al portal',
  auditoria: 'Registros de auditoría',
};

export default function Sistema() {
  const d = useDatos<Estado>('/admin/api/sistema');
  if (d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!d.datos) return <Cargando />;
  const s = d.datos;
  return (
    <>
      <Cabecera titulo="Sistema" descripcion={`Cómo está la API ahora mismo. Entorno: ${s.entorno}.`} />
      <div class="rejilla-2">
        <Tarjeta titulo="Servicios">
          <ul class="lista-simple">
            {SERVICIOS.map(([k, nombre, ayuda]) => (
              <li>
                <span>
                  <strong>{nombre}</strong>
                  <span class="fila-sub">{ayuda}</span>
                </span>
                <Insignia tono={s.servicios[k] ? 'exito' : 'alerta'}>{s.servicios[k] ? 'Configurado' : 'Falta'}</Insignia>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <div class="columna-lateral">
          <Tarjeta titulo="Tareas programadas">
            <ul class="lista-simple">
              {Object.entries(CRONES).map(([k, [nombre, cada]]) => {
                const c = s.crones[k];
                const atrasado = !c || Date.now() - c.t > cada * 3;
                return (
                  <li>
                    <span>
                      <strong>{nombre}</strong>
                      <span class="fila-sub">
                        {c ? `Última corrida ${hace(c.t)}: ${Object.entries(c.resumen).map(([x, n]) => `${x} ${n}`).join(', ')}` : 'Todavía no ha corrido.'}
                        {c?.error ? ` Error: ${c.error}` : ''}
                      </span>
                    </span>
                    <Insignia tono={atrasado ? 'alerta' : 'exito'}>{atrasado ? 'Revisar' : 'Al día'}</Insignia>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
          <Tarjeta titulo="Última publicación del sitio">
            {s.ultimaPublicacion ? (
              <p class="suave texto-chico">
                {s.ultimaPublicacion.destino === 'produccion' ? 'Producción' : 'Vista previa'}, {fechaLarga(s.ultimaPublicacion.solicitada)} por {s.ultimaPublicacion.autor}. Estado: {s.ultimaPublicacion.estado}.
                {s.ultimaPublicacion.error ? ` ${s.ultimaPublicacion.error}` : ''}{' '}
                {s.ultimaPublicacion.runUrl && (
                  <a href={s.ultimaPublicacion.runUrl} target="_blank" rel="noopener">
                    Ver en GitHub
                  </a>
                )}
              </p>
            ) : (
              <p class="suave texto-chico">Todavía no se ha publicado desde el panel.</p>
            )}
          </Tarjeta>
          {s.asesor && (
            <Tarjeta titulo="Chat con IA hoy">
              <p class="gasto">
                <strong>{usd(s.asesor.gastoHoy)}</strong> <span class="suave">de {usd(s.asesor.tope)}</span>
              </p>
              <Medidor valor={s.asesor.gastoHoy} max={s.asesor.tope} etiqueta="Gasto de hoy frente al tope" />
              {!s.asesor.activo && <p class="suave texto-chico">Apagado desde Ajustes.</p>}
            </Tarjeta>
          )}
        </div>
      </div>
      <Tarjeta titulo="Datos guardados">
        <TablaDatos cabeza={['Tabla', 'Filas']} filas={Object.entries(s.tablas).map(([k, n]) => [TABLAS[k] ?? k, numero(n)])} />
      </Tarjeta>
    </>
  );
}
