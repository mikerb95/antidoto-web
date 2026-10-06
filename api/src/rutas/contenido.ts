// Contenido del sitio en el panel: blog, casos, vacantes, preguntas y clientes; imágenes en R2 y
// publicación (volver a construir el sitio). Las lecturas públicas para el build están en
// src/contenido/publico.ts.
import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { contenido, versionesContenido, medios, publicaciones, type Contenido } from '../db/schema';
import { ESQUEMAS, IDIOMAS, TIPOS_CONTENIDO, mediosDe, tituloDe, validarContenido, type TipoContenido } from '../contenido/esquemas';
import { EXTENSION, MAX_BYTES_IMAGEN, leerImagen, nombreLimpio } from '../archivos';
import { configurada, pedirPublicacion, procesarPedido, WORKFLOWS, type Destino } from '../publicacion';
import { puede } from '../permisos';
import { ahora, json, uuid } from '../util';
import { auditar, sinPermiso, type Ctx } from './contexto';

const MAX_VERSIONES = 20;
const RE_ID = /^\/admin\/api\/contenido\/([0-9a-f-]{36})(\/publicar|\/despublicar|\/archivar|\/desarchivar|\/restaurar\/\d+)?$/;
const RE_MEDIO = /^\/admin\/api\/medios\/([0-9a-f-]{36})$/;

export type EstadoContenido = 'borrador' | 'publicado' | 'cambios' | 'archivado';
export const estadoDe = (c: Pick<Contenido, 'archivada' | 'publicada' | 'version'>): EstadoContenido =>
  c.archivada ? 'archivado' : !c.publicada ? 'borrador' : c.publicada.version === c.version ? 'publicado' : 'cambios';

const esTipo = (v: unknown): v is TipoContenido => TIPOS_CONTENIDO.includes(v as TipoContenido);

export async function rutasContenido(c: Ctx): Promise<Response | null> {
  const { ruta, metodo } = c;
  if (ruta === '/admin/api/contenido' && metodo === 'GET') return sinPermiso(c, 'contenido.ver') ?? listar(c);
  if (ruta === '/admin/api/contenido' && metodo === 'POST') return sinPermiso(c, 'contenido.editar') ?? crear(c);
  const m = ruta.match(RE_ID);
  if (m) {
    const id = m[1]!;
    const accion = m[2];
    if (!accion && metodo === 'GET') return sinPermiso(c, 'contenido.ver') ?? ver(c, id);
    if (!accion && metodo === 'PUT') return sinPermiso(c, 'contenido.editar') ?? guardar(c, id);
    if (!accion && metodo === 'DELETE') return sinPermiso(c, 'contenido.editar') ?? borrar(c, id);
    if (accion === '/publicar' && metodo === 'POST') return sinPermiso(c, 'contenido.publicar') ?? publicar(c, id);
    if (accion === '/despublicar' && metodo === 'POST') return sinPermiso(c, 'contenido.publicar') ?? despublicar(c, id);
    if ((accion === '/archivar' || accion === '/desarchivar') && metodo === 'POST') return sinPermiso(c, 'contenido.publicar') ?? archivar(c, id, accion === '/archivar');
    if (accion?.startsWith('/restaurar/') && metodo === 'POST') return sinPermiso(c, 'contenido.editar') ?? restaurar(c, id, Number(accion.split('/')[2]));
    return null;
  }
  if (ruta === '/admin/api/medios' && metodo === 'GET') return sinPermiso(c, 'contenido.ver') ?? listarMedios(c);
  if (ruta === '/admin/api/medios' && metodo === 'POST') return sinPermiso(c, 'contenido.editar') ?? subirMedio(c);
  const medio = ruta.match(RE_MEDIO);
  if (medio && metodo === 'DELETE') return sinPermiso(c, 'contenido.editar') ?? borrarMedio(c, medio[1]!);
  if (ruta === '/admin/api/publicaciones' && metodo === 'GET') return sinPermiso(c, 'contenido.ver') ?? listarPublicaciones(c);
  if (ruta === '/admin/api/publicar' && metodo === 'POST') return sinPermiso(c, 'contenido.publicar') ?? publicarSitio(c);
  return null;
}

const resumen = (x: Contenido) => ({
  id: x.id,
  tipo: x.tipo,
  clave: x.clave,
  titulo: tituloDe(x.tipo as TipoContenido, x),
  estado: estadoDe(x),
  version: x.version,
  publicadaEn: x.publicadaEn,
  actualizado: x.actualizado,
  autor: x.autor,
  datos: x.datos,
});

