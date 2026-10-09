// Selector de imágenes del contenido: muestra la elegida y abre la biblioteca (subir o elegir).
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, subir, mensajeError, ErrorApi } from '../api';
import { Boton } from './base';
import { avisar } from './dialogos';

export interface Medio {
  id: string;
  nombre: string;
  mime: string;
  bytes: number;
  ancho: number;
  alto: number;
  url: string;
  creado: number;
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function SelectorImagen({ valor, alCambiar, etiqueta, info, deshabilitado }: { valor: string | null; alCambiar: (id: string | null) => void; etiqueta: string; info?: Medio; deshabilitado?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<Medio | undefined>(info);
  useEffect(() => setElegida(info), [info?.id]);
  return (
    <div class="selector-imagen">
      {valor ? (
        <figure class="imagen-elegida">
          <img src={`/v1/medios/${valor}`} alt="" loading="lazy" />
          {elegida && (
            <figcaption>
              {elegida.nombre} · {elegida.ancho} × {elegida.alto} px · {kb(elegida.bytes)}
            </figcaption>
          )}
        </figure>
      ) : (
        <p class="suave texto-chico">Sin imagen.</p>
      )}
      {!deshabilitado && (
        <div class="acciones">
          <Boton chico onClick={() => setAbierto(true)}>
            {valor ? 'Cambiar imagen' : 'Elegir imagen'}
          </Boton>
          {valor && (
            <Boton chico variante="fantasma" onClick={() => alCambiar(null)}>
              Quitar
            </Boton>
          )}
        </div>
      )}
      {abierto && (
        <Biblioteca
          titulo={etiqueta}
          alElegir={(m) => {
            setElegida(m);
            alCambiar(m.id);
            setAbierto(false);
          }}
          alCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  );
}

function Biblioteca({ titulo, alElegir, alCerrar }: { titulo: string; alElegir: (m: Medio) => void; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [medios, setMedios] = useState<Medio[] | null>(null);
  const [configurado, setConfigurado] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
    api<{ medios: Medio[]; configurado: boolean }>('/admin/api/medios')
      .then((d) => {
        setMedios(d.medios);
        setConfigurado(d.configurado);
      })
      .catch(() => setMedios([]));
  }, []);

  const subirArchivo = async (archivo: File) => {
    setSubiendo(true);
    const form = new FormData();
    form.append('archivo', archivo);
    try {
      const { medio } = await subir<{ medio: Medio }>('/admin/api/medios', form);
      alElegir(medio);
    } catch (e) {
      const motivo = e instanceof ErrorApi ? e.datos.error : null;
      avisar(
        motivo === 'formato' ? 'Solo PNG, JPEG o WebP.' : motivo === 'grande' ? 'La imagen pasa de 4 MB.' : motivo === 'sin_bucket' ? 'Falta configurar el almacenamiento de imágenes.' : mensajeError(e),
        'error',
      );
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <dialog ref={ref} class="dialogo biblioteca" aria-labelledby="biblioteca-titulo" onClose={alCerrar}>
      <div class="biblioteca-cabeza">
        <h2 id="biblioteca-titulo">{titulo}</h2>
        <button type="button" class="cerrar" aria-label="Cerrar" onClick={() => ref.current?.close()}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      {!configurado && <p class="aviso aviso-alerta">Falta configurar el almacenamiento de imágenes (bucket R2 MEDIOS).</p>}
      <label class="subir">
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={subiendo || !configurado} onChange={(e) => (e.target as HTMLInputElement).files?.[0] && subirArchivo((e.target as HTMLInputElement).files![0]!)} />
        <span>{subiendo ? 'Subiendo' : 'Subir una imagen nueva'}</span>
        <span class="suave texto-chico">PNG, JPEG o WebP, hasta 4 MB. Mejor de 1600 px de ancho o más.</span>
      </label>
      {medios === null ? (
        <p class="suave">Cargando</p>
      ) : medios.length ? (
        <ul class="rejilla-medios">
          {medios.map((m) => (
            <li>
              <button type="button" class="medio" onClick={() => alElegir(m)} aria-label={`Elegir ${m.nombre}`}>
                <img src={m.url} alt="" loading="lazy" />
                <span>{m.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="suave">Todavía no hay imágenes subidas.</p>
      )}
    </dialog>
  );
}
