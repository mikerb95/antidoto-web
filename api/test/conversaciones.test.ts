// Conversaciones guardadas del chat con IA: guardado por turno sin duplicar, datos tapados,
// tope real de preguntas, borrado por el visitante, limpieza a los 90 días, vínculo con el lead
// y la vista del panel.
import { describe, test, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { prepararPruebas } from './ayudas';
import type { RespuestaApi } from '../src/asesor/bucle';
import { MAX_PREGUNTAS } from '../src/asesor/prompt';
import { limpiarConversaciones, DIAS_RETENCION } from '../src/asesor/guardado';
import { temaDe } from '../src/asesor/temas';
import { TIEMPO_MINIMO_MS } from '../src/validar';
import consentimiento from '../../src/data/consentimiento.json';

const SITIO = 'https://antidotocolombia.com';
let respuestas: RespuestaApi[] = [];
const texto = (t: string): RespuestaApi => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 20 } });
const herramienta = (name: string, input: unknown): RespuestaApi => ({ content: [{ type: 'tool_use', id: `t-${name}`, name, input }], stop_reason: 'tool_use', usage: { input_tokens: 50, output_tokens: 10 } });

const p = prepararPruebas((url) => (url === 'https://api.anthropic.com/v1/messages' ? Response.json(respuestas.shift() ?? texto('Sin guion.')) : null));

beforeEach(async () => {
  p.env.ANTHROPIC_API_KEY = 'sk-prueba';
  respuestas = [];
  await p.env.DB.exec('DELETE FROM limites;');
});

let n = 0;
const nuevoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const preguntar = (cuerpo: Record<string, unknown>, ruta = '/v1/asesor') =>
  p.llamar(ruta, { method: 'POST', body: JSON.stringify(cuerpo), headers: { origin: SITIO, 'content-type': 'text/plain;charset=UTF-8' }, ip: `10.0.${n}.1` });
const mensajes = (...textos: string[]) => textos.map((t, i) => ({ rol: i % 2 ? 'asesor' : 'usuario', texto: t }));
const filas = async <T,>(sql: string, ...args: unknown[]) => (await p.env.DB.prepare(sql).bind(...args).all<T>()).results;

describe('guardado por turno', () => {
  test('dos preguntas seguidas guardan cuatro mensajes, con temas y costo', async () => {
    const id = nuevoId();
    respuestas = [texto('Hacemos formaciones vivenciales.')];
    expect((await preguntar({ locale: 'es', pagina: 'formaciones', conversacion: id, origen: 'panel', mensajes: mensajes('¿Qué servicios ofrecen?') })).status).toBe(200);
    respuestas = [texto('Te armamos una propuesta a la medida.')];
    await preguntar({ locale: 'es', pagina: 'formaciones', conversacion: id, mensajes: mensajes('¿Qué servicios ofrecen?', 'Hacemos formaciones vivenciales.', '¿Cuánto cuesta?') });
    const msgs = await filas<{ n: number; rol: string; tema: string | null }>('select n, rol, tema from conversacion_mensajes where conversacion_id = ? order by n', id);
    expect(msgs).toEqual([
      { n: 0, rol: 'usuario', tema: 'servicios' },
      { n: 1, rol: 'asesor', tema: null },
      { n: 2, rol: 'usuario', tema: 'precio' },
      { n: 3, rol: 'asesor', tema: null },
    ]);
    const [c] = await filas<{ preguntas: number; origen: string; costo_usd: number; expira: number; creada: number }>('select preguntas, origen, costo_usd, expira, creada from conversaciones where id = ?', id);
    expect(c).toMatchObject({ preguntas: 2, origen: 'panel' });
    expect(c!.costo_usd).toBeGreaterThan(0);
    expect(c!.expira - c!.creada).toBe(DIAS_RETENCION * 86_400_000);
  });

  test('reenviar el mismo POST no duplica y un historial alterado no reescribe lo guardado', async () => {
    const id = nuevoId();
    respuestas = [texto('Respuesta uno.'), texto('Respuesta repetida.')];
    const cuerpo = { locale: 'es', conversacion: id, mensajes: mensajes('Hola, primera pregunta') };
    await preguntar(cuerpo);
    await preguntar(cuerpo);
    expect(await filas('select n from conversacion_mensajes where conversacion_id = ?', id)).toHaveLength(2);
    respuestas = [texto('Respuesta dos.')];
    await preguntar({ locale: 'es', conversacion: id, mensajes: mensajes('Texto cambiado en el navegador', 'Otra cosa', 'Segunda pregunta') });
    const msgs = await filas<{ n: number; texto: string }>('select n, texto from conversacion_mensajes where conversacion_id = ? order by n', id);
    expect(msgs.map((m) => m.texto)).toEqual(['Hola, primera pregunta', 'Respuesta uno.', 'Segunda pregunta', 'Respuesta dos.']);
  });

  test('los teléfonos y correos quedan tapados en la base', async () => {
    const id = nuevoId();
    respuestas = [texto('Gracias.')];
    await preguntar({ locale: 'es', conversacion: id, mensajes: mensajes('Soy Ana, 300 123 4567, ana@demo.co') });
    const [m] = await filas<{ texto: string }>('select texto from conversacion_mensajes where conversacion_id = ? and n = 0', id);
    expect(m!.texto).not.toMatch(/4567|ana@demo/);
  });

  test('guarda herramientas, el mensaje de WhatsApp y la derivación del día', async () => {
    const id = nuevoId();
    respuestas = [herramienta('preparar_whatsapp', { necesidad: 'Formación para 40 personas.', servicio: 'formaciones' }), texto('Listo, abajo está el botón.')];
    await preguntar({ locale: 'es', conversacion: id, mensajes: mensajes('Quiero cotizar una formación') });
    const [a] = await filas<{ herramientas: string; whatsapp: string }>("select herramientas, whatsapp from conversacion_mensajes where conversacion_id = ? and rol = 'asesor'", id);
    expect(JSON.parse(a!.herramientas)).toEqual(['preparar_whatsapp']);
    expect(a!.whatsapp).toContain('Formación para 40 personas.');
    const [c] = await filas<{ servicio: string; whatsapp: number | null }>('select servicio, whatsapp from conversaciones where id = ?', id);
    expect(c!.servicio).toBe('formaciones');
    expect(c!.whatsapp).toEqual(expect.any(Number));
    const [dia] = await filas<{ derivaciones: number }>('select derivaciones from gasto_asesor order by dia desc limit 1');
    expect(dia!.derivaciones).toBeGreaterThan(0);
  });

  test('sin id de conversación responde igual y no guarda (sitio viejo)', async () => {
    const antes = (await filas('select id from conversaciones')).length;
    respuestas = [texto('Hola.')];
    expect((await preguntar({ locale: 'es', mensajes: mensajes('Hola') })).status).toBe(200);
    expect(await filas('select id from conversaciones')).toHaveLength(antes);
  });

  test('un id que no es UUID v4 es un 422', async () => {
    expect((await preguntar({ locale: 'es', conversacion: 'abc', mensajes: mensajes('Hola') })).status).toBe(422);
    expect((await preguntar({ locale: 'es', origen: 'otro', mensajes: mensajes('Hola') })).status).toBe(422);
  });

  test('el tope de preguntas lo cuenta el servidor aunque el navegador mande menos historial', async () => {
    const id = nuevoId();
    const t = Date.now();
    await p.env.DB.prepare('insert into conversaciones (id, creada, actualizada, locale, preguntas, expira) values (?, ?, ?, ?, ?, ?)').bind(id, t, t, 'es', MAX_PREGUNTAS, t + 1e9).run();
    const r = await preguntar({ locale: 'es', conversacion: id, mensajes: mensajes('Una más') });
    expect(r.status).toBe(429);
  });
});

