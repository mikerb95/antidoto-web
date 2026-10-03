// Resumen del sitio para asistentes de IA (llmstxt.org). Se genera en el build con los servicios
// y ofertas publicables (así un borrador tampoco aparece aquí) y las preguntas frecuentes respondidas.
import type { APIRoute } from 'astro';
import { obtenerServicios } from '../data/servicios';
import { CLIENTES } from '../data/clientes';
import { llmsTxt } from '../lib/llms';
import { obtenerOfertas } from '../data/contenido';
import { preguntas } from '../data/faq';

export const GET: APIRoute = async () =>
  new Response(llmsTxt(await obtenerServicios(), CLIENTES.map((c) => c.nombre), { ofertas: await obtenerOfertas(), faq: preguntas('es') }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
