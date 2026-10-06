// Ayudas comunes de las pruebas de punta a punta: entorno con D1 local, correos de Resend
// capturados, llamadas al Worker que esperan el trabajo diferido y sesiones del panel por rol.
import { beforeAll, afterAll, vi } from 'vitest';
import { crearEntorno } from './entorno';
import { manejar } from '../src/index';
import type { Env } from '../src/env';
import type { Rol } from '../src/dominio';

export const APP = 'https://api.test';

export interface Correo {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export interface Pruebas {
  env: Env;
  correos: Correo[];
  llamar: (ruta: string, init?: RequestInit & { ip?: string }) => Promise<Response>;
  /** Petición con sesión y Origin de la app (las que cambian algo lo exigen). */
  conSesion: (cookie: string, ruta: string, init?: RequestInit) => Promise<Response>;
  /** Crea (si hace falta) una persona del equipo con ese rol y devuelve la cookie de su sesión. */
  entrarComo: (email: string, rol?: Rol) => Promise<string>;
}

/**
 * Registra beforeAll y afterAll en el archivo que la llama. Los ganchos `interceptar` dejan
 * responder llamadas externas (Anthropic, GitHub...) antes de dejarlas pasar a la red.
 */
export function prepararPruebas(interceptar?: (url: string, init?: RequestInit) => Response | Promise<Response> | null): Pruebas {
  const p = { correos: [] as Correo[] } as Pruebas;
  let cerrar: () => Promise<void>;

  beforeAll(async () => {
    const e = await crearEntorno();
    p.env = e.env;
    cerrar = e.cerrar;
    p.env.RESEND_API_KEY = 'prueba';
    p.env.SAL_IP = 'sal';
    const real = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, init) => {
      const url = entrada instanceof Request ? entrada.url : String(entrada);
      if (url.startsWith('https://api.resend.com/')) {
        p.correos.push(JSON.parse(String(init?.body)));
        return new Response('{"id":"x"}', { status: 200 });
      }
      const propia = await interceptar?.(url, init);
      if (propia) return propia;
      return real(entrada, init);
    });
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await cerrar?.();
  });

  p.llamar = async (ruta, init = {}) => {
    const pendientes: Promise<unknown>[] = [];
    const headers = new Headers(init.headers);
    if (init.ip) headers.set('cf-connecting-ip', init.ip);
    const res = await manejar(new Request(`${APP}${ruta}`, { ...init, headers, redirect: 'manual' }), p.env, (x) => pendientes.push(x));
    await Promise.all(pendientes);
    return res;
  };

  p.conSesion = (cookie, ruta, init = {}) =>
    p.llamar(ruta, { ...init, headers: { origin: APP, cookie, ...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(init.headers as object) } });

  p.entrarComo = async (email, rol = 'admin') => {
    const existe = await p.env.DB.prepare('select id from usuarios where email = ?').bind(email).first();
    if (!existe)
      await p.env.DB.prepare('insert into usuarios (id, email, nombre, rol, activo, creado) values (?, ?, ?, ?, 1, ?)')
        .bind(crypto.randomUUID(), email, email.split('@')[0], rol, Date.now())
        .run();
    const antes = p.correos.length;
    await p.llamar('/auth/enlace', { method: 'POST', body: JSON.stringify({ email }), headers: { origin: APP, 'content-type': 'application/json' } });
    const enlace = p.correos.slice(antes).find((c) => c.to.includes(email))?.text.match(/https:\/\/\S+/)?.[0];
    if (!enlace) throw new Error(`no llegó el enlace de ${email}`);
    const t = new URL(enlace).searchParams.get('t')!;
    const r = await p.llamar('/auth/entrar', { method: 'POST', body: new URLSearchParams({ t }), headers: { origin: APP } });
    const set = r.headers.get('set-cookie');
    if (!set) throw new Error(`no abrió sesión ${email}`);
    return set.split(';')[0]!;
  };

  return p;
}
