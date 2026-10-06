// Contenido del sitio: blog, casos, vacantes, preguntas y clientes. Cada entrada se publica por
// separado y después se publica el sitio (se vuelve a construir) para que los cambios salgan.
import { useState } from 'preact/hooks';
import { ESQUEMAS, TIPOS_CONTENIDO, type TipoContenido } from '@api/contenido/esquemas';
import { api, mensajeError, useDatos, ErrorApi } from '../api';
import { navegar, useUbicacion } from '../ruteo';
import { usePuede } from '../sesion';
import { fechaLarga, hace } from '../formato';
import { Aviso, Boton, BotonEnlace, Cabecera, FalloCarga, Insignia, Pestanas, Tarjeta, Vacio, Cargando } from '../ui/base';
import { avisar, confirmar } from '../ui/dialogos';
import { Icono } from '../ui/iconos';

export type EstadoContenido = 'borrador' | 'publicado' | 'cambios' | 'archivado';
export const ESTADO: Record<EstadoContenido, { texto: string; tono: string }> = {
  borrador: { texto: 'Borrador', tono: 'apagado' },
  publicado: { texto: 'Publicado', tono: 'exito' },
  cambios: { texto: 'Cambios sin publicar', tono: 'alerta' },
  archivado: { texto: 'Archivado', tono: 'apagado' },
};

interface Resumen {
  id: string;
  tipo: TipoContenido;
  clave: string;
  titulo: string;
  estado: EstadoContenido;
  version: number;
  publicadaEn: number | null;
  actualizado: number;
  autor: string;
}

