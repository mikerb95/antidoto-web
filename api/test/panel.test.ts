// El Worker sirve el panel (dist-admin/) con su CSP: index.html para cualquier ruta de la
// interfaz y archivos con hash para siempre. La API del panel sigue exigiendo sesión.
import { describe, test, expect, beforeAll } from 'vitest';
import { prepararPruebas } from './ayudas';
import { CSP_PANEL } from '../src/panel';

const p = prepararPruebas();

beforeAll(() => {
  // ASSETS falso: index.html y un archivo; lo demás no existe.
  p.env.ASSETS = {
    fetch: async (entrada: RequestInfo | URL) => {
      const ruta = new URL(entrada instanceof Request ? entrada.url : String(entrada)).pathname;
      if (ruta === '/admin/index.html') return new Response('<!doctype html><div id="app"></div>', { headers: { 'content-type': 'text/html' } });
      if (ruta === '/admin/portal.html') return new Response('<!doctype html><title>Portal</title><div id="app"></div>', { headers: { 'content-type': 'text/html' } });
      if (ruta === '/admin/assets/index-abc.js') return new Response('console.log(1)', { headers: { 'content-type': 'text/javascript' } });
      return new Response('no', { status: 404 });
    },
  } as unknown as Fetcher;
});

describe('panel', () => {
  test('cualquier ruta de la interfaz devuelve index.html con la CSP y sin caché', async () => {
    for (const ruta of ['/admin/', '/admin/solicitudes/00000000-0000-4000-8000-000000000000', '/admin/entrar']) {
      const r = await p.llamar(ruta);
      expect(r.status).toBe(200);
      expect(await r.text()).toContain('id="app"');
      expect(r.headers.get('content-security-policy')).toBe(CSP_PANEL);
      expect(r.headers.get('cache-control')).toBe('no-cache');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
    }
  });

  test('el portal de clientes sirve su propia página con la misma CSP', async () => {
    const r = await p.llamar('/portal/proyectos/00000000-0000-4000-8000-000000000000');
    expect(await r.text()).toContain('<title>Portal</title>');
    expect(r.headers.get('content-security-policy')).toBe(CSP_PANEL);
    expect((await p.llamar('/portal/api/yo')).status).toBe(401);
  });

  test('la CSP no deja scripts ni estilos en línea ni recursos de fuera', () => {
    expect(CSP_PANEL).toContain("script-src 'self'");
    expect(CSP_PANEL).toContain("style-src 'self'");
    expect(CSP_PANEL).toContain("frame-ancestors 'none'");
    expect(CSP_PANEL).not.toContain('unsafe');
  });

  test('los archivos con hash se guardan para siempre y los que faltan dan 404', async () => {
    const r = await p.llamar('/admin/assets/index-abc.js');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toContain('immutable');
    expect(r.headers.get('content-security-policy')).toBe(CSP_PANEL);
    expect((await p.llamar('/admin/assets/otro.js')).status).toBe(404);
  });

  test('la API y el CSV no se confunden con la interfaz', async () => {
    expect((await p.llamar('/admin/api/yo')).status).toBe(401);
    expect((await p.llamar('/admin/leads.csv')).status).toBe(401);
  });

  test('sin el panel construido responde 503 claro', async () => {
    const assets = p.env.ASSETS;
    p.env.ASSETS = undefined;
    const r = await p.llamar('/admin/');
    p.env.ASSETS = assets;
    expect(r.status).toBe(503);
  });
});

describe('inicio y buscador', () => {
  test('inicio muestra solo los bloques del rol', async () => {
    const contenido = await p.entrarComo('contenido-inicio@antidoto.co', 'contenido');
    const d = (await (await p.llamar('/admin/api/inicio', { headers: { cookie: contenido } })).json()) as Record<string, unknown>;
    expect(d).not.toHaveProperty('leads');
    expect(d).toHaveProperty('novedades');
    const admin = await p.entrarComo('admin-inicio@antidoto.co', 'admin');
    const a = (await (await p.llamar('/admin/api/inicio', { headers: { cookie: admin } })).json()) as { leads: { sinRespuesta: number } };
    expect(a.leads.sinRespuesta).toEqual(expect.any(Number));
  });

  test('el buscador respeta los permisos', async () => {
    const t = Date.now();
    await p.env.DB.prepare("insert into leads (id, creado, actualizado, estado, servicio, nombre, empresa, locale) values ('00000000-0000-4000-8000-0000000000b1', ?, ?, 'nuevo', 'catering', 'Zacarías Buscable', 'Zeta SAS', 'es')")
      .bind(t, t)
      .run();
    const admin = await p.entrarComo('admin-inicio@antidoto.co', 'admin');
    const r = (await (await p.llamar('/admin/api/buscar?q=Zacar', { headers: { cookie: admin } })).json()) as { resultados: { tipo: string; href: string }[] };
    expect(r.resultados).toContainEqual(expect.objectContaining({ tipo: 'lead', href: '/admin/solicitudes/00000000-0000-4000-8000-0000000000b1' }));
    const contenido = await p.entrarComo('contenido-inicio@antidoto.co', 'contenido');
    const c = (await (await p.llamar('/admin/api/buscar?q=Zacar', { headers: { cookie: contenido } })).json()) as { resultados: { tipo: string }[] };
    expect(c.resultados.filter((x) => x.tipo === 'lead')).toHaveLength(0);
  });
});
