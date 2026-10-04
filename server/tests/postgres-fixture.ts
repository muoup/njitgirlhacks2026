import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";

// Real PostgreSQL SQL/constraints, in memory for tests only. Production always
// uses pg.Pool over the wire. Serialize connections: PGlite has one connection.
export async function postgresFixture() {
  const database = await PGlite.create();
  let tail = Promise.resolve();
  async function acquire() {
    let release!: () => void;
    const previous = tail;
    tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    return release;
  }
  async function query(text: string, values?: unknown[]) {
    const result = values ? await database.query(text, values) : (await database.exec(text)).at(-1)!;
    return { rows: result.rows ?? [], rowCount: result.affectedRows || result.rows?.length || 0,
      command: text.trim().split(/\s/)[0], fields: result.fields ?? [] };
  }
  const pool = {
    async connect() {
      const release = await acquire();
      return { query, release, on() {}, off() {}, removeListener() {} };
    },
    async query(text: string, values?: unknown[]) {
      const release = await acquire();
      try { return await query(text, values); } finally { release(); }
    },
    async end() { await database.close(); }, on() {},
  } as unknown as Pool;
  return { pool, database };
}