export default function Contenido() {
  const { query } = useUbicacion();
  const puede = usePuede();
  const tipo = (TIPOS_CONTENIDO.includes(query.get('tipo') as TipoContenido) ? query.get('tipo') : 'blog') as TipoContenido;
  const [verArchivadas, setVerArchivadas] = useState(false);
  const d = useDatos<{ entradas: Resumen[]; conteos: Record<TipoContenido, number> }>(`/admin/api/contenido?tipo=${tipo}`);
  const e = ESQUEMAS[tipo];
  const entradas = d.datos?.entradas.filter((x) => verArchivadas || x.estado !== 'archivado') ?? [];
  const archivadas = d.datos?.entradas.filter((x) => x.estado === 'archivado').length ?? 0;

  return (
    <>
      <Cabecera
        titulo="Contenido del sitio"
        descripcion="Lo que publica el sitio además de los servicios. Publica cada entrada y después publica el sitio para que salga."
        acciones={
          puede('contenido.editar') && (
            <BotonEnlace variante="primario" href={`/admin/contenido/nuevo?tipo=${tipo}`}>
              <Icono nombre="mas" /> Nuevo: {e.nombre.toLowerCase()}
            </BotonEnlace>
          )
        }
      />
      <PublicarSitio />
      <Pestanas
        etiqueta="Tipo de contenido"
        valor={tipo}
        alCambiar={(t) => navegar(`/admin/contenido?tipo=${t}`, { reemplazar: true })}
        opciones={TIPOS_CONTENIDO.map((t) => ({ valor: t, texto: ESQUEMAS[t].plural, n: d.datos?.conteos[t] }))}
      />
      <p class="suave texto-chico bloque-nota">{e.descripcion}</p>
      <div class="tarjeta sin-relleno">
        {d.error ? (
          <FalloCarga error={d.error} reintentar={d.recargar} />
        ) : !d.datos ? (
          <Cargando />
        ) : !entradas.length ? (
          <Vacio titulo={`Todavía no hay ${e.plural.toLowerCase()} en el panel`}>
            {tipo === 'faq' || tipo === 'cliente'
              ? 'El sitio sigue mostrando los que están en el código. Lo que publiques aquí se suma, y si usas la misma clave, reemplaza al del código.'
              : 'Crea el primero con el botón de arriba.'}
          </Vacio>
        ) : (
          <div class={`tabla-envoltura${d.cargando ? ' recargando' : ''}`}>
            <table class="tabla tabla-filas">
              <thead>
                <tr>
                  <th scope="col">{e.nombre}</th>
                  <th scope="col">Estado</th>
                  <th scope="col" class="num ocultar-movil">
                    Editado
                  </th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((x) => (
                  <tr class={x.estado === 'archivado' ? 'inactiva' : ''}>
                    <td>
                      <a class="fila-enlace" href={`/admin/contenido/${x.id}`}>
                        {x.titulo}
                      </a>
                      <span class="fila-sub">Clave: {x.clave}</span>
                    </td>
                    <td>
                      <Insignia tono={ESTADO[x.estado].tono}>{ESTADO[x.estado].texto}</Insignia>
                    </td>
                    <td class="num suave ocultar-movil" title={fechaLarga(x.actualizado)}>
                      {hace(x.actualizado)}
                      <span class="fila-sub">{x.autor}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {archivadas > 0 && (
        <Boton variante="fantasma" chico onClick={() => setVerArchivadas(!verArchivadas)}>
          {verArchivadas ? 'Ocultar archivadas' : `Ver archivadas (${archivadas})`}
        </Boton>
      )}
    </>
  );
}

interface Pedido {
  id: string;
  solicitada: number;
  autor: string;
  destino: 'vista_previa' | 'produccion';
  estado: 'pendiente' | 'disparada' | 'fallida' | 'sin_configurar';
  runUrl: string | null;
  error: string | null;
}

const DESTINO = { vista_previa: 'vista previa', produccion: 'producción' } as const;
const ESTADO_PEDIDO: Record<Pedido['estado'], { texto: string; tono: string }> = {
  pendiente: { texto: 'En cola', tono: 'info' },
  disparada: { texto: 'Construyendo', tono: 'exito' },
  fallida: { texto: 'Falló', tono: 'peligro' },
  sin_configurar: { texto: 'Sin configurar', tono: 'alerta' },
};

/** Tarjeta para volver a construir el sitio con lo publicado. */
export function PublicarSitio() {
  const puede = usePuede();
  const d = useDatos<{ publicaciones: Pedido[]; configurada: boolean; sinPublicar: number }>('/admin/api/publicaciones');
  const [ocupado, setOcupado] = useState(false);
  if (!d.datos) return null;
  const ultima = d.datos.publicaciones[0];

  const publicar = async (destino: Pedido['destino']) => {
    if (
      destino === 'produccion' &&
      !(await confirmar({ titulo: 'Publicar en producción', texto: 'El sitio público (antidotocolombia.com) se vuelve a construir con todo lo publicado en el panel. Tarda unos minutos.', confirmar: 'Publicar en producción' }))
    )
      return;
    setOcupado(true);
    try {
      const r = await api<{ publicacion: Pedido; agrupada: boolean }>('/admin/api/publicar', { body: { destino } });
      avisar(r.agrupada ? 'Ya había una publicación en curso: los cambios entran en esa.' : `Publicando en ${DESTINO[destino]}. Tarda unos minutos.`, 'exito');
    } catch (e) {
      avisar(e instanceof ErrorApi && e.status === 503 ? 'Falta configurar la publicación (GITHUB_DISPATCH_TOKEN).' : mensajeError(e), 'error');
    } finally {
      setOcupado(false);
      d.recargar();
    }
  };

  return (
    <Tarjeta class="publicar-sitio">
      <div class="publicar-fila">
        <div class="publicar-texto">
          <h2>Publicar el sitio</h2>
          <p class="suave texto-chico">
            {d.datos.sinPublicar
              ? `${d.datos.sinPublicar} ${d.datos.sinPublicar === 1 ? 'cambio publicado todavía no está' : 'cambios publicados todavía no están'} en el sitio.`
              : 'El sitio está al día con lo publicado.'}
            {ultima && (
              <>
                {' '}
                Última: {DESTINO[ultima.destino]}, {hace(ultima.solicitada)} por {ultima.autor}.{' '}
                <Insignia tono={ESTADO_PEDIDO[ultima.estado].tono}>{ESTADO_PEDIDO[ultima.estado].texto}</Insignia>{' '}
                {ultima.runUrl && (
                  <a href={ultima.runUrl} target="_blank" rel="noopener">
                    Ver el progreso
                  </a>
                )}
              </>
            )}
          </p>
        </div>
        {puede('contenido.publicar') && (
          <div class="acciones">
            <Boton variante={d.datos.sinPublicar ? 'primario' : 'secundario'} disabled={ocupado || !d.datos.configurada} onClick={() => publicar('vista_previa')}>
              <Icono nombre="publicar" /> Publicar en la vista previa
            </Boton>
            {puede('config.editar') && (
              <Boton disabled={ocupado || !d.datos.configurada} onClick={() => publicar('produccion')}>
                Publicar en producción
              </Boton>
            )}
          </div>
        )}
      </div>
      {!d.datos.configurada && <Aviso tono="alerta">La publicación desde el panel no está configurada: falta el secret GITHUB_DISPATCH_TOKEN del Worker. Mientras tanto, el sitio se publica desde GitHub Actions.</Aviso>}
      {ultima?.estado === 'fallida' && ultima.error && <Aviso tono="error">La última publicación falló: {ultima.error}</Aviso>}
    </Tarjeta>
  );
}
