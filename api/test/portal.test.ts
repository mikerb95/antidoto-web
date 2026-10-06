// Portal de proyectos: el cliente entra con su propio enlace y su propia cookie, ve solo lo de su
// organización y lo marcado como visible, aprueba o pide cambios y comenta.
import { describe, test, expect, beforeAll } from 'vitest';
import { prepararPruebas, APP } from './ayudas';

const p = prepararPruebas();
let admin = '';
let cliente = '';
let proyectoA = '';
let proyectoB = '';
let entregableVisible = '';
let entregableOculto = '';
let archivoVisible = '';

const enviar = (ck: string, ruta: string, metodo: string, cuerpo?: unknown) => p.conSesion(ck, ruta, { method: metodo, ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}) });

async function entrarCliente(email: string): Promise<string> {
  const antes = p.correos.length;
  await p.llamar('/portal/auth/enlace', { method: 'POST', body: JSON.stringify({ email }), headers: { origin: APP, 'content-type': 'application/json' } });
  const enlace = p.correos.slice(antes).find((c) => c.to.includes(email))?.text.match(/https:\/\/\S+/)?.[0];
  if (!enlace) throw new Error('sin enlace');
  const t = new URL(enlace).searchParams.get('t')!;
  const pag = await p.llamar(`/portal/auth/entrar?t=${encodeURIComponent(t)}`);
  expect(pag.headers.get('location')).toBe(`/portal/entrar#t=${encodeURIComponent(t)}`);
  const r = await p.llamar('/portal/auth/entrar', { method: 'POST', body: new URLSearchParams({ t }), headers: { origin: APP } });
  const set = r.headers.get('set-cookie')!;
  expect(set).toMatch(/^__Host-antidoto-cliente=.+; Path=\/; HttpOnly; Secure; SameSite=Strict/);
  return set.split(';')[0]!;
}

beforeAll(async () => {
  admin = await p.entrarComo('admin-portal@antidoto.co', 'admin');
  const crear = async (nombre: string, email: string) => {
    const org = (await (await enviar(admin, '/admin/api/organizaciones', 'POST', { nombre })).json()) as { organizacion: { id: string } };
    const f = (await (await enviar(admin, `/admin/api/organizaciones/${org.organizacion.id}/contactos`, 'POST', { nombre: 'Ana', email })).json()) as { contactos: { id: string }[] };
    const pr = (await (await enviar(admin, '/admin/api/proyectos', 'POST', { nombre: `Video para ${nombre}`, organizacionId: org.organizacion.id, linea: 'audiovisual', valor: 9000000 })).json()) as { proyecto: { id: string } };
    return { org: org.organizacion.id, contacto: f.contactos[0]!.id, proyecto: pr.proyecto.id };
  };
  const a = await crear('Cliente A', 'ana@clientea.co');
  const b = await crear('Cliente B', 'ana@clienteb.co');
  proyectoA = a.proyecto;
  proyectoB = b.proyecto;
  await enviar(admin, `/admin/api/organizaciones/${a.org}/accesos`, 'POST', { contactoId: a.contacto });
  let d = (await (await enviar(admin, `/admin/api/proyectos/${proyectoA}/entregables`, 'POST', { titulo: 'Corte final', visibleCliente: true })).json()) as { entregables: { id: string; titulo: string }[] };
  entregableVisible = d.entregables[0]!.id;
  d = (await (await enviar(admin, `/admin/api/proyectos/${proyectoA}/entregables`, 'POST', { titulo: 'Guion interno', visibleCliente: false })).json()) as typeof d;
  entregableOculto = d.entregables.find((e) => e.titulo === 'Guion interno')!.id;
  const form = new FormData();
  form.append('archivo', new File([new TextEncoder().encode('video')], 'final.mp4', { type: 'video/mp4' }));
  const sub = (await (await p.llamar(`/admin/api/entregables/${entregableVisible}/archivos`, { method: 'POST', body: form, headers: { origin: APP, cookie: admin } })).json()) as { entregables: { id: string; archivos: { id: string }[] }[] };
  archivoVisible = sub.entregables.find((e) => e.id === entregableVisible)!.archivos[0]!.id;
  await enviar(admin, `/admin/api/proyectos/${proyectoA}/bitacora`, 'POST', { texto: 'Nota interna: margen bajo', visibleCliente: false });
  cliente = await entrarCliente('ana@clientea.co');
});

