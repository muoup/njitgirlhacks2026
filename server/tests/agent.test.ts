import { describe, expect, test } from "bun:test";
import { MockBackend, type BackendIdentity } from "../src/backend";
import { AgentService } from "../src/agent/service";
import { GeminiRunner, type AgentRunner, type RunInput } from "../src/agent/runner";
import { testVertexAuth } from "./vertex-auth";
import type { InsightOutputData, MutationData } from "../src/agent/schemas";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";

const alice: BackendIdentity = { version: "v1", userId: "alice", accountId: "alice" };
const bob: BackendIdentity = { version: "v1", userId: "bob", accountId: "bob" };
const initialTime = Date.parse("2026-10-03T12:04:00Z");
function insights(input: RunInput): InsightOutputData {
  return { gardens: input.context.gardens.map(garden => ({ gardenId: garden.garden.id, items: [],
    overviews: garden.plants.map(plant => {
      const metric = garden.histories.find(history => history.plantId === plant.id)?.metrics[0];
      const measured = Boolean(metric);
      return { plantId: plant.id, urgency: measured ? "watch" : null, headline: plant.name,
        text: measured ? "Look at the recent soil trend." : "No measurements yet.",
        evidence: metric ? [{ metric: metric.metric, unit: metric.unit, from: metric.first.at, to: metric.last.at }] : [],
        blocks: measured ? [{ type: "chart", range: "7d", metric: "soil_moisture" }] : [] };
    }),
  })) };
}
class Runner implements AgentRunner {
  calls: RunInput[] = [];
  constructor(public handle: (input: RunInput) => Promise<unknown> = async input =>
    input.mode === "scheduled" ? insights(input) : { reply: "Hello gardener." }) {}
  async run(input: RunInput) { this.calls.push(input); return this.handle(input); }
}
class RecordingBackend extends MockBackend {
  mutations: MutationData[] = [];
  changed = false;
  override async hydrateDashboard(identity: BackendIdentity, gardenId: string) {
    const dashboard = await super.hydrateDashboard(identity, gardenId);
    if (dashboard && this.changed && dashboard.plants[0]) dashboard.plants[0].name = "Renamed plant";
    return dashboard;
  }
  override async mutate(_identity: BackendIdentity, action: MutationData, _requestId: string) {
    this.mutations.push(action); // Simulated successful deletion, not used in the app entry point.
  }
}

