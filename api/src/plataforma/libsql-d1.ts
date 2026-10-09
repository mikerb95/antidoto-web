// Base de datos en Vercel: Turso (libSQL) detrás de la misma interfaz que D1. Drizzle (drizzle-orm/d1)
// y las consultas crudas de src/marketing/envios.ts usan solo prepare().bind() con all(), first(),
// raw() y run(), y batch(); con eso el resto de la API no cambia. Las dos son SQLite, así que las
// migraciones y el SQL son los mismos.
import type { Client, InStatement, ResultSet, Row } from '@libsql/client';

type Valor = null | number | bigint | string | ArrayBuffer | Uint8Array | boolean;

/** libSQL entrega BLOB como ArrayBuffer y enteros grandes como bigint; D1 da number. */
function valor(v: unknown): unknown {
  if (typeof v === 'bigint') return Number(v);
  return v;
}

function objetos(rs: ResultSet): Record<string, unknown>[] {
  return rs.rows.map((fila: Row) => {
    const o: Record<string, unknown> = {};
    rs.columns.forEach((col, i) => (o[col] = valor(fila[i])));
    return o;
  });
}

function filas(rs: ResultSet): unknown[][] {
  return rs.rows.map((fila: Row) => rs.columns.map((_, i) => valor(fila[i])));
}

function resultado(rs: ResultSet) {
  return {
    success: true as const,
    results: objetos(rs),
    meta: {
      changes: rs.rowsAffected,
      last_row_id: rs.lastInsertRowid === undefined ? 0 : Number(rs.lastInsertRowid),
      changed_db: rs.rowsAffected > 0,
      duration: 0,
      rows_read: 0,
      rows_written: rs.rowsAffected,
      size_after: 0,
    },
  };
}

/** D1 acepta undefined como null y booleanos como 0/1. */
function argumento(v: unknown): Valor {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as Valor;
}

class Sentencia {
  constructor(
    private readonly cliente: Client,
    readonly sql: string,
    readonly args: Valor[] = [],
  ) {}

  bind(...valores: unknown[]): Sentencia {
    return new Sentencia(this.cliente, this.sql, valores.map(argumento));
  }

  get instruccion(): InStatement {
    return { sql: this.sql, args: this.args };
  }

  async all() {
    return resultado(await this.cliente.execute(this.instruccion));
  }

  async run() {
    return resultado(await this.cliente.execute(this.instruccion));
  }

  async raw(opciones?: { columnNames?: boolean }) {
    const rs = await this.cliente.execute(this.instruccion);
    return opciones?.columnNames ? [rs.columns, ...filas(rs)] : filas(rs);
  }

  async first<T = Record<string, unknown>>(columna?: string): Promise<T | null> {
    const [fila] = objetos(await this.cliente.execute(this.instruccion));
    if (!fila) return null;
    return (columna ? fila[columna] : fila) as T;
  }
}

/** Adaptador de un cliente de libSQL a la parte de D1Database que usa la API. */
export function d1DesdeLibsql(cliente: Client): D1Database {
  const db = {
    prepare: (sql: string) => new Sentencia(cliente, sql),
    // D1 corre el lote en una transacción: si una sentencia falla, ninguna queda.
    batch: async (sentencias: Sentencia[]) => (await cliente.batch(sentencias.map((s) => s.instruccion), 'write')).map(resultado),
    exec: async (sql: string) => {
      await cliente.executeMultiple(sql);
      return { count: 0, duration: 0 };
    },
    dump: () => Promise.reject(new Error('dump no está disponible en libSQL')),
    withSession: () => db,
  };
  return db as unknown as D1Database;
}
