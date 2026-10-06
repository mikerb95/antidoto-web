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
        <AjustesSitio a={a} editable={editable} guardando={guardando} guardar={guardar} />
      </div>
    </>
  );
}

/** Regalo de bienvenida y video del hero: los lee el build, así que cambian al publicar el sitio. */
function AjustesSitio({ a, editable, guardando, guardar }: { a: Ajustes; editable: boolean; guardando: boolean; guardar: (c: Ajustes) => Promise<void> }) {
  const regalo = (a['sitio.regalo_novedades'] ?? null) as { es: string; en: string } | null;
  const video = (a['sitio.video_hero'] ?? null) as { mp4: string; webm?: string } | null;
  return (
    <Tarjeta titulo="Sitio">
      <form
        class="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.target as HTMLFormElement);
          const v = (k: string) => String(f.get(k) ?? '').trim();
          guardar({
            'sitio.regalo_novedades': v('regalo_es') || v('regalo_en') ? { es: v('regalo_es'), en: v('regalo_en') } : null,
            'sitio.video_hero': v('video_mp4') ? { mp4: v('video_mp4'), ...(v('video_webm') ? { webm: v('video_webm') } : {}) } : null,
          });
        }}
      >
        <fieldset disabled={!editable || guardando}>
          <p class="suave texto-chico">Se aplican al publicar el sitio. Vacío usa lo que está en el código.</p>
          <Campo etiqueta="Regalo por suscribirse (español)" ayuda="El nombre que promete la sección de novedades, por ejemplo una guía. Hace falta en los dos idiomas. El enlace va en el correo de bienvenida (Campañas, Correos automáticos).">
            <input name="regalo_es" maxLength={120} defaultValue={regalo?.es ?? ''} />
          </Campo>
          <Campo etiqueta="Regalo por suscribirse (inglés)">
            <input name="regalo_en" maxLength={120} defaultValue={regalo?.en ?? ''} />
          </Campo>
          <Campo etiqueta="Video del hero (MP4)" ayuda="Ruta del sitio (/video/hero.mp4) o enlace https. 720p, alrededor de 1 MB, horizontal.">
            <input name="video_mp4" defaultValue={video?.mp4 ?? ''} placeholder="/video/hero.mp4" />
          </Campo>
          <Campo etiqueta="Video del hero (WebM, opcional)">
            <input name="video_webm" defaultValue={video?.webm ?? ''} placeholder="/video/hero.webm" />
          </Campo>
          {editable && (
            <Boton type="submit" variante="primario">
              Guardar
            </Boton>
          )}
        </fieldset>
      </form>
    </Tarjeta>
  );
}
