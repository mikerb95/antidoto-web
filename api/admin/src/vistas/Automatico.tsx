// Editor de un correo automático (la bienvenida, por idioma).
import { useState } from 'preact/hooks';
import { api, mensajeError, useDatos } from '../api';
import { usePuede } from '../sesion';
import { AYUDA_FORMATO } from '../textos';
import type { Automatico as TAutomatico } from '../tipos';
import { Boton, Cabecera, Campo, Casilla, FalloCarga, Tarjeta, Cargando, Vacio } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';
import { nombreAutomatico } from './Campanas';

export default function Automatico({ params }: { params: string[] }) {
  const clave = decodeURIComponent(params[0]!);
  const puede = usePuede();
  const d = useDatos<{ automaticos: TAutomatico[] }>('/admin/api/automaticos');
  const [version, setVersion] = useState(Date.now());
  const ruta = `/admin/api/automaticos/${encodeURIComponent(clave)}`;
  const volver = { href: '/admin/campanas', texto: 'Campañas' };
  if (d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!d.datos) return <Cargando />;
  const a = d.datos.automaticos.find((x) => x.clave === clave);
  if (!a) return <Vacio titulo="Ese correo automático no existe" accion={<a href="/admin/campanas">Volver a campañas</a>} />;
  const editable = puede('marketing.editar');

  const guardar = async (e: Event) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    try {
      await api(ruta, { method: 'PUT', body: { asunto: f.get('asunto'), preheader: f.get('preheader'), cuerpo: f.get('cuerpo'), activo: f.get('activo') === 'on' } });
      avisar('Guardado', 'exito');
      d.recargar();
      setVersion(Date.now());
    } catch (err) {
      avisar(mensajeError(err, 'Revisa el asunto y el mensaje.'), 'error');
    }
  };

  return (
    <>
      <Cabecera titulo={nombreAutomatico(a)} volver={volver} descripcion="Llega a cada persona cuando confirma su suscripción a las novedades." />
      <div class="editor-campana">
        <form class="tarjeta formulario" onSubmit={guardar} key={version}>
          <fieldset disabled={!editable}>
            <Campo etiqueta="Asunto">
              <input name="asunto" required maxLength={150} defaultValue={a.asunto} />
            </Campo>
            <Campo etiqueta="Texto de vista previa" ayuda="Opcional.">
              <input name="preheader" maxLength={200} defaultValue={a.preheader ?? ''} />
            </Campo>
            <Campo etiqueta="Mensaje">
              <textarea name="cuerpo" rows={16} required class="mono-texto" defaultValue={a.cuerpo} />
            </Campo>
            <Casilla name="activo" defaultChecked={a.activo}>
              Enviar este correo a quien confirme
            </Casilla>
            <details class="ayuda">
              <summary>Cómo dar formato</summary>
              <ul>
                {[...AYUDA_FORMATO, '{{sitio}} es la dirección del sitio (para enlaces)'].map((x) => (
                  <li>
                    <code>{x}</code>
                  </li>
                ))}
              </ul>
            </details>
            {editable && (
              <div class="acciones">
                <Boton type="submit" variante="primario">
                  Guardar
                </Boton>
              </div>
            )}
          </fieldset>
        </form>
        <div class="editor-lateral">
          <Tarjeta titulo="Prueba">
            <div class="acciones">
              {editable && (
                <Boton
                  onClick={async () => {
                    try {
                      avisar(`Prueba enviada a ${(await api<{ para: string }>(`${ruta}/prueba`, { method: 'POST' })).para}`, 'exito');
                    } catch {
                      avisar('No se pudo enviar la prueba. ¿Está configurado Resend?', 'error');
                    }
                  }}
                >
                  Enviarme una prueba
                </Boton>
              )}
              {a.personalizado && editable ? (
                <Boton
                  variante="peligro"
                  chico
                  onClick={async () => {
                    if (!(await confirmar({ titulo: 'Volver al texto por defecto', texto: 'Se pierde el texto editado.', confirmar: 'Restaurar', peligro: true }))) return;
                    await api(ruta, { method: 'DELETE' });
                    d.recargar();
                    setVersion(Date.now());
                  }}
                >
                  Volver al texto por defecto
                </Boton>
              ) : (
                <p class="suave texto-chico">{a.personalizado ? 'Texto editado.' : 'Es el texto por defecto. Al guardar queda el tuyo.'}</p>
              )}
            </div>
          </Tarjeta>
          <div class="vista-previa-marco">
            <iframe class="vista-previa" title="Vista previa del correo" src={`${ruta}/vista?v=${version}`} />
          </div>
        </div>
      </div>
    </>
  );
}
