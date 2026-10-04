import { createApp } from "./app";
import { loadConfig } from "./config";
import { startScheduler } from "./agent/scheduler";
import { createPool, authDatabase, checkDatabase } from "./storage/database";
import { PostgresBackend } from "./storage/postgres-backend";
import { logFailure } from "./diagnostics";

const config = loadConfig();
const pool = config.database ? createPool(config.database) : undefined;
if (pool) {
  try { await checkDatabase(pool); }
  catch (error) {
    logFailure(error, { scope: "database-startup" });
    console.error("Database startup failed. Run bun run db:check and consult server/TIGER_SETUP.md.");
    await pool.end(); process.exit(1);
  }
}
const { app, agents } = await createApp({ config,
  ...(pool && config.database ? { backend: new PostgresBackend(pool, config.database.encryptionKey), authDatabase: authDatabase(pool) } : {}) });
app.listen({ port: config.port, maxRequestBodySize: 16 * 1024 });
// Bun hot reload reexecutes the entry point; retire its previous worker/listeners.
const runtime = globalThis as typeof globalThis & { groveAgentCleanup?: () => void };
runtime.groveAgentCleanup?.();
const stopScheduler = config.agent.scheduleEnabled && agents.configured ? startScheduler(agents) : () => {};
async function shutdown() { stopScheduler(); await app.stop(); await pool?.end(); process.exit(0); }
const onShutdown = () => { void shutdown(); };
process.once("SIGTERM", onShutdown);
process.once("SIGINT", onShutdown);
runtime.groveAgentCleanup = () => {
  stopScheduler(); process.off("SIGTERM", onShutdown); process.off("SIGINT", onShutdown);
  void pool?.end();
};

console.log(`Grove BFF: ${config.baseURL}`);
console.log(`OpenAPI: ${config.baseURL}/openapi`);
console.log(pool
  ? "PostgreSQL storage configured: durable auth, garden data, readings, memory, and insights."
  : "Scaffold auth is in memory; dashboard responses are fixtures and state disappears on restart.");
console.log(`Garden mentor: ${agents.configured ? `Vertex AI / Gemini 3.8 Flash / medium (project: ${config.agent.project}, location: ${config.agent.location}; credentials checked on first request)` : "disabled (set GOOGLE_VERTEX_PROJECT and configure Google Application Default Credentials)"}`);
