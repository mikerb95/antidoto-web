// Los servicios salen de la colección src/content/servicios (un Markdown por servicio y por
// idioma). Todo el sitio los lee con obtenerServicios(): así un borrador desaparece a la vez de
// rutas, enlaces, cotizador, sitemap y JSON-LD. Textos tomados del sitio actual y del brief del
// cliente; no agregar cifras ni claims sin validar.
import { getCollection } from 'astro:content';
import { emparejar, type Servicio } from '../lib/servicios';

export { servicioPath, serviciosBase, type Servicio, type ServicioTexto } from '../lib/servicios';

let servicios: Promise<Servicio[]> | undefined;

/** Servicios publicables en orden. En `npm run dev` incluye los borradores. */
export function obtenerServicios(): Promise<Servicio[]> {
  servicios ??= getCollection('servicios').then((entradas) =>
    emparejar(entradas.map((e) => e.data), { borradores: import.meta.env.DEV }),
  );
  return servicios;
}
