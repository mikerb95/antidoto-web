// Acceso de desarrollo con GitHub: solo las cuentas permitidas, state atado al navegador, alta del
// usuario dev la primera vez, y esa cuenta fuera del enlace por correo y de la pantalla Equipo.
import { describe, test, expect, beforeAll } from 'vitest';
import { prepararPruebas, APP } from './ayudas';
import { consulta } from './entorno';

const DEV = 4242;
const github = { perfil: { id: DEV, login: 'Dev-Uno', name: 'Dev Uno' } as Record<string, unknown>, codigo: 'codigo-bueno', cambios: [] as Record<string, unknown>[] };

const p = prepararPruebas((url, init) => {
  if (url === 'https://github.com/login/oauth/access_token') {
    const d = JSON.parse(String(init?.body)) as Record<string, unknown>;
    github.cambios.push(d);
    return Response.json(d.code === github.codigo && d.client_secret === 'secreto-gh' ? { access_token: 'tok' } : { error: 'bad_verification_code' });
  }
  if (url === 'https://api.github.com/user') return new Headers(init?.headers).get('authorization') === 'Bearer tok' ? Response.json(github.perfil) : new Response('{}', { status: 401 });
  return null;
});

/** Empieza el flujo y devuelve el state y su cookie, como los dejaría el navegador. */
async function empezar() {
  const r = await p.llamar('/auth/github');
  const destino = new URL(r.headers.get('location')!);
  return { r, destino, estado: destino.searchParams.get('state')!, cookie: r.headers.get('set-cookie')!.split(';')[0]! };
}
const volver = (estado: string, cookie: string, codigo = github.codigo) => p.llamar(`/auth/github/callback?code=${codigo}&state=${estado}`, { headers: { cookie } });
const sesionDe = (r: Response) => r.headers.getSetCookie().find((c) => c.startsWith('__Host-antidoto='))?.split(';')[0];

describe('sin configurar', () => {
  test('no se ofrece ni se puede usar', async () => {
    expect(await (await p.llamar('/auth/opciones')).json()).toEqual({ github: false });
    expect((await p.llamar('/auth/github')).headers.get('location')).toBe('/admin/?error=github');
    expect((await p.llamar('/auth/github/callback?code=x&state=y')).headers.get('location')).toBe('/admin/?error=github');
  });
});

