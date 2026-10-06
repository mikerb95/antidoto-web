// Preguntas frecuentes y clientes publicados desde el panel, para el conocimiento del asesor. Así
// el chat dice lo mismo que el sitio sin esperar a que se vuelva a desplegar el Worker. Se guardan
// 5 minutos en memoria del isolate; si la base no responde, el asesor sigue con lo del sitio
// (falla abierto: es información extra, no un control).
import { and, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { contenido } from '../db/schema';
import type { Extra } from './conocimiento';

const VIGENCIA_MS = 5 * 60_000;
let cache: { hasta: number; extra: Extra } | null = null;

export function vaciarCache() {
  cache = null;
}

export async function contenidoAsesor(db: DrizzleD1Database, t = Date.now()): Promise<Extra | undefined> {
  if (cache && cache.hasta > t) return cache.extra;
  try {
    const filas = await db
      .select({ tipo: contenido.tipo, clave: contenido.clave, publicada: contenido.publicada })
      .from(contenido)
      .where(and(inArray(contenido.tipo, ['faq', 'cliente']), isNotNull(contenido.publicada), isNull(contenido.archivada)));
    const texto = (v: unknown) => (typeof v === 'string' ? v : '');
    const extra: Extra = {
      faq: filas
        .filter((f) => f.tipo === 'faq')
        .map((f) => {
          const t = f.publicada!.textos;
          return { clave: f.clave, es: [texto(t.es?.pregunta), texto(t.es?.respuesta)] as const, en: [texto(t.en?.pregunta), texto(t.en?.respuesta)] as const };
        }),
      clientes: filas.filter((f) => f.tipo === 'cliente').map((f) => texto(f.publicada!.datos.nombre)).filter(Boolean),
    };
    cache = { hasta: t + VIGENCIA_MS, extra };
    return extra;
  } catch (e) {
    console.error('[asesor] no se pudo leer el contenido publicado', e);
    return undefined;
  }
}