describe('borrado y retención', () => {
  test('el visitante borra su conversación', async () => {
    const id = nuevoId();
    respuestas = [texto('Hola.')];
    await preguntar({ locale: 'es', conversacion: id, mensajes: mensajes('Hola') });
    const r = await preguntar({ conversacion: id }, '/v1/asesor/borrar');
    expect(r.status).toBe(200);
    expect(await filas('select id from conversaciones where id = ?', id)).toHaveLength(0);
    expect(await filas('select id from conversacion_mensajes where conversacion_id = ?', id)).toHaveLength(0);
    expect((await preguntar({ conversacion: 'x' }, '/v1/asesor/borrar')).status).toBe(422);
  });

  test('la limpieza borra lo vencido y conserva los contadores del día', async () => {
    const vieja = nuevoId();
    const nueva = nuevoId();
    respuestas = [texto('Uno.'), texto('Dos.')];
    await preguntar({ locale: 'es', conversacion: vieja, mensajes: mensajes('Vieja') });
    await preguntar({ locale: 'es', conversacion: nueva, mensajes: mensajes('Nueva') });
    await p.env.DB.prepare('update conversaciones set expira = 1 where id = ?').bind(vieja).run();
    const [antes] = await filas<{ preguntas: number }>('select sum(preguntas) as preguntas from gasto_asesor');
    expect(await limpiarConversaciones(drizzle(p.env.DB), Date.now())).toBeGreaterThanOrEqual(1);
    expect(await filas('select id from conversaciones where id = ?', vieja)).toHaveLength(0);
    expect(await filas('select id from conversacion_mensajes where conversacion_id = ?', vieja)).toHaveLength(0);
    expect(await filas('select id from conversaciones where id = ?', nueva)).toHaveLength(1);
    const [despues] = await filas<{ preguntas: number }>('select sum(preguntas) as preguntas from gasto_asesor');
    expect(despues!.preguntas).toBe(antes!.preguntas);
  });

  test('apagar el chat desde el panel lo deja sin responder', async () => {
    const admin = await p.entrarComo('ajustes-chat@antidoto.co', 'admin');
    await p.conSesion(admin, '/admin/api/configuracion', { method: 'PUT', body: JSON.stringify({ 'asesor.activo': false }) });
    const r = await p.llamar('/v1/asesor', { headers: { origin: SITIO } });
    expect(await r.json()).toEqual({ disponible: false });
    await p.conSesion(admin, '/admin/api/configuracion', { method: 'PUT', body: JSON.stringify({ 'asesor.activo': true, 'asesor.tope_diario_usd': 5 }) });
    expect(await (await p.llamar('/v1/asesor', { headers: { origin: SITIO } })).json()).toEqual({ disponible: true });
  });
});

