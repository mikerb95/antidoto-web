// Estado del sistema: qué servicios están configurados, la última revisión de pendientes, el último
// despliegue pedido desde el panel, el gasto del chat y el tamaño de cada tabla.
import { useDatos } from '../api';
import { fechaLarga, hace, numero, usd } from '../formato';
import { Cabecera, FalloCarga, Insignia, Tarjeta, Cargando } from '../ui/base';
import { TablaDatos, Medidor } from '../ui/graficas';

interface Estado {
  servicios: Record<string, boolean>;
  entorno: string;
  revision: { t: number; resumen: Record<string, number> } | null;
  ultimaPublicacion: { solicitada: number; destino: string; estado: string; autor: string; runUrl: string | null; error: string | null } | null;
  asesor: { tope: number; activo: boolean; gastoHoy: number } | null;
  tablas: Record<string, number>;
}

const SERVICIOS: [string, string, string][] = [
  ['correo', 'Correo (Resend)', 'RESEND_API_KEY: sin ella no salen avisos, enlaces de acceso ni campañas.'],
  ['webhookCorreo', 'Eventos de correo', 'RESEND_WEBHOOK_SECRET: entregas, aperturas, rebotes y quejas.'],
  ['chatIa', 'Chat con IA', 'ANTHROPIC_API_KEY: sin ella el sitio ofrece solo WhatsApp.'],
  ['imagenes', 'Imágenes del contenido', 'Vercel Blob, medios/.'],
  ['archivos', 'Archivos de proyectos', 'Vercel Blob, archivos/ (privado).'],
  ['publicacion', 'Publicar desde el panel', 'GITHUB_DISPATCH_TOKEN y GITHUB_REPO.'],
  ['misiones', 'Plataforma de misiones', 'MISIONES_URL y MISIONES_SECRETO: resumen de actividades y entrada sin otra contraseña.'],
  ['salIp', 'Sal del hash de IP', 'SAL_IP: sin ella el hash es menos privado.'],
];
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
          <Tarjeta titulo="Pendientes">
            <p class="suave texto-chico">
              No hay tareas programadas. Cuando alguien usa el panel, como mucho cada 5 minutos, salen las campañas programadas y los lotes que falten, las invitaciones, los avisos de
              solicitudes sin respuesta y los recordatorios, y se borran las conversaciones vencidas.
            </p>
            <p class="suave texto-chico">
              {s.revision
                ? `Última revisión ${hace(s.revision.t)}: ${Object.entries(s.revision.resumen)
                    .filter(([, n]) => n)
                    .map(([x, n]) => `${x} ${n}`)
                    .join(', ') || 'nada pendiente'}.`
                : 'Todavía no se ha revisado.'}
            </p>
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