async function listar(c: Ctx): Promise<Response> {
  const tipo = c.url.searchParams.get('tipo');
  const filas = await c.db
    .select()
    .from(contenido)
    .where(esTipo(tipo) ? eq(contenido.tipo, tipo) : undefined)
    .orderBy(desc(contenido.actualizado));
  const conteos = Object.fromEntries(TIPOS_CONTENIDO.map((t) => [t, 0])) as Record<TipoContenido, number>;
  const todos = esTipo(tipo) ? await c.db.select({ tipo: contenido.tipo, n: sql<number>`count(*)` }).from(contenido).where(isNull(contenido.archivada)).groupBy(contenido.tipo) : null;
  for (const f of todos ?? []) if (esTipo(f.tipo)) conteos[f.tipo] = f.n;
  return json({ entradas: filas.map(resumen), conteos });
}

async function cargar(c: Ctx, id: string): Promise<Contenido | null> {
  const [x] = await c.db.select().from(contenido).where(eq(contenido.id, id));
  return x ?? null;
}

async function detalle(c: Ctx, x: Contenido): Promise<Response> {
  const [versiones, imagenes] = await Promise.all([
    c.db
      .select({ version: versionesContenido.version, creado: versionesContenido.creado, autor: versionesContenido.autor })
      .from(versionesContenido)
      .where(eq(versionesContenido.contenidoId, x.id))
      .orderBy(desc(versionesContenido.version)),
    medioInfo(c, mediosDe(x.tipo as TipoContenido, x)),
  ]);
  return json({ entrada: { ...x, titulo: tituloDe(x.tipo as TipoContenido, x), estado: estadoDe(x) }, versiones, medios: imagenes });
}

async function medioInfo(c: Ctx, ids: string[]) {
  if (!ids.length) return {};
  const filas = await c.db.select().from(medios).where(inArray(medios.id, ids));
  return Object.fromEntries(filas.map((m) => [m.id, { ...m, url: `/v1/medios/${m.id}` }]));
}

async function ver(c: Ctx, id: string): Promise<Response> {
  const x = await cargar(c, id);
  return x ? detalle(c, x) : json({ error: 'no existe' }, 404);
}

async function crear(c: Ctx): Promise<Response> {
  const d = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!d || !esTipo(d.tipo)) return json({ errores: { tipo: 'Tipo inválido' } }, 422);
  const tipo = d.tipo;
  const r = validarContenido(tipo, d);
  if (!r.ok) return json({ errores: r.errores }, 422);
  const t = ahora();
  const fila: Contenido = {
    id: uuid(),
    tipo,
    clave: r.limpio.clave,
    datos: r.limpio.datos,
    textos: r.limpio.textos as Contenido['textos'],
    version: 1,
    publicada: null,
    publicadaEn: null,
    archivada: null,
    creado: t,
    actualizado: t,
    autor: c.sesion.usuario.email,
  };
  try {
    await c.db.insert(contenido).values(fila);
  } catch {
    return json({ errores: { clave: 'Ya hay otra entrada de este tipo con esa clave' } }, 409);
  }
  return auditar(c, await detalle(c, fila), 'contenido.crear', 'contenido', fila.id, { tipo });
}

async function guardar(c: Ctx, id: string): Promise<Response> {
  const x = await cargar(c, id);
  if (!x) return json({ error: 'no existe' }, 404);
  const d = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!d) return json({ errores: { cuerpo: 'Formato inválido' } }, 422);
  // Dos personas editando a la vez: gana la primera y a la segunda se le avisa.
  if (typeof d.version === 'number' && d.version !== x.version) return json({ error: 'version', version: x.version }, 409);
  const r = validarContenido(x.tipo as TipoContenido, { ...d, clave: d.clave ?? x.clave });
  if (!r.ok) return json({ errores: r.errores }, 422);
  // La clave de algo ya publicado no cambia: es la que une los dos idiomas en el sitio.
  if (x.publicada && r.limpio.clave !== x.clave) return json({ errores: { clave: 'La clave no se puede cambiar después de publicar' } }, 422);
  const t = ahora();
  try {
    await c.db.batch([
      c.db.insert(versionesContenido).values({ id: uuid(), contenidoId: id, version: x.version, datos: x.datos, textos: x.textos, creado: x.actualizado, autor: x.autor }),
      c.db
        .update(contenido)
        .set({ clave: r.limpio.clave, datos: r.limpio.datos, textos: r.limpio.textos as Contenido['textos'], version: x.version + 1, actualizado: t, autor: c.sesion.usuario.email })
        .where(and(eq(contenido.id, id), eq(contenido.version, x.version))),
      c.db
        .delete(versionesContenido)
        .where(and(eq(versionesContenido.contenidoId, id), lt(versionesContenido.version, x.version - MAX_VERSIONES + 1))),
    ]);
  } catch {
    return json({ errores: { clave: 'Ya hay otra entrada de este tipo con esa clave' } }, 409);
  }
  return auditar(c, await ver(c, id), 'contenido.editar', 'contenido', id, { tipo: x.tipo, version: x.version + 1 });
}