describe("garden agent harness", () => {
  test("memory is account-scoped and concurrent revision writes cannot overwrite each other", async () => {
    const backend = new MockBackend(() => initialTime);
    const results = await Promise.allSettled([
      backend.writeMemory(alice, { markdown: "Basil is indoors.", expectedRevision: 0 }),
      backend.writeMemory(alice, { markdown: "Conflicting update.", expectedRevision: 0 }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await backend.readMemory(alice)).toMatchObject({ revision: 1, markdown: "Basil is indoors.", source: "mock" });
    expect(await backend.readMemory(bob)).toMatchObject({ revision: 0, markdown: "" });
  });

  test("chat sees all gardens, updates memory, reads skills, and only proposes mutations", async () => {
    const backend = new MockBackend(() => initialTime);
    const runner = new Runner(async input => {
      expect(input.context.gardens).toHaveLength(3);
      const memory = await input.tools.readMemory!.execute({}) as { revision: number };
      await input.tools.updateMemory!.execute({ markdown: "# Care history\n2026-10-03: User reports watering Basil.", expectedRevision: memory.revision });
      const skill = await input.tools.loadSkill!.execute({ name: "watering" }) as { markdown: string };
      expect(skill.markdown).toContain("calibration");
      await input.tools.proposeAction!.execute({ kind: "removePlant", plantId: input.context.gardens[0]!.plants[0]!.id });
      return { reply: "Please approve the proposed removal." };
    });
    const agents = new AgentService(backend, runner, () => initialTime);
    const request = { persona: "gnome" as const, message: "I watered Basil. Remove it.", requestId: "one" };
    const response = await agents.chat(alice, request);
    expect(response.pendingActions).toHaveLength(1);
    expect(response.pendingActions[0]!.status).toBe("pending");
    expect((await backend.readMemory(alice)).revision).toBe(1);
    expect((await agents.chat(alice, request)).conversationId).toBe(response.conversationId);
    expect(runner.calls).toHaveLength(1);
    await expect(agents.chat(alice, { ...request, message: "Different question" })).rejects.toMatchObject({ code: "REQUEST_CONFLICT" });
    await expect(agents.chat(bob, { ...request, conversationId: response.conversationId })).rejects.toMatchObject({ status: 404 });
    await expect(agents.decide(bob, response.pendingActions[0]!.id, "approve")).rejects.toMatchObject({ status: 404 });
    const decision = await agents.decide(alice, response.pendingActions[0]!.id, "approve");
    expect(decision.action).toMatchObject({ status: "failed", result: { code: "NOT_IMPLEMENTED" } });
  });

  test("approval executes once; cancellation, expiry, and changed targets cannot execute", async () => {
    let now = initialTime;
    const backend = new RecordingBackend(() => now);
    const runner = new Runner(async input => {
      await input.tools.proposeAction!.execute({ kind: "removePlant", plantId: input.context.gardens[0]!.plants[0]!.id });
      return { reply: "Please approve." };
    });
    const agents = new AgentService(backend, runner, () => now);
    const propose = async (requestId: string) => (await agents.chat(alice, { persona: "wizard", message: "Remove a plant", requestId })).pendingActions[0]!;
    const approved = await propose("approve");
    expect((await agents.decide(alice, approved.id, "approve")).action.status).toBe("succeeded");
    expect((await agents.decide(alice, approved.id, "approve")).action.status).toBe("succeeded");
    expect(backend.mutations).toHaveLength(1);
    const cancelled = await propose("cancel");
    expect((await agents.decide(alice, cancelled.id, "cancel")).action.status).toBe("cancelled");
    expect((await agents.decide(alice, cancelled.id, "approve")).action.status).toBe("cancelled");
    const changed = await propose("changed");
    backend.changed = true;
    expect((await agents.decide(alice, changed.id, "approve")).action).toMatchObject({ status: "failed", result: { code: "ACTION_CHANGED" } });
    const expired = await propose("expire");
    now += 11 * 60_000;
    await expect(agents.decide(alice, expired.id, "approve")).rejects.toMatchObject({ code: "ACTION_EXPIRED" });
    expect(backend.mutations).toHaveLength(1);
  });

  test("cron omits mutation tools, skips unchanged context, and forced refresh always generates", async () => {
    const backend = new RecordingBackend(() => initialTime);
    const runner = new Runner(async input => {
      expect(input.mode).toBe("scheduled");
      expect(input.tools.proposeAction).toBeUndefined();
      expect(Object.keys(input.tools)).not.toContain("mutate");
      return insights(input);
    });
    const agents = new AgentService(backend, runner, () => initialTime);
    agents.register(alice);
    await agents.tick();
    expect(runner.calls).toHaveLength(1);
    expect((await agents.refresh(alice, false)).refreshed).toBe(false);
    expect((await agents.refresh(alice, true)).refreshed).toBe(true);
    expect(runner.calls).toHaveLength(2);
    const { gardens } = await backend.listGardens(alice);
    const dashboard = (await backend.hydrateDashboard(alice, gardens[0]!.id))!;
    expect(agents.decorate(alice, dashboard.insights, dashboard)).toMatchObject({ generation: { state: "ready", model: "gemini-3.8-flash" } });
    expect(backend.mutations).toHaveLength(0);
  });

  test("invalid chart references and failures retain the last successful insight result", async () => {
    const backend = new MockBackend(() => initialTime);
    const runner = new Runner();
    const agents = new AgentService(backend, runner, () => initialTime);
    await agents.refresh(alice);
    const { gardens } = await backend.listGardens(alice);
    const dashboard = (await backend.hydrateDashboard(alice, gardens[0]!.id))!;
    const before = agents.decorate(alice, dashboard.insights);
    runner.handle = async input => {
      const output = insights(input);
      output.gardens[0]!.overviews[0]!.blocks = [{ type: "chart", range: "7d", metric: "invented" }];
      return output;
    };
    await expect(agents.refresh(alice)).rejects.toMatchObject({ code: "INVALID_AGENT_OUTPUT" });
    const after = agents.decorate(alice, dashboard.insights);
    expect(after.overviews).toEqual(before.overviews);
    expect(after.generatedAt).toBe(before.generatedAt);
    expect(after.generation?.state).toBe("failed");
    runner.handle = async () => { throw new Error("Private provider failure"); };
    await expect(agents.refresh(alice)).rejects.toMatchObject({ code: "AGENT_FAILED", message: "The mentor could not complete this run. Try again." });
  });

  test("runs cannot overlap for one account, and unconfigured chat does not fabricate replies", async () => {
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const runner = new Runner(async () => { entered(); await blocked; return { reply: "Done." }; });
    const backend = new MockBackend(() => initialTime);
    const agents = new AgentService(backend, runner, () => initialTime);
    const running = agents.chat(alice, { persona: "gnome", message: "Hello", requestId: "busy" });
    await started;
    await expect(agents.refresh(alice)).rejects.toMatchObject({ code: "AGENT_BUSY" });
    release();
    await running;
    const disabled = new AgentService(backend);
    await expect(disabled.chat(alice, { persona: "gnome", message: "Hello", requestId: "disabled" })).rejects.toMatchObject({ code: "AGENT_NOT_CONFIGURED" });
  });

  test("real SDK serialization fixes the model and medium thinking without network access", async () => {
    let requestBody: any;
    let requestURL = "";
    let requestHeaders!: Headers;
    const fetch: typeof globalThis.fetch = (async (url: any, options: any) => {
      requestURL = String(url);
      requestHeaders = new Headers(options.headers);
      requestBody = JSON.parse(options.body);
      // Reproduce Vertex's rejection of a root anyOf without type: object.
      const declarations = requestBody.tools?.flatMap((entry: any) => entry.functionDeclarations ?? []) ?? [];
      if (declarations.some((entry: any) => entry.parametersJsonSchema.type !== "object")) {
        return Response.json({ error: { code: 400, status: "INVALID_ARGUMENT", message: "Request contains an invalid argument." } }, { status: 400 });
      }
      return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify({ reply: "Hello from the mentor." }) }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 10, totalTokenCount: 11 } });
    }) as typeof globalThis.fetch;
    const agents = new AgentService(new MockBackend(() => initialTime), new GeminiRunner({ project: "test-project", location: "global" }, { fetch, googleAuthOptions: testVertexAuth }), () => initialTime);
    const previousKey = process.env.GOOGLE_VERTEX_API_KEY;
    try {
      // A stale environment key must not silently select express-mode billing.
      process.env.GOOGLE_VERTEX_API_KEY = "ignored-express-key";
      expect((await agents.chat(alice, { persona: "gnome", message: "Hello", requestId: "sdk" })).reply).toBe("Hello from the mentor.");
    } finally {
      if (previousKey === undefined) delete process.env.GOOGLE_VERTEX_API_KEY;
      else process.env.GOOGLE_VERTEX_API_KEY = previousKey;
    }
    expect(requestURL).toBe("https://aiplatform.googleapis.com/v1beta1/projects/test-project/locations/global/publishers/google/models/gemini-3.8-flash:generateContent");
    expect(requestHeaders.get("authorization")).toBe("Bearer test-access-token");
    expect(requestHeaders.has("x-goog-api-key")).toBe(false);
    const action = requestBody.tools.flatMap((entry: any) => entry.functionDeclarations ?? [])
      .find((entry: any) => entry.name === "proposeAction");
    expect(action.parametersJsonSchema.type).toBe("object");
    expect(action.parametersJsonSchema.anyOf).toHaveLength(4);
    expect(requestBody.generationConfig.thinkingConfig.thinkingLevel).toBe("medium");
    expect(requestBody.generationConfig.responseMimeType).toBe("application/json");
  });

  test("a legacy Gemini key does not enable the agent; a Cloud project needs no credentials at app construction", async () => {
    const legacy = await createApp({ config: loadConfig({ GEMINI_API_KEY: "ignored-developer-key", SEED_DEMO_ACCOUNT: "false" }) });
    expect(legacy.agents.configured).toBe(false);
    const cloud = await createApp({ config: loadConfig({ GOOGLE_VERTEX_PROJECT: "test-project", SEED_DEMO_ACCOUNT: "false" }) });
    expect(cloud.agents.configured).toBe(true);
    expect((await cloud.app.handle(new Request("http://localhost:3001/health"))).status).toBe(200);
  });

  test("timeouts retain insights and prevent a late tool from updating memory", async () => {
    const backend = new MockBackend(() => initialTime);
    const runner = new Runner();
    const agents = new AgentService(backend, runner, () => initialTime, 25);
    await agents.refresh(alice);
    let timedOut!: RunInput;
    runner.handle = async input => { timedOut = input; await new Promise(() => {}); };
    await expect(agents.refresh(alice)).rejects.toMatchObject({ code: "AGENT_TIMEOUT", status: 504 });
    expect(timedOut.signal.aborted).toBe(true);
    await expect(timedOut.tools.updateMemory!.execute({ markdown: "Late write", expectedRevision: 0 })).rejects.toThrow();
    expect((await backend.readMemory(alice)).revision).toBe(0);
    const { gardens } = await backend.listGardens(alice);
    const dashboard = (await backend.hydrateDashboard(alice, gardens[0]!.id))!;
    expect(agents.decorate(alice, dashboard.insights)).toMatchObject({ generation: { state: "failed", error: { code: "AGENT_TIMEOUT" } } });
    expect(agents.decorate(alice, dashboard.insights).overviews).toHaveLength(5);
  });

  test("scheduled memory edits do not cause a refresh loop, and failed chat cannot publish an approval", async () => {
    const backend = new MockBackend(() => initialTime);
    let proposalId = "";
    const runner = new Runner(async input => {
      if (input.mode === "scheduled") {
        await input.tools.updateMemory!.execute({ markdown: "# Observations\n2026-10-03: Sample soil trends reviewed.", expectedRevision: input.context.memory.revision });
        return insights(input);
      }
      const proposal = await input.tools.proposeAction!.execute({ kind: "createGarden", name: "Secret proposal" }) as { id: string };
      proposalId = proposal.id;
      return { reply: "" }; // Invalid output must not publish the pending action.
    });
    const agents = new AgentService(backend, runner, () => initialTime);
    await agents.refresh(alice);
    expect((await agents.refresh(alice, false)).refreshed).toBe(false);
    expect((await backend.readMemory(alice)).revision).toBe(1);
    await expect(agents.chat(alice, { persona: "gnome", message: "Create a garden", requestId: "invalid" })).rejects.toMatchObject({ code: "INVALID_AGENT_OUTPUT" });
    await expect(agents.decide(alice, proposalId, "approve")).rejects.toMatchObject({ status: 404 });
  });

  test("HTTP routes protect forced refresh, publish generated overviews, and document approvals", async () => {
    const runner = new Runner();
    const { app } = await createApp({ config: loadConfig({}), agentRunner: runner });
    const origin = "http://localhost:3000";
    const post = (path: string, body: object, cookie?: string, requestOrigin = origin) => app.handle(new Request(`http://localhost:3001${path}`, {
      method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
    }));
    expect((await post("/api/v1/insights/refresh", {})).status).toBe(401);
    const signup = await post("/api/auth/sign-up/email", { name: "Agent Tester", email: "agent-http@example.com", password: "TestPassword2026!" });
    const cookie = signup.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    expect((await post("/api/v1/insights/refresh", {}, cookie, "https://untrusted.example")).status).toBe(403);
    const refreshed = await post("/api/v1/insights/refresh", {}, cookie);
    expect(refreshed.status).toBe(200);
    const result = await refreshed.json();
    expect(result.gardenIds).toHaveLength(3);
    expect((await post("/api/v1/insights/refresh", {}, cookie)).status).toBe(200);
    expect(runner.calls).toHaveLength(2);
    const dashboard = await (await app.handle(new Request(`http://localhost:3001/api/v1/dashboard?gardenId=${result.gardenIds[0]}`, { headers: { Cookie: cookie } }))).json();
    expect(dashboard.insights.overviews).toHaveLength(5);
    expect(dashboard.insights.generation.state).toBe("ready");
    const chat = await post("/api/v1/chat", { persona: "wizard", message: "How are my plants?", requestId: "http-chat" }, cookie);
    expect(chat.status).toBe(200);
    expect((await chat.json()).reply).toBe("Hello gardener.");
    expect((await post("/api/v1/chat", { persona: "wizard", message: " ", requestId: "bad" }, cookie)).status).toBe(422);
    const spec = await (await app.handle(new Request("http://localhost:3001/openapi/json"))).json();
    for (const path of ["/api/v1/chat", "/api/v1/chat/actions/{id}/decision", "/api/v1/insights/refresh"]) {
      expect(spec.paths[path].post.security).toEqual([{ bffSession: [] }]);
      expect(spec.paths[path].post.responses["503"]).toBeDefined();
    }
  });
});
