// Proyectos: solicitud ganada a proyecto, etapas de la plantilla, permisos sobre el valor,
// entregables con archivos privados, bitácora y ficha de la organización.
import { describe, test, expect, beforeAll } from 'vitest';
import { prepararPruebas } from './ayudas';
import { PLANTILLAS, codigoProyecto } from '../src/proyectos/plantillas';

const p = prepararPruebas();
let admin = '';
let produccion = '';
let lectura = '';
const LEAD = '00000000-0000-4000-8000-0000000000c1';

beforeAll(async () => {
  admin = await p.entrarComo('admin-proy@antidoto.co', 'admin');
  produccion = await p.entrarComo('prod-proy@antidoto.co', 'produccion');
  lectura = await p.entrarComo('lect-proy@antidoto.co', 'lectura');
  const t = Date.now();
  await p.env.DB.prepare(
    "insert into leads (id, creado, actualizado, estado, servicio, nombre, empresa, email, telefono, valor_estimado, locale) values (?, ?, ?, 'cotizado', 'audiovisual', 'Paola Cárdenas', 'Ruta 5', 'paola@ruta5.co', '3155551234', 8500000, 'es')",
  )
    .bind(LEAD, t, t)
    .run();
});

const enviar = (ck: string, ruta: string, metodo: string, cuerpo?: unknown) => p.conSesion(ck, ruta, { method: metodo, ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}) });
type Det = {
  proyecto: { id: string; codigo: string; valor: number | null; estado: string; organizacionId: string };
  etapas: { id: string; nombre: string; estado: string }[];
  tareas: { id: string; hecha: number | null }[];
  entregables: { id: string; estado: string; version: number; archivos: { id: string; nombre: string }[] }[];
  bitacora: { tipo: string; texto: string }[];
  contactos: { email: string | null }[];
};