/** Slugs que ya usa otra entrada publicada del mismo tipo. */
async function slugsOcupados(c: Ctx, x: Contenido, textos: Contenido['textos']): Promise<Record<string, string>> {
  if (!ESQUEMAS[x.tipo as TipoContenido].porIdioma.some((k) => k.tipo === 'slug')) return {};
  const otros = await c.db
    .select({ id: contenido.id, publicada: contenido.publicada })
    .from(contenido)
    .where(and(eq(contenido.tipo, x.tipo), isNotNull(contenido.publicada), isNull(contenido.archivada)));
  const errores: Record<string, string> = {};
  for (const idioma of IDIOMAS) {
    const slug = textos[idioma]?.slug;
    if (otros.some((o) => o.id !== x.id && o.publicada?.textos[idioma]?.slug === slug)) errores[`${idioma}.slug`] = 'Otra entrada publicada ya usa esta dirección';
  }
  return errores;
}

async function publicar(c: Ctx, id: string): Promise<Response> {
  const x = await cargar(c, id);
  if (!x) return json({ error: 'no existe' }, 404);
  if (x.archivada) return json({ error: 'archivada' }, 409);
  const r = validarContenido(x.tipo as TipoContenido, x, true);
  if (!r.ok) return json({ errores: r.errores }, 422);
  const ocupados = await slugsOcupados(c, x, x.textos);
  if (Object.keys(ocupados).length) return json({ errores: ocupados }, 422);
  const usadas = mediosDe(x.tipo as TipoContenido, x);
  const imagenes = await medioInfo(c, usadas);
  if (usadas.some((m) => !imagenes[m])) return json({ errores: { imagen: 'Una imagen ya no existe. Elige otra.' } }, 422);
  const t = ahora();
  await c.db
    .update(contenido)
    .set({ publicada: { datos: x.datos, textos: x.textos, version: x.version }, publicadaEn: t })
    .where(eq(contenido.id, id));
  return auditar(c, await ver(c, id), 'contenido.publicar', 'contenido', id, { tipo: x.tipo, version: x.version });
}

async function despublicar(c: Ctx, id: string): Promise<Response> {
  const x = await cargar(c, id);
  if (!x) return json({ error: 'no existe' }, 404);
  // publicadaEn marca el último cambio visible en el sitio: retirarla también pide publicar.
  await c.db.update(contenido).set({ publicada: null, ...(x.publicada ? { publicadaEn: ahora() } : {}) }).where(eq(contenido.id, id));
  return auditar(c, await ver(c, id), 'contenido.despublicar', 'contenido', id, { tipo: x.tipo });
}

async function archivar(c: Ctx, id: string, si: boolean): Promise<Response> {
  const x = await cargar(c, id);
  if (!x) return json({ error: 'no existe' }, 404);
  // Archivar también la saca del sitio.
  await c.db
    .update(contenido)
    .set(si ? { archivada: ahora(), publicada: null, ...(x.publicada ? { publicadaEn: ahora() } : {}) } : { archivada: null })
    .where(eq(contenido.id, id));
  return auditar(c, await ver(c, id), si ? 'contenido.archivar' : 'contenido.desarchivar', 'contenido', id, { tipo: x.tipo });
}

async function restaurar(c: Ctx, id: string, version: number): Promise<Response> {
  const x = await cargar(c, id);
  if (!x) return json({ error: 'no existe' }, 404);
  const [v] = await c.db
    .select()
    .from(versionesContenido)
    .where(and(eq(versionesContenido.contenidoId, id), eq(versionesContenido.version, version)));
  if (!v) return json({ error: 'no existe' }, 404);
  const t = ahora();
  await c.db.batch([
    c.db.insert(versionesContenido).values({ id: uuid(), contenidoId: id, version: x.version, datos: x.datos, textos: x.textos, creado: x.actualizado, autor: x.autor }),
    c.db.update(contenido).set({ datos: v.datos, textos: v.textos, version: x.version + 1, actualizado: t, autor: c.sesion.usuario.email }).where(eq(contenido.id, id)),
  ]);
  return auditar(c, await ver(c, id), 'contenido.restaurar', 'contenido', id, { tipo: x.tipo, desde: version });
}

