// Contenido de las colecciones además de los servicios: ofertas de cada línea, casos del
// portafolio y artículos del blog. Como obtenerServicios(), cada función guarda su promesa y
// en `npm run dev` incluye los borradores.
import { getCollection, type CollectionEntry } from 'astro:content';
import { obtenerServicios } from './servicios';
import { emparejarOfertas, type Oferta } from '../lib/ofertas';
import { emparejarPublicaciones, type Publicacion } from '../lib/publicaciones';

export { ofertaPath, type Oferta } from '../lib/ofertas';
export { casoPath, articuloPath, casosBase, blogBase } from '../lib/publicaciones';

const borradores = import.meta.env.DEV;

let ofertas: Promise<Oferta[]> | undefined;

/** Ofertas publicables, en el orden de su línea. Con `linea`, solo las de esa línea. */
export async function obtenerOfertas(linea?: string): Promise<Oferta[]> {
  ofertas ??= Promise.all([getCollection('ofertas'), getCollection('servicios'), obtenerServicios()]).then(([entradas, todas, servicios]) =>
    emparejarOfertas(
      entradas.map((e) => ({ ...e.data, entrada: e.id })),
      { borradores, servicios, lineasConocidas: [...new Set(todas.map((s) => s.data.clave))] },
    ),
  );
  const lista = await ofertas;
  return linea ? lista.filter((o) => o.linea === linea) : lista;
}

type DatosCaso = CollectionEntry<'casos'>['data'] & { entrada?: string };
type DatosArticulo = CollectionEntry<'blog'>['data'] & { entrada?: string };
export type Caso = Publicacion<DatosCaso>;
export type Articulo = Publicacion<DatosArticulo>;

let casos: Promise<Caso[]> | undefined;
let articulos: Promise<Articulo[]> | undefined;

/** Casos publicables (validados por el cliente), del más reciente al más antiguo. */
export function obtenerCasos(): Promise<Caso[]> {
  casos ??= Promise.all([getCollection('casos'), obtenerServicios()]).then(([entradas, servicios]) =>
    emparejarPublicaciones(
      entradas.map((e) => ({ ...e.data, imagen: e.data.imagen, entrada: e.id })),
      { borradores, nombre: (c) => `El caso "${c}"` },
    ).filter((c) => servicios.some((s) => s.id === c.es.linea)),
  );
  return casos;
}

/** Artículos publicables, del más reciente al más antiguo. */
export function obtenerArticulos(): Promise<Articulo[]> {
  articulos ??= getCollection('blog').then((entradas) =>
    emparejarPublicaciones(
      entradas.map((e) => ({ ...e.data, entrada: e.id })),
      { borradores, nombre: (c) => `El artículo "${c}"` },
    ),
  );
  return articulos;
}
