// Ajustes editables del sitio y la API. Solo config.editar guarda; los demás roles los ven.
import { useState } from 'preact/hooks';
import { api, mensajeError, useDatos } from '../api';
import { usePuede } from '../sesion';
import { Aviso, Boton, Cabecera, Campo, Casilla, FalloCarga, Tarjeta, Cargando } from '../ui/base';
import { avisar } from '../ui/dialogos';

type Ajustes = Record<string, unknown>;

export default function Ajustes() {
  const puede = usePuede();
  const editable = puede('config.editar');
  const d = useDatos<{ ajustes: Ajustes }>('/admin/api/configuracion');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (cambios: Ajustes) => {
    setGuardando(true);
    try {
      d.poner(await api<{ ajustes: Ajustes }>('/admin/api/configuracion', { method: 'PUT', body: cambios }));
      avisar('Ajustes guardados', 'exito');
    } catch (e) {
      avisar(mensajeError(e, 'Revisa los valores.'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (d.error) return <FalloCarga error={d.error} reintentar={d.recargar} />;
  if (!d.datos) return <Cargando />;
  const a = d.datos.ajustes;
  const tope = a['asesor.tope_diario_usd'];

  return (
    <>
      <Cabecera titulo="Ajustes" descripcion="Cambios que se aplican al instante, sin desplegar de nuevo." />
      {!editable && <Aviso>Solo una persona con rol Admin puede cambiar estos ajustes.</Aviso>}
      <div class="rejilla-2">
        <Tarjeta titulo="Chat con IA del sitio">
          <form
            class="formulario"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.target as HTMLFormElement);
              const valor = String(f.get('tope') ?? '').replace(',', '.').trim();
              guardar({ 'asesor.activo': f.get('activo') === 'on', 'asesor.tope_diario_usd': valor === '' ? null : Number(valor) });
            }}
          >
            <fieldset disabled={!editable || guardando}>
              <Casilla name="activo" defaultChecked={a['asesor.activo'] !== false}>
                Chat con IA encendido
              </Casilla>
              <p class="suave texto-chico">Apagado, la burbuja del sitio ofrece solo WhatsApp. Sirve si algo sale mal y hay que cortarlo ya.</p>
              <Campo etiqueta="Tope de gasto diario (USD)" ayuda={tope === null ? 'Vacío usa el valor de la configuración del Worker (ASESOR_TOPE_DIARIO_USD).' : 'Entre 0 y 20. Al llegar al tope, el chat se apaga hasta medianoche (hora de Colombia).'}>
                <input name="tope" inputMode="decimal" defaultValue={typeof tope === 'number' ? String(tope) : ''} placeholder="Por defecto" />
              </Campo>
              {editable && (
                <Boton type="submit" variante="primario">
                  Guardar
                </Boton>
              )}
            </fieldset>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