async function borrar(c: Ctx, id: string): Promise<Response> {
  const x = await cargar(c, id);
  if (!x) return json({ error: 'no existe' }, 404);
  // Lo que alguna vez salió en el sitio se archiva, no se borra (queda el historial).
  if (x.publicadaEn) return json({ error: 'publicada' }, 409);
  await c.db.batch([c.db.delete(versionesContenido).where(eq(versionesContenido.contenidoId, id)), c.db.delete(contenido).where(eq(contenido.id, id))]);
  return auditar(c, json({ ok: true }), 'contenido.borrar', 'contenido', id, { tipo: x.tipo });
}

// Imágenes ---------------------------------------------------------------------------

async function listarMedios(c: Ctx): Promise<Response> {
  const filas = await c.db.select().from(medios).orderBy(desc(medios.creado)).limit(200);
  return json({ medios: filas.map((m) => ({ ...m, url: `/v1/medios/${m.id}` })), configurado: !!c.env.MEDIOS });
}

async function subirMedio(c: Ctx): Promise<Response> {
  if (!c.env.MEDIOS) return json({ error: 'sin_bucket' }, 503);
  const largo = Number(c.req.headers.get('content-length'));
  if (largo > MAX_BYTES_IMAGEN + 64 * 1024) return json({ error: 'grande' }, 413);
  const form = await c.req.formData().catch(() => null);
  const archivo = form?.get('archivo');
  if (!archivo || typeof archivo === 'string') return json({ error: 'archivo' }, 422);
  if (archivo.size > MAX_BYTES_IMAGEN) return json({ error: 'grande' }, 413);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const info = leerImagen(bytes);
  if (!info) return json({ error: 'formato' }, 422);
  const id = uuid();
  const claveR2 = `contenido/${id}.${EXTENSION[info.mime]}`;
  await c.env.MEDIOS.put(claveR2, bytes, { httpMetadata: { contentType: info.mime, cacheControl: 'public, max-age=31536000, immutable' } });
  const fila = { id, claveR2, nombre: nombreLimpio(archivo.name), mime: info.mime, bytes: bytes.length, ancho: info.ancho, alto: info.alto, creado: ahora(), autor: c.sesion.usuario.email };
  await c.db.insert(medios).values(fila);
  return auditar(c, json({ medio: { ...fila, url: `/v1/medios/${id}` } }, 201), 'medio.subir', 'medio', id);
}

async function borrarMedio(c: Ctx, id: string): Promise<Response> {
  const [m] = await c.db.select().from(medios).where(eq(medios.id, id));
  if (!m) return json({ error: 'no existe' }, 404);
  // No se borra una imagen que use alguna entrada (en su copia de trabajo o en la publicada).
  const enUso = await c.db
    .select({ id: contenido.id })
    .from(contenido)
    .where(sql`instr(${contenido.datos}, ${id}) > 0 or instr(coalesce(${contenido.publicada}, ''), ${id}) > 0`)
    .limit(1);
  if (enUso.length) return json({ error: 'en_uso' }, 409);
  await c.env.MEDIOS?.delete(m.claveR2);
  await c.db.delete(medios).where(eq(medios.id, id));
  return auditar(c, json({ ok: true }), 'medio.borrar', 'medio', id);
}

// Publicar el sitio ------------------------------------------------------------------

async function listarPublicaciones(c: Ctx): Promise<Response> {
  const [filas, conCambios] = await Promise.all([
    c.db.select().from(publicaciones).orderBy(desc(publicaciones.solicitada)).limit(20),
    c.db
      .select({ n: sql<number>`count(*)` })
      .from(contenido)
      .where(and(isNotNull(contenido.publicadaEn), sql`${contenido.publicadaEn} > coalesce((select max(${publicaciones.solicitada}) from ${publicaciones} where ${publicaciones.estado} = 'disparada'), 0)`)),
  ]);
  return json({ publicaciones: filas, configurada: configurada(c.env), sinPublicar: conCambios[0]?.n ?? 0, workflows: WORKFLOWS });
}

async function publicarSitio(c: Ctx): Promise<Response> {
  const d = (await c.req.json().catch(() => ({}))) as { destino?: unknown };
  const destino: Destino = d.destino === 'produccion' ? 'produccion' : 'vista_previa';
  // El sitio en producción solo lo publica alguien con rol Admin.
  if (destino === 'produccion' && !puede(c.sesion.usuario.rol, 'config.editar')) return json({ error: 'permiso', permiso: 'config.editar' }, 403);
  const { pedido, nuevo } = await pedirPublicacion(c.db, c.env, destino, c.sesion.usuario.email);
  const final = nuevo ? await procesarPedido(c.db, c.env, pedido) : pedido;
  return auditar(c, json({ publicacion: final, agrupada: !nuevo }, final.estado === 'sin_configurar' ? 503 : 200), 'sitio.publicar', null, null, { destino });
}
