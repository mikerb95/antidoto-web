// La API en Vercel (src/plataforma/): adaptadores de D1 sobre libSQL y de ASSETS sobre el disco,
// la ruta original de la función, la IP real y los [vars] de wrangler.toml.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { assetsDesdeDisco } from '../src/plataforma/assets-fs';
import { urlOriginal } from '../src/plataforma/entrada-node';
import { d1DesdeLibsql } from '../src/plataforma/libsql-d1';
import { VARS, conIpDeVercel, entornoVercel, manejarVercel } from '../src/plataforma/vercel';

const base = () => d1DesdeLibsql(createClient({ url: `file:${join(mkdtempSync(join(tmpdir(), 'antidoto-plat-')), 'p.db')}` }));

describe('D1 sobre libSQL', () => {
  it('responde como D1 en first, raw, run y all', async () => {
    const db = base();
    await db.prepare('create table t (id integer primary key, nombre text)').run();
    const r = await db.prepare('insert into t (nombre) values (?1), (?1)').bind('a').run();
    expect(r.meta.changes).toBe(2);
    expect(r.meta.last_row_id).toBe(2);
    expect(await db.prepare('select count(*) n from t').first('n')).toBe(2);
    expect(await db.prepare('select * from t where id = ?').bind(1).first()).toEqual({ id: 1, nombre: 'a' });
    expect(await db.prepare('select * from t where id = ?').bind(9).first()).toBeNull();
    expect(await db.prepare('select id, nombre from t order by id').raw()).toEqual([
      [1, 'a'],
      [2, 'a'],
    ]);
    expect(await db.prepare('select id from t order by id').raw({ columnNames: true })).toEqual([['id'], [1], [2]]);
    expect((await db.prepare('select id from t').all()).results).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('corre el lote en una transacción, como D1', async () => {
    const db = base();
    await db.prepare('create table t (id integer primary key)').run();
    await expect(db.batch([db.prepare('insert into t (id) values (1)'), db.prepare('insert into t (id) values (1)')])).rejects.toThrow();
    expect(await db.prepare('select count(*) n from t').first('n')).toBe(0);
  });
});

describe('API en Vercel', () => {
  it('recupera la ruta original de la función', () => {
    expect(urlOriginal('api.x', '/index?__ruta=admin/api/leads&q=1').href).toBe('https://api.x/admin/api/leads?q=1');
    expect(urlOriginal('api.x', '/index?__ruta=').pathname).toBe('/');
    expect(urlOriginal('api.x', '/v1/leads?__ruta=v1/leads').pathname).toBe('/v1/leads');
    expect(urlOriginal('api.x', '/v1/leads').pathname).toBe('/v1/leads');
  });

  it('toma la IP de la plataforma, nunca la que manda el cliente', () => {
    const r = conIpDeVercel(new Request('https://api.x/', { headers: { 'cf-connecting-ip': '6.6.6.6', 'x-real-ip': '1.2.3.4' } }));
    expect(r.headers.get('cf-connecting-ip')).toBe('1.2.3.4');
    expect(conIpDeVercel(new Request('https://api.x/', { headers: { 'cf-connecting-ip': '6.6.6.6' } })).headers.get('cf-connecting-ip')).toBeNull();
  });

  it('usa los mismos [vars] de wrangler.toml', () => {
    const toml = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8');
    const vars = Object.fromEntries([...toml.split('[vars]')[1]!.matchAll(/^([A-Z_]+) = "(.*)"$/gm)].map((m) => [m[1], m[2]]));
    expect(VARS).toEqual(vars);
  });

  it('arma el Env con Turso, Blob y las variables de Vercel', () => {
    const p = { TURSO_DATABASE_URL: 'libsql://x.turso.io', BLOB_STORE_ID: 's', ORIGENES: 'https://a.co', SAL_IP: 'sal' };
    const e = entornoVercel(p);
    expect(e.ORIGENES).toBe('https://a.co');
    expect(e.SAL_IP).toBe('sal');
    expect(e.MAIL_FROM).toBe(VARS.MAIL_FROM);
    expect(e.MEDIOS && e.ARCHIVOS && e.SUBIDA).toBeTruthy();
    expect(entornoVercel({ TURSO_DATABASE_URL: 'libsql://x.turso.io' }).SUBIDA).toBeUndefined();
    expect(() => entornoVercel({})).toThrow('TURSO_DATABASE_URL');
  });

  it('los crons piden el secreto de Vercel Cron', async () => {
    const antes = { ...process.env };
    process.env.CRON_SECRET = 'secreto';
    try {
      expect((await manejarVercel(new Request('https://api.x/cron/cinco'))).status).toBe(401);
      expect((await manejarVercel(new Request('https://api.x/cron/hora', { headers: { authorization: 'Bearer otro' } }))).status).toBe(401);
    } finally {
      process.env = antes;
    }
  });
});

describe('Panel desde el disco', () => {
  const assets = assetsDesdeDisco(fileURLToPath(new URL('../dist-admin', import.meta.url)));

  it('sirve los archivos construidos con su tipo', async () => {
    const r = await assets.fetch(new Request('https://api.x/admin/index.html'));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
  });

  it('no sale de dist-admin', async () => {
    expect((await assets.fetch(new Request('https://api.x/admin/%2e%2e/%2e%2e/package.json'))).status).toBe(404);
    expect((await assets.fetch(new Request('https://api.x/admin/no-existe.js'))).status).toBe(404);
  });
});