describe('de solicitud a proyecto', () => {
  let id = '';
  test('solo una solicitud ganada se vuelve proyecto', async () => {
    expect((await enviar(admin, `/admin/api/leads/${LEAD}/proyecto`, 'POST', {})).status).toBe(409);
    await enviar(admin, `/admin/api/leads/${LEAD}`, 'PATCH', { estado: 'ganado' });
    const r = await enviar(admin, `/admin/api/leads/${LEAD}/proyecto`, 'POST', {});
    expect(r.status).toBe(200);
    const d = (await r.json()) as Det;
    id = d.proyecto.id;
    expect(d.proyecto.codigo).toBe(codigoProyecto(new Date().getUTCFullYear(), 1));
    expect(d.proyecto.valor).toBe(8500000);
    expect(d.etapas.map((e) => e.nombre)).toEqual([...PLANTILLAS.audiovisual]);
    expect(d.contactos.map((c) => c.email)).toEqual(['paola@ruta5.co']);
    expect((await enviar(admin, `/admin/api/leads/${LEAD}/proyecto`, 'POST', {})).status).toBe(409);
    const lead = await p.env.DB.prepare('select proyecto_id, organizacion_id from leads where id = ?').bind(LEAD).first<{ proyecto_id: string; organizacion_id: string }>();
    expect(lead).toEqual({ proyecto_id: id, organizacion_id: d.proyecto.organizacionId });
  });

  test('producción trabaja el proyecto sin ver ni cambiar el valor; lectura no edita', async () => {
    const d = (await (await p.llamar(`/admin/api/proyectos/${id}`, { headers: { cookie: produccion } })).json()) as Det;
    expect(d.proyecto.valor).toBe(null);
    const r = (await (await enviar(produccion, `/admin/api/proyectos/${id}`, 'PATCH', { estado: 'en_curso', valor: 1 })).json()) as Det;
    expect(r.proyecto.estado).toBe('en_curso');
    const real = await p.env.DB.prepare('select valor from proyectos where id = ?').bind(id).first<number>('valor');
    expect(real).toBe(8500000);
    expect((await enviar(lectura, `/admin/api/proyectos/${id}`, 'PATCH', { estado: 'cerrado' })).status).toBe(403);
    expect(r.bitacora[0]).toMatchObject({ tipo: 'estado', texto: 'Estado del proyecto: Planeado → En curso' });
  });

  test('etapas, tareas y entregables con archivo privado', async () => {
    let d = (await (await enviar(produccion, `/admin/api/proyectos/${id}/tareas`, 'POST', { titulo: 'Confirmar locación' })).json()) as Det;
    d = (await (await enviar(produccion, `/admin/api/tareas/${d.tareas[0]!.id}`, 'PATCH', { hecha: true })).json()) as Det;
    expect(d.tareas[0]!.hecha).toEqual(expect.any(Number));
    d = (await (await enviar(produccion, `/admin/api/etapas/${d.etapas[0]!.id}`, 'PATCH', { estado: 'hecha' })).json()) as Det;
    expect(d.etapas[0]!.estado).toBe('hecha');
    d = (await (await enviar(produccion, `/admin/api/proyectos/${id}/entregables`, 'POST', { titulo: 'Corte 1 del video', visibleCliente: true })).json()) as Det;
    const ent = d.entregables[0]!;

    const form = new FormData();
    form.append('archivo', new File([new TextEncoder().encode('contenido del corte')], 'corte-1.mp4', { type: 'video/mp4' }));
    const sub = await p.llamar(`/admin/api/entregables/${ent.id}/archivos`, { method: 'POST', body: form, headers: { origin: 'https://api.test', cookie: produccion } });
    d = (await sub.json()) as Det;
    const archivo = d.entregables[0]!.archivos[0]!;
    expect(archivo.nombre).toBe('corte-1.mp4');

    expect((await p.llamar(`/admin/api/archivos/${archivo.id}`)).status).toBe(401);
    const bajada = await p.llamar(`/admin/api/archivos/${archivo.id}`, { headers: { cookie: lectura } });
    expect(bajada.headers.get('content-disposition')).toContain('attachment');
    expect(bajada.headers.get('content-type')).toBe('application/octet-stream');
    expect(await bajada.text()).toBe('contenido del corte');

    d = (await (await enviar(produccion, `/admin/api/entregables/${ent.id}`, 'PATCH', { estado: 'en_revision' })).json()) as Det;
    d = (await (await enviar(produccion, `/admin/api/entregables/${ent.id}`, 'PATCH', { estado: 'cambios' })).json()) as Det;
    d = (await (await enviar(produccion, `/admin/api/entregables/${ent.id}`, 'PATCH', { estado: 'en_revision' })).json()) as Det;
    expect(d.entregables[0]!.version).toBe(2);
  });

  test('subida directa (Vercel): firma solo claves del proyecto y registra lo subido', async () => {
    const base = (ent: string) => `/admin/api/entregables/${ent}/archivos`;
    let d = (await (await enviar(produccion, `/admin/api/proyectos/${id}/entregables`, 'POST', { titulo: 'Fotos del evento' })).json()) as Det;
    const ent = d.entregables.find((e) => e.archivos.length === 0)!;

    // Sin env.SUBIDA (Cloudflare) el panel recibe 404 y sube por el formulario.
    expect(await (await enviar(produccion, `${base(ent.id)}/firmar`, 'POST', {})).json()).toEqual({ error: 'sin_subida_directa' });
    expect((await enviar(produccion, `${base(ent.id)}/registrar`, 'POST', {})).status).toBe(404);

    // Con un almacenamiento falso que guarda en el R2 local, como haría Blob.
    const firmadas: string[] = [];
    p.env.SUBIDA = {
      async firmar(_req, cuerpo, prefijo, permitida) {
        const ruta = (cuerpo as { payload: { pathname: string } }).payload.pathname;
        const clave = ruta.slice(prefijo.length + 1);
        if (!permitida(clave)) throw new Error('clave no permitida');
        firmadas.push(clave);
        return { type: 'blob.generate-presigned-url', presignedUrlPayload: { firmada: clave } };
      },
      async info(_prefijo, clave) {
        const o = await p.env.ARCHIVOS!.get(clave);
        return o ? { bytes: o.size, mime: o.httpMetadata?.contentType ?? '' } : null;
      },
    };
    try {
      const { clave } = (await (await enviar(produccion, `${base(ent.id)}/firmar`, 'POST', {})).json()) as { clave: string };
      expect(clave).toMatch(new RegExp(`^proyectos/${d.proyecto.id}/[0-9a-f-]{36}$`));
      expect((await enviar(lectura, `${base(ent.id)}/firmar`, 'POST', {})).status).toBe(403);

      const evento = (ruta: string) => ({ type: 'blob.generate-presigned-url', payload: { pathname: ruta, clientPayload: null, multipart: false } });
      const firma = await enviar(produccion, `${base(ent.id)}/firmar`, 'POST', evento(`archivos/${clave}`));
      expect(firma.status).toBe(200);
      expect(await firma.json()).toEqual({ type: 'blob.generate-presigned-url', presignedUrlPayload: { firmada: clave } });
      // Ninguna clave de otro proyecto ni fuera de proyectos/.
      expect((await enviar(produccion, `${base(ent.id)}/firmar`, 'POST', evento(`archivos/proyectos/00000000-0000-4000-8000-000000000000/${crypto.randomUUID()}`))).status).toBe(400);
      expect((await enviar(produccion, `${base(ent.id)}/firmar`, 'POST', evento('archivos/otra/cosa'))).status).toBe(400);
      expect(firmadas).toEqual([clave]);

      // Registrar antes de subir no crea nada.
      expect((await enviar(produccion, `${base(ent.id)}/registrar`, 'POST', { clave, nombre: 'foto.jpg' })).status).toBe(422);
      await p.env.ARCHIVOS!.put(clave, new TextEncoder().encode('foto subida directo'), { httpMetadata: { contentType: 'image/jpeg' } });
      expect((await enviar(produccion, `${base(ent.id)}/registrar`, 'POST', { clave: `proyectos/otro/${crypto.randomUUID()}`, nombre: 'x' })).status).toBe(422);
      d = (await (await enviar(produccion, `${base(ent.id)}/registrar`, 'POST', { clave, nombre: 'foto.jpg' })).json()) as Det;
      const archivo = d.entregables.find((e) => e.id === ent.id)!.archivos[0]!;
      expect(archivo).toMatchObject({ id: clave.split('/').at(-1), nombre: 'foto.jpg' });
      expect((await enviar(produccion, `${base(ent.id)}/registrar`, 'POST', { clave, nombre: 'foto.jpg' })).status).toBe(409);
      const bajada = await p.llamar(`/admin/api/archivos/${archivo.id}`, { headers: { cookie: lectura } });
      expect(await bajada.text()).toBe('foto subida directo');
    } finally {
      p.env.SUBIDA = undefined;
    }
  });

  test('la ficha de la organización junta proyectos y solicitudes', async () => {
    const d = (await (await p.llamar(`/admin/api/proyectos/${id}`, { headers: { cookie: admin } })).json()) as Det;
    const f = (await (await p.llamar(`/admin/api/organizaciones/${d.proyecto.organizacionId}`, { headers: { cookie: admin } })).json()) as { proyectos: unknown[]; solicitudes: { id: string }[] };
    expect(f.proyectos).toHaveLength(1);
    expect(f.solicitudes.map((s) => s.id)).toEqual([LEAD]);
    const inicio = (await (await p.llamar('/admin/api/inicio', { headers: { cookie: produccion } })).json()) as { proyectos: { activos: number } };
    expect(inicio.proyectos.activos).toBe(1);
  });

  test('suprimir la solicitud también suprime al contacto de la organización', async () => {
    await enviar(admin, `/admin/api/leads/${LEAD}/anonimizar`, 'POST');
    const c = await p.env.DB.prepare("select count(*) as n from contactos_cliente where email = 'paola@ruta5.co'").first<number>('n');
    expect(c).toBe(0);
  });

  test('un proyecto a mano exige organización y línea', async () => {
    expect((await enviar(admin, '/admin/api/proyectos', 'POST', { nombre: 'X' })).status).toBe(422);
    const org = (await (await enviar(admin, '/admin/api/organizaciones', 'POST', { nombre: 'Acme SAS' })).json()) as { organizacion: { id: string } };
    const r = await enviar(admin, '/admin/api/proyectos', 'POST', { nombre: 'Kit de bienvenida', organizacionId: org.organizacion.id, linea: 'diseno' });
    expect(((await r.json()) as Det).proyecto.codigo).toBe(codigoProyecto(new Date().getUTCFullYear(), 2));
  });
});

describe('sistema y exportaciones', () => {
  test('el estado del sistema dice qué falta configurar, sin secretos', async () => {
    const s = (await (await p.llamar('/admin/api/sistema', { headers: { cookie: lectura } })).json()) as { servicios: Record<string, boolean>; tablas: Record<string, number> };
    expect(s.servicios.correo).toBe(true);
    expect(s.servicios.publicacion).toBe(false);
    expect(s.tablas.proyectos).toBeGreaterThan(0);
    expect(JSON.stringify(s)).not.toContain('prueba');
    expect((await p.llamar('/admin/api/sistema', { headers: { cookie: produccion } })).status).toBe(403);
  });

  test('el CSV de proyectos omite el valor para quien no lo ve', async () => {
    const conValor = await (await p.llamar('/admin/api/proyectos.csv', { headers: { cookie: admin } })).text();
    const sinValor = await (await p.llamar('/admin/api/proyectos.csv', { headers: { cookie: produccion } })).text();
    expect(conValor.split('\r\n')[0]).toContain('valor');
    expect(sinValor.split('\r\n')[0]).not.toContain('valor');
    expect(sinValor).not.toContain('8500000');
  });
});
