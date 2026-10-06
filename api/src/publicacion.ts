// Publicar el sitio desde el panel: el sitio es estático, así que publicar es volver a construirlo.
// La vista previa (Cloudflare Pages) se sube por carga directa y no tiene deploy hook; por eso el
// Worker dispara el workflow de GitHub Actions que la construye (workflow_dispatch). El build lee
// el contenido publicado de /v1/contenido.
//
// Necesita GITHUB_DISPATCH_TOKEN (fine-grained, solo este repo, permiso Actions: Read and write).
// Sin él, el pedido queda como "sin_configurar" y el panel lo dice.
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { publicaciones, type Publicacion } from './db/schema';
import type { Env } from './env';
import { ahora, uuid, MINUTO } from './util';

export const WORKFLOWS = { vista_previa: 'preview.yml', produccion: 'deploy.yml' } as const;
export type Destino = keyof typeof WORKFLOWS;
/** Dos pedidos al mismo destino en menos de esto se juntan en un solo build. */
export const VENTANA_AGRUPAR = 2 * MINUTO;
const MAX_INTENTOS = 3;

export const configurada = (env: Env) => !!(env.GITHUB_DISPATCH_TOKEN && env.GITHUB_REPO);

/** Dispara el workflow. Devuelve la URL de la corrida si GitHub la da. Lanza con un mensaje claro si falla. */
export async function disparar(env: Env, destino: Destino): Promise<string | null> {
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${WORKFLOWS[destino]}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'antidoto-api',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ref: env.GITHUB_REF || 'main', return_run_details: true }),
  });
  if (r.status === 204) return null;
  if (r.ok) {
    const d = (await r.json().catch(() => ({}))) as { html_url?: string; run_url?: string };
    return d.html_url ?? null;
  }
  const texto = await r.text().catch(() => '');
  throw new Error(`GitHub respondió ${r.status}${texto ? `: ${texto.slice(0, 200)}` : ''}`);
}

/**
 * Pide publicar. Si ya hay un pedido al mismo destino de hace menos de VENTANA_AGRUPAR, se usa ese
 * (varios "Publicar" seguidos no lanzan varios builds). Devuelve el pedido y si hay que dispararlo.
 */
export async function pedirPublicacion(db: DrizzleD1Database, env: Env, destino: Destino, autor: string): Promise<{ pedido: Publicacion; nuevo: boolean }> {
  const t = ahora();
  const [reciente] = await db
    .select()
    .from(publicaciones)
    .where(and(eq(publicaciones.destino, destino), gte(publicaciones.solicitada, t - VENTANA_AGRUPAR)))
    .orderBy(desc(publicaciones.solicitada))
    .limit(1);
  if (reciente && reciente.estado !== 'fallida') return { pedido: reciente, nuevo: false };
  const pedido: Publicacion = {
    id: uuid(),
    solicitada: t,
    autor,
    destino,
    estado: configurada(env) ? 'pendiente' : 'sin_configurar',
    intentos: 0,
    disparada: null,
    runUrl: null,
    error: configurada(env) ? null : 'Falta configurar GITHUB_DISPATCH_TOKEN y GITHUB_REPO en el Worker.',
  };
  await db.insert(publicaciones).values(pedido);
  return { pedido, nuevo: pedido.estado === 'pendiente' };
}

/** Dispara un pedido pendiente y anota el resultado. */
export async function procesarPedido(db: DrizzleD1Database, env: Env, p: Publicacion): Promise<Publicacion> {
  const t = ahora();
  try {
    const runUrl = await disparar(env, p.destino);
    const cambios = { estado: 'disparada' as const, disparada: t, runUrl, intentos: p.intentos + 1, error: null };
    await db.update(publicaciones).set(cambios).where(eq(publicaciones.id, p.id));
    return { ...p, ...cambios };
  } catch (e) {
    const intentos = p.intentos + 1;
    const cambios = { estado: (intentos >= MAX_INTENTOS ? 'fallida' : 'pendiente') as Publicacion['estado'], intentos, error: (e as Error).message.slice(0, 300) };
    await db.update(publicaciones).set(cambios).where(eq(publicaciones.id, p.id));
    console.error('[publicacion] no se pudo disparar', e);
    return { ...p, ...cambios };
  }
}

/** Cron de cada 5 minutos: reintenta los pedidos que quedaron pendientes (GitHub caído, por ejemplo). */
export async function reintentarPublicaciones(db: DrizzleD1Database, env: Env): Promise<number> {
  if (!configurada(env)) return 0;
  const pendientes = await db
    .select()
    .from(publicaciones)
    .where(and(eq(publicaciones.estado, 'pendiente'), lt(publicaciones.solicitada, ahora() - MINUTO)))
    .limit(5);
  for (const p of pendientes) await procesarPedido(db, env, p);
  return pendientes.length;
}
