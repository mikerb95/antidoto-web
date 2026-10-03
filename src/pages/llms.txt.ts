// Resumen del sitio para asistentes de IA (llmstxt.org). Se genera en el build con los servicios
// publicables, así un borrador tampoco aparece aquí.
import type { APIRoute } from 'astro';
import { obtenerServicios } from '../data/servicios';
import { CLIENTES } from '../data/clientes';
import { llmsTxt } from '../lib/llms';

export const GET: APIRoute = async () =>
  new Response(llmsTxt(await obtenerServicios(), CLIENTES.map((c) => c.nombre)), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