describe('con la OAuth App', () => {
  let sesion = '';
  beforeAll(() => {
    p.env.GITHUB_OAUTH_ID = 'cliente-gh';
    p.env.GITHUB_OAUTH_SECRET = 'secreto-gh';
    p.env.GITHUB_DEV_IDS = ` ${DEV}, no-es-id `;
  });

  test('lleva a GitHub con el cliente, el retorno y un state propio', async () => {
    expect(await (await p.llamar('/auth/opciones')).json()).toEqual({ github: true });
    const { r, destino, estado, cookie } = await empezar();
    expect(r.status).toBe(303);
    expect(destino.origin + destino.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(destino.searchParams.get('client_id')).toBe('cliente-gh');
    expect(destino.searchParams.get('redirect_uri')).toBe(`${APP}/auth/github/callback`);
    expect(destino.searchParams.get('scope')).toBeNull();
    expect(estado.length).toBeGreaterThan(30);
    expect(cookie).toBe(`__Host-antidoto-gh=${estado}`);
    expect(r.headers.get('set-cookie')).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    expect((await empezar()).estado).not.toBe(estado);
  });

  test('sin el state de este navegador no se cambia el código', async () => {
    const { estado, cookie } = await empezar();
    const antes = github.cambios.length;
    for (const r of [await p.llamar(`/auth/github/callback?code=${github.codigo}&state=${estado}`), await volver('otro-state', cookie), await volver(estado, '__Host-antidoto-gh=otro')]) {
      expect(r.headers.get('location')).toBe('/admin/?error=github');
      expect(sesionDe(r)).toBeUndefined();
    }
    expect(github.cambios.length).toBe(antes);
  });

  test('un código que GitHub no acepta no abre sesión', async () => {
    const { estado, cookie } = await empezar();
    const r = await volver(estado, cookie, 'codigo-malo');
    expect(r.headers.get('location')).toBe('/admin/?error=github');
    expect(sesionDe(r)).toBeUndefined();
  });

  test('una cuenta de GitHub que no está en la lista no entra ni queda creada', async () => {
    github.perfil = { id: 999, login: 'intruso', name: null };
    const { estado, cookie } = await empezar();
    const r = await volver(estado, cookie);
    expect(r.headers.get('location')).toBe('/admin/?error=github');
    expect(sesionDe(r)).toBeUndefined();
    expect((await consulta(p.env.DB, 'select count(*) as n from usuarios where github_id is not null').first<{ n: number }>())?.n).toBe(0);
    github.perfil = { id: DEV, login: 'Dev-Uno', name: 'Dev Uno' };
  });

  test('la cuenta permitida entra como dev, con todos los permisos, y su usuario se crea una sola vez', async () => {
    for (let i = 0; i < 2; i++) {
      const { estado, cookie } = await empezar();
      const r = await volver(estado, cookie);
      expect(r.status).toBe(303);
      expect(r.headers.get('location')).toBe('/admin/');
      expect(r.headers.getSetCookie().some((c) => c.startsWith('__Host-antidoto-gh=;'))).toBe(true);
      sesion = sesionDe(r)!;
      expect(sesion).toBeTruthy();
    }
    expect(github.cambios.at(-1)).toMatchObject({ client_id: 'cliente-gh', redirect_uri: `${APP}/auth/github/callback` });
    const yo = (await (await p.llamar('/admin/api/yo', { headers: { cookie: sesion } })).json()) as { rol: string; email: string; nombre: string; permisos: string[] };
    expect(yo).toMatchObject({ rol: 'dev', email: `${DEV}+dev-uno@users.noreply.github.com`, nombre: 'Dev Uno' });
    expect(yo.permisos).toEqual(expect.arrayContaining(['equipo.gestionar', 'config.editar', 'datos.suprimir', 'misiones.gestionar']));
    expect((await consulta(p.env.DB, 'select count(*) as n from usuarios where github_id = ?', DEV).first<{ n: number }>())?.n).toBe(1);
    const entradas = await consulta(p.env.DB, "select count(*) as n from auditoria where accion = 'sesion.entrar' and usuario_email like '%users.noreply.github.com'").first<{ n: number }>();
    expect(entradas?.n).toBe(2);
  });

  test('esa cuenta no recibe enlaces por correo', async () => {
    const antes = p.correos.length;
    await p.llamar('/auth/enlace', { method: 'POST', body: JSON.stringify({ email: `${DEV}+dev-uno@users.noreply.github.com` }), headers: { origin: APP, 'content-type': 'application/json' } });
    expect(p.correos.length).toBe(antes);
  });

  test('desde Equipo no se asigna el rol dev ni se toca una cuenta dev', async () => {
    const admin = await p.entrarComo('admin-gh@antidoto.co', 'admin');
    const enviar = (ruta: string, metodo: string, cuerpo: unknown) => p.conSesion(admin, ruta, { method: metodo, body: JSON.stringify(cuerpo) });
    const lista = (await (await enviar('/admin/api/usuarios', 'POST', { email: 'quiere-dev@antidoto.co', nombre: 'Quiere', rol: 'dev' })).json()) as { usuarios: { id: string; email: string; rol: string }[] };
    const nuevo = lista.usuarios.find((u) => u.email === 'quiere-dev@antidoto.co')!;
    expect(nuevo.rol).toBe('comercial');
    expect((await enviar(`/admin/api/usuarios/${nuevo.id}`, 'PATCH', { rol: 'dev' })).status).toBe(422);
    const dev = lista.usuarios.find((u) => u.rol === 'dev')!;
    expect((await enviar(`/admin/api/usuarios/${dev.id}`, 'PATCH', { activo: false })).status).toBe(403);
    expect((await enviar(`/admin/api/usuarios/${dev.id}`, 'PATCH', { rol: 'lectura' })).status).toBe(403);
    expect((await p.llamar('/admin/api/yo', { headers: { cookie: sesion } })).status).toBe(200);
  });

  test('quitar el id de la lista le cierra la puerta la próxima vez', async () => {
    p.env.GITHUB_DEV_IDS = '1';
    const { estado, cookie } = await empezar();
    expect(sesionDe(await volver(estado, cookie))).toBeUndefined();
  });
});
