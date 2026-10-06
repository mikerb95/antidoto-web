// Resumen del sitio para asistentes de IA (llmstxt.org). Se genera en el build con los servicios
// y ofertas publicables (así un borrador tampoco aparece aquí) y las preguntas frecuentes respondidas.
import type { APIRoute } from 'astro';
import { obtenerServicios } from '../data/servicios';
import { llmsTxt } from '../lib/llms';
import { obtenerClientes, obtenerOfertas, obtenerPreguntas } from '../data/contenido';

export const GET: APIRoute = async () =>
  new Response(llmsTxt(await obtenerServicios(), (await obtenerClientes()).map((c) => c.nombre), { ofertas: await obtenerOfertas(), faq: await obtenerPreguntas('es') }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
