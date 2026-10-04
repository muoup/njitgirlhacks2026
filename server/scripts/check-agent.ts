import { generateText } from "ai";
import { loadConfig } from "../src/config";
import { createGeminiModel, geminiProviderOptions } from "../src/agent/runner";
import { ApiError } from "../src/errors";
import { logFailure } from "../src/diagnostics";

// Explicit manual check only: one small billable request, no account data/tools.
try {
  const { agent } = loadConfig();
  if (!agent.project) throw new ApiError(503, "AGENT_NOT_CONFIGURED", "Set GOOGLE_VERTEX_PROJECT.");
  console.log(`Checking Vertex AI: project=${agent.project}, location=${agent.location}, model=gemini-3.8-flash`);
  const result = await generateText({
    model: createGeminiModel({ project: agent.project, location: agent.location }),
    providerOptions: geminiProviderOptions,
    prompt: "Reply with OK.", maxOutputTokens: 1024, maxRetries: 0,
    abortSignal: AbortSignal.timeout(30_000),
  });
  console.log(JSON.stringify({ connected: true, finishReason: result.finishReason, usage: result.usage }));
  console.log("Cloud API access succeeded. Check Cloud Billing reports to confirm welcome-credit application.");
} catch (error) {
  logFailure(error, { scope: "agent-check" });
  process.exitCode = 1;
}
