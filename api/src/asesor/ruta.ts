// Rutas del chat con IA del sitio:
//   GET  /v1/asesor   ¿está disponible? (clave configurada y presupuesto del día)
//   POST /v1/asesor   una pregunta: { locale, pagina, mensajes } -> respuesta revisada
// Las dos solo desde los orígenes del sitio. El POST va en text/plain, como los leads, para no
// pagar el preflight de CORS en cada pregunta.
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Env } from '../env';
import type { ServicioId } from '../db/schema';
import { enviar, correoInteresAsesor } from '../correo';
import { dentroDelLimite } from '../limite';
import { ahora, hashIp, json } from '../util';
import { atender, validarEntrada } from './bucle';
import { costoUsd } from './costo';
import { llamador } from './motor';
import { presupuestoRestante, sumarGasto, topeDiarioUsd } from './presupuesto';

/** Preguntas por IP y hora. Una conversación larga son unas 10; esto deja margen sin dejar abusar. */
export const PREGUNTAS_POR_HORA = 60;
/** Avisos al equipo por IP y hora: la misma persona preparando WhatsApp varias veces avisa una o dos. */
export const AVISOS_POR_HORA = 2;
const MAX_CUERPO = 64 * 1024;

/** ¿Puede responder ahora? Falla cerrado: sin clave o si la base no contesta, no. */
async function disponible(env: Env, db: DrizzleD1Database): Promise<boolean> {
  if (!env.ANTHROPIC_API_KEY) return false;
  try {
    return (await presupuestoRestante(db, topeDiarioUsd(env.ASESOR_TOPE_DIARIO_USD))) > 0;
  } catch (e) {
    console.error('[asesor] no se pudo leer el gasto del día', e);
    return false;
  }
}

export async function rutaAsesor(
  req: Request,
  env: Env,
  db: DrizzleD1Database,
  diferir: (p: Promise<unknown>) => void,
  cors: Record<string, string>,
): Promise<Response> {
  const cabeceras = { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS' };
  if (req.method === 'GET') return json({ disponible: await disponible(env, db) }, 200, cabeceras);
  if (req.method !== 'POST') return json({ ok: false }, 405, cabeceras);

  const bruto = await req.text();
  if (bruto.length > MAX_CUERPO) return json({ ok: false, error: 'cuerpo' }, 413, cabeceras);
  let datos: unknown;
  try {
    datos = JSON.parse(bruto);
  } catch {
    return json({ ok: false, error: 'json' }, 400, cabeceras);
  }
  const entrada = validarEntrada(datos);
  if ('error' in entrada) return json({ ok: false, error: entrada.error }, entrada.error === 'limite' ? 429 : 422, cabeceras);

  const t = ahora();
  const ipHash = await hashIp(req.headers.get('cf-connecting-ip'), env.SAL_IP, t);
  if (!(await dentroDelLimite(db, `asesor:${ipHash ?? 'sin-ip'}`, PREGUNTAS_POR_HORA, t))) {
    return json({ ok: false, error: 'limite' }, 429, cabeceras);
  }
  if (!(await disponible(env, db))) return json({ ok: false, error: 'no_disponible' }, 503, cabeceras);

  let r;
  try {
    // Un Claude falso solo en local: en producción la URL alternativa se ignora.
    const url = env.ENTORNO === 'local' && env.ANTHROPIC_URL ? env.ANTHROPIC_URL : undefined;
    r = await atender(entrada, { llamarModelo: llamador(env.ANTHROPIC_API_KEY!, entrada.locale, entrada.pagina, url) });
  } catch (e) {
    console.error('[asesor] falló la llamada al modelo', e);
    return json({ ok: false, error: 'modelo' }, 502, cabeceras);
  }

  // Si anotar el gasto falla, la respuesta ya está pagada: se entrega igual.
  diferir(sumarGasto(db, costoUsd(r.uso), t).catch((e) => console.error('[asesor] no se pudo anotar el gasto', e)));

  if (r.whatsapp || r.contacto) {
    const servicio = r.servicio as ServicioId | null;
    diferir(
      dentroDelLimite(db, `aviso-asesor:${ipHash ?? 'sin-ip'}`, AVISOS_POR_HORA, t)
        .then((ok) =>
          ok
            ? enviar(env, {
                para: env.MAIL_EQUIPO,
                ...correoInteresAsesor({ accion: r.whatsapp ? 'whatsapp' : 'cotizador', servicio, necesidad: r.necesidad, pagina: entrada.pagina ?? null, locale: entrada.locale }),
              })
            : null,
        )
        .catch((e) => console.error('[asesor] aviso al equipo', e)),
    );
  }

  return json({ ok: true, texto: r.texto, whatsapp: r.whatsapp, contacto: r.contacto, respaldo: r.respaldo }, 200, cabeceras);
}