describe('portal', () => {
  test('la invitación llegó por correo y un correo sin acceso no recibe enlace', async () => {
    expect(p.correos.some((c) => c.to.includes('ana@clientea.co') && c.subject.includes('portal de proyectos'))).toBe(true);
    const antes = p.correos.length;
    await p.llamar('/portal/auth/enlace', { method: 'POST', body: JSON.stringify({ email: 'ana@clienteb.co' }), headers: { origin: APP, 'content-type': 'application/json' } });
    expect(p.correos.length).toBe(antes);
  });

  test('las sesiones no se cruzan: la del cliente no abre el panel ni la del equipo el portal', async () => {
    expect((await p.llamar('/admin/api/yo', { headers: { cookie: cliente } })).status).toBe(401);
    expect((await p.llamar('/portal/api/yo', { headers: { cookie: admin } })).status).toBe(401);
    const yo = (await (await p.llamar('/portal/api/yo', { headers: { cookie: cliente } })).json()) as { organizacion: string };
    expect(yo.organizacion).toBe('Cliente A');
  });

  test('solo ve su organización y solo lo visible, sin valor ni notas internas', async () => {
    const lista = (await (await p.llamar('/portal/api/proyectos', { headers: { cookie: cliente } })).json()) as { proyectos: { id: string }[] };
    expect(lista.proyectos.map((x) => x.id)).toEqual([proyectoA]);
    expect((await p.llamar(`/portal/api/proyectos/${proyectoB}`, { headers: { cookie: cliente } })).status).toBe(404);
    const det = await (await p.llamar(`/portal/api/proyectos/${proyectoA}`, { headers: { cookie: cliente } })).text();
    expect(det).not.toContain('Guion interno');
    expect(det).not.toContain('margen bajo');
    expect(det).not.toContain('9000000');
    expect(det).not.toContain('admin-portal@antidoto.co');
  });

  test('descarga solo archivos de entregables visibles de su organización', async () => {
    const r = await p.llamar(`/portal/api/archivos/${archivoVisible}`, { headers: { cookie: cliente } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toContain('attachment');
    expect((await p.llamar(`/portal/api/archivos/${archivoVisible}`)).status).toBe(401);
  });

  test('aprobar exige que esté en revisión, queda en la bitácora y avisa al responsable', async () => {
    expect((await enviar(cliente, `/portal/api/entregables/${entregableVisible}/aprobar`, 'POST', {})).status).toBe(409);
    await enviar(admin, `/admin/api/entregables/${entregableVisible}`, 'PATCH', { estado: 'en_revision' });
    expect(p.correos.some((c) => c.to.includes('ana@clientea.co') && c.subject === 'Para revisar: Corte final')).toBe(true);
    expect((await enviar(cliente, `/portal/api/entregables/${entregableOculto}/aprobar`, 'POST', {})).status).toBe(404);
    expect((await enviar(cliente, `/portal/api/entregables/${entregableVisible}/cambios`, 'POST', {})).status).toBe(422);
    const antes = p.correos.length;
    const r = (await (await enviar(cliente, `/portal/api/entregables/${entregableVisible}/aprobar`, 'POST', {})).json()) as { entregables: { estado: string }[]; bitacora: { texto: string }[] };
    expect(r.entregables[0]!.estado).toBe('aprobado');
    expect(r.bitacora[0]!.texto).toBe('Aprobó Corte final.');
    expect(p.correos.slice(antes).some((c) => c.to.includes('admin-portal@antidoto.co'))).toBe(true);
  });

  test('cambiar algo desde otro origen se rechaza (CSRF)', async () => {
    const r = await p.llamar(`/portal/api/proyectos/${proyectoA}/comentar`, { method: 'POST', body: '{"texto":"x"}', headers: { cookie: cliente, origin: 'https://otro.com', 'content-type': 'application/json' } });
    expect(r.status).toBe(403);
    const ok = await enviar(cliente, `/portal/api/proyectos/${proyectoA}/comentar`, 'POST', { texto: '¿Podemos verlo el lunes?' });
    expect(ok.status).toBe(200);
  });

  test('quitar el acceso corta la sesión del cliente', async () => {
    const accesos = (await (await p.llamar(`/admin/api/organizaciones/${(await p.env.DB.prepare('select organizacion_id from proyectos where id = ?').bind(proyectoA).first<string>('organizacion_id'))}/accesos`, { headers: { cookie: admin } })).json()) as { accesos: { id: string }[] };
    await enviar(admin, `/admin/api/accesos/${accesos.accesos[0]!.id}/quitar`, 'POST');
    expect((await p.llamar('/portal/api/yo', { headers: { cookie: cliente } })).status).toBe(401);
  });
});
