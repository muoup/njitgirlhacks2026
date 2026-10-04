import { createApp } from "./app";
import { loadConfig } from "./config";
import { startScheduler } from "./agent/scheduler";

const config = loadConfig();
const { app, agents } = await createApp({ config });
app.listen(config.port);
// Bun hot reload reexecutes the entry point; retire its previous worker/listeners.
const runtime = globalThis as typeof globalThis & { groveAgentCleanup?: () => void };
runtime.groveAgentCleanup?.();
const stopScheduler = config.agent.scheduleEnabled && agents.configured ? startScheduler(agents) : () => {};
async function shutdown() { stopScheduler(); await app.stop(); process.exit(0); }
const onShutdown = () => { void shutdown(); };
process.once("SIGTERM", onShutdown);
process.once("SIGINT", onShutdown);
runtime.groveAgentCleanup = () => {
  stopScheduler(); process.off("SIGTERM", onShutdown); process.off("SIGINT", onShutdown);
};

console.log(`Grove BFF: ${config.baseURL}`);
console.log(`OpenAPI: ${config.baseURL}/openapi`);
console.log(config.production && !config.allowDemoInProduction
  ? "Production adapters configured."
  : "Scaffold auth is in memory; dashboard responses are fixtures and state disappears on restart.");
console.log(`Garden mentor: ${agents.configured ? `Vertex AI / Gemini 3.8 Flash / medium (project: ${config.agent.project}, location: ${config.agent.location}; credentials checked on first request)` : "disabled (set GOOGLE_VERTEX_PROJECT and configure Google Application Default Credentials)"}`);