describe('vínculo con la solicitud', () => {
  test('el lead autorizado se liga a la conversación y suprimirlo la borra', async () => {
    const id = nuevoId();
    respuestas = [texto('Hola.')];
    await preguntar({ locale: 'es', conversacion: id, mensajes: mensajes('Quiero catering') });
    const lead = await p.llamar('/v1/leads', {
      method: 'POST',
      ip: '10.9.9.9',
      headers: { origin: SITIO, 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ servicio: 'catering', nombre: 'Ana', email: 'ana@x.co', consentimiento: consentimiento.version, locale: 'es', t: TIEMPO_MINIMO_MS + 5000, conversacion: id }),
    });
    const leadId = ((await lead.json()) as { id: string }).id;
    const [c] = await filas<{ lead_id: string }>('select lead_id from conversaciones where id = ?', id);
    expect(c!.lead_id).toBe(leadId);

    const admin = await p.entrarComo('vinculo@antidoto.co', 'admin');
    const det = (await (await p.llamar(`/admin/api/conversaciones/${id}`, { headers: { cookie: admin } })).json()) as { lead: { id: string } };
    expect(det.lead.id).toBe(leadId);
    await p.conSesion(admin, `/admin/api/leads/${leadId}/anonimizar`, { method: 'POST' });
    expect(await filas('select id from conversaciones where id = ?', id)).toHaveLength(0);
  });
});

describe('panel', () => {
  test('lista con filtros, detalle sin hash de IP, métricas y CSV sin texto', async () => {
    const id = nuevoId();
    respuestas = [herramienta('pedir_contacto', { servicio: 'audiovisual' }), texto('Abajo tienes el cotizador.')];
    await preguntar({ locale: 'es', pagina: 'audiovisual', conversacion: id, mensajes: mensajes('Necesito un video institucional') });
    const c = await p.entrarComo('lectura-chat@antidoto.co', 'lectura');

    const lista = (await (await p.llamar('/admin/api/conversaciones?resultado=cotizador&q=institucional', { headers: { cookie: c } })).json()) as { conversaciones: { id: string; primera: string }[] };
    expect(lista.conversaciones.map((x) => x.id)).toEqual([id]);
    expect(lista.conversaciones[0]!.primera).toBe('Necesito un video institucional');

    const det = (await (await p.llamar(`/admin/api/conversaciones/${id}`, { headers: { cookie: c } })).json()) as { conversacion: Record<string, unknown>; mensajes: unknown[] };
    expect(det.mensajes).toHaveLength(2);
    expect(det.conversacion).not.toHaveProperty('ipHash');

    const m = (await (await p.llamar('/admin/api/conversaciones/metricas?dias=30', { headers: { cookie: c } })).json()) as { totales: { conversaciones: number }; temas: { clave: string }[]; porDia: unknown[] };
    expect(m.totales.conversaciones).toBeGreaterThan(0);
    expect(m.porDia.length).toBeGreaterThan(0);

    const csv = await (await p.llamar('/admin/api/conversaciones.csv', { headers: { cookie: c } })).text();
    expect(csv).toContain('pagina_inicial');
    expect(csv).not.toContain('institucional');

    // Solo lectura no borra; admin sí, y queda en la auditoría.
    expect((await p.conSesion(c, `/admin/api/conversaciones/${id}`, { method: 'DELETE' })).status).toBe(403);
    const admin = await p.entrarComo('borra-chat@antidoto.co', 'admin');
    expect((await p.conSesion(admin, `/admin/api/conversaciones/${id}`, { method: 'DELETE' })).status).toBe(200);
    expect(await filas("select id from auditoria where accion = 'conversacion.suprimir' and entidad_id = ?", id)).toHaveLength(1);
  });

  test('producción no ve las conversaciones', async () => {
    const c = await p.entrarComo('produccion-chat@antidoto.co', 'produccion');
    expect((await p.llamar('/admin/api/conversaciones', { headers: { cookie: c } })).status).toBe(403);
  });
});

describe('temas', () => {
  test('clasifica por palabras clave en los dos idiomas', () => {
    expect(temaDe('¿Cuánto cuesta una formación?')).toBe('precio');
    expect(temaDe('How much is it?')).toBe('precio');
    expect(temaDe('¿Tienen disponibilidad en diciembre?')).toBe('fechas');
    expect(temaDe('¿Van hasta Medellín?')).toBe('lugar');
    expect(temaDe('Somos 40 personas')).toBe('grupo');
    expect(temaDe('¿Es virtual o presencial?')).toBe('formato');
    expect(temaDe('hola')).toBe('otro');
  });
});
