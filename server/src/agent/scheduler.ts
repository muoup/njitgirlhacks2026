import type { AgentService } from "./service";
import { logFailure } from "../diagnostics";

// Only the listening entry point starts this worker; app factories and docs do not.
export function startScheduler(agents: AgentService) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await agents.tick(); } catch (error) { logFailure(error, { scope: "scheduled-insights" }); } finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, 30 * 60_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
