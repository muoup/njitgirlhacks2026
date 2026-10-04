import { Pool, type PoolClient } from "pg";
import { readFile } from "node:fs/promises";
import { PostgresDialect } from "kysely";
import type { Config } from "../config";
import { logFailure } from "../diagnostics";

export function createPool(config: NonNullable<Config["database"]>) {
  // Honor the provider's SSL/CA parameters; don't substitute an unverified TLS config.
  const pool = new Pool({ connectionString: config.url, max: 10, connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000, statement_timeout: 15_000, application_name: "grove" });
  pool.on("error", error => logFailure(error, { scope: "database-pool" }));
  return pool;
}
export const authDatabase = (pool: Pool) => ({ dialect: new PostgresDialect({ pool }), type: "postgres" as const, schemaName: "auth" });

export async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export const migrationNames = ["001_auth.sql", "002_domain.sql", "003_reading_color.sql", "004_garden_place.sql"];
export async function migrate(pool: Pool) {
  return transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(784516239)");
    await client.query("CREATE SCHEMA IF NOT EXISTS grove");
    await client.query("CREATE TABLE IF NOT EXISTS grove.migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const name of migrationNames) {
      if ((await client.query("SELECT 1 FROM grove.migrations WHERE name=$1", [name])).rowCount) continue;
      await client.query(await readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
      await client.query("INSERT INTO grove.migrations(name) VALUES($1)", [name]);
      console.log(`Applied ${name}`);
    }
  });
}

export async function checkDatabase(pool: Pool) {
  const tables = ["auth.user", "auth.session", "auth.account", "auth.verification", "grove.gardens", "grove.plants",
    "grove.devices", "grove.device_keys", "grove.sensor_readings", "grove.ingest_receipts", "grove.memories", "grove.agent_accounts", "grove.mutations"];
  const { rows } = await pool.query("SELECT name, to_regclass(name) IS NOT NULL AS present FROM unnest($1::text[]) AS name", [tables]);
  const missing = "Database migrations are missing. Run bun run db:migrate before starting the server.";
  if (rows.some(row => !row.present)) throw new Error(missing);
  const applied = new Set((await pool.query("SELECT name FROM grove.migrations")).rows.map(row => row.name));
  if (migrationNames.some(name => !applied.has(name))) throw new Error(missing);
  return { connected: true, schemaReady: true,
    timescale: (await pool.query("SELECT extversion FROM pg_extension WHERE extname='timescaledb'")).rows[0]?.extversion ?? null };
}
