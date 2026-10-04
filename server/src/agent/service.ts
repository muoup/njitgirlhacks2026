import { t, type TSchema, type Static } from "elysia";
import { Value } from "@sinclair/typebox/value";
import type { BackendAdapter, BackendIdentity } from "../backend";
import type { DashboardData, InsightsData } from "../schemas";
import { DomainService } from "../domain";
import { ApiError } from "../errors";
import { logFailure } from "../diagnostics";
import { buildContext, revision, type AccountContext } from "./context";
import { readSkill, skillNames } from "./skills";
import { LIMITS, proseProblems } from "./writing";
import { describeBlock, publishable } from "./blocks";
import type { AgentRunner, AgentTool, RunInput } from "./runner";
import * as s from "./schemas";

const HOUR = 3_600_000;
interface Conversation {
  accountId: string; updatedAt: number;
  history: RunInput["history"];
}
interface ActionRecord {
  accountId: string; fingerprint: string; public: s.PendingActionData;
}
interface Cache {
  revision: string; generatedAt: number; dirty: boolean;
  gardens: Map<string, { insights: InsightsData; fingerprint: string }>;
}
const accountIds = (context: AccountContext) =>
  context.gardens.flatMap(item => [item.garden.id, ...item.plants.map(plant => plant.id), ...item.devices.map(device => device.id)]);

/**
 * The order of a garden's stops as generated, or nothing when the page should decide. An
 * order is kept only if every plant has exactly one place, the plants that call for someone
 * each have a stop of their own ahead of everything else, and no kind of group repeats.
 */
function trail(layout: s.InsightOutputData["gardens"][number]["layout"], overviews: s.OverviewData[]): s.StopData[] | undefined {
  if (!layout?.length) return undefined;
  const stops: s.StopData[] = [];
  const placed = new Set<string>();
  const place = (plantId: string) => overviews.some(overview => overview.plantId === plantId) && !placed.has(plantId) && Boolean(placed.add(plantId));
  for (const stop of layout) {
    if (stop.type === "plant") {
      if (!stop.plantId || !place(stop.plantId)) return undefined;
      stops.push({ type: "plant", plantId: stop.plantId });
    } else if (stop.type === "calm-plants") {
      if (!stop.plantIds?.length || stops.some(item => item.type === "calm-plants") || !stop.plantIds.every(place)) return undefined;
      stops.push({ type: "calm-plants", plantIds: stop.plantIds });
    } else {
      if (stops.some(item => item.type === "garden-notes")) return undefined;
      stops.push({ type: "garden-notes" });
    }
  }
  if (placed.size !== overviews.length) return undefined;
  const calls = overviews.filter(overview => overview.urgency === "act");
  const first = stops.slice(0, calls.length);
  if (!calls.every(overview => first.some(stop => stop.type === "plant" && stop.plantId === overview.plantId))) return undefined;
  // The garden's own notes are always reachable.
  return stops.some(stop => stop.type === "garden-notes") ? stops : [...stops, { type: "garden-notes" }];
}

const gardenFingerprint = (garden: Pick<AccountContext["gardens"][number], "garden" | "plants" | "devices" | "latestReadings">) =>
  JSON.stringify({ garden: garden.garden, plants: garden.plants, devices: garden.devices, latestReadings: garden.latestReadings });

export class AgentService {
  private readonly domain: DomainService;
  private readonly conversations = new Map<string, Conversation>();
  private readonly actions = new Map<string, ActionRecord>();
  private readonly replies = new Map<string, { input: string; response: s.ChatResponseData; at: number }>();
  private readonly identities = new Map<string, { identity: BackendIdentity; at: number }>();
  private readonly cache = new Map<string, Cache>();
  private readonly failures = new Map<string, { at: number; error: { code: string; message: string } }>();
  private readonly attempts = new Map<string, number>();
  private readonly busy = new Set<string>();
  private readonly refreshing = new Set<string>();
  private readonly activities = new Map<string, s.ActivityData>();

  constructor(private readonly backend: BackendAdapter, private readonly runner?: AgentRunner,
    private readonly clock: () => number = Date.now, private readonly timeoutMs = 60_000) {
    this.domain = new DomainService(backend);
  }

  get configured() { return Boolean(this.runner); }
  invalidate(identity: BackendIdentity) { this.cache.delete(identity.accountId); }
  /** The tool this account's run called last, or nothing when no run is under way or it has called none. */
  activity(identity: BackendIdentity) { return this.activities.get(identity.accountId) ?? null; }

  register(identity: BackendIdentity) {
    this.cleanup();
    if (!this.identities.has(identity.accountId) && this.identities.size >= 1000) {
      throw new ApiError(429, "ACCOUNT_LIMIT", "The development agent registry is full.");
    }
    this.identities.set(identity.accountId, { identity, at: this.clock() });
  }

  private cleanup() {
    const now = this.clock();
    for (const [id, conversation] of this.conversations) {
      if (now - conversation.updatedAt > HOUR && !this.busy.has(conversation.accountId)) this.conversations.delete(id);
    }
    for (const [id, reply] of this.replies) if (now - reply.at > HOUR) this.replies.delete(id);
    for (const [id, action] of this.actions) {
      if (Date.parse(action.public.expiresAt) < now && action.public.status === "pending") action.public.status = "expired";
      if (now - Date.parse(action.public.expiresAt) > HOUR && !this.busy.has(action.accountId)) this.actions.delete(id);
    }
    for (const [id, entry] of this.identities) {
      if (now - entry.at > 24 * HOUR && !this.busy.has(id)) {
        this.identities.delete(id); this.cache.delete(id); this.failures.delete(id); this.attempts.delete(id);
      }
    }
  }

  private async exclusive<T>(identity: BackendIdentity, work: () => Promise<T>): Promise<T> {
    if (this.busy.has(identity.accountId)) throw new ApiError(409, "AGENT_BUSY", "The mentor is already working for this account. Try again shortly.");
    if (this.busy.size >= 4) throw new ApiError(429, "AGENT_BUSY", "The mentors are busy. Try again shortly.");
    this.busy.add(identity.accountId);
    try { return await work(); } finally { this.busy.delete(identity.accountId); }
  }

  private async run(input: Omit<RunInput, "signal" | "tools">, identity: BackendIdentity,
    proposed: ActionRecord[], conversationId?: string) {
    if (!this.runner) throw new ApiError(503, "AGENT_NOT_CONFIGURED", "Set GOOGLE_VERTEX_PROJECT and configure Google Application Default Credentials on the BFF to enable the mentor.");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let calls = 0;
    const definition = <S extends TSchema>(description: string, schema: S, execute: (input: Static<S>) => Promise<unknown>): AgentTool => ({
      description, schema,
      execute: async args => {
        controller.signal.throwIfAborted();
        if (++calls > 32) throw new ApiError(429, "TOOL_LIMIT", "The agent tool limit was reached.");
        if (!Value.Check(schema, args)) throw new ApiError(422, "INVALID_REQUEST", "Invalid tool arguments.");
        try { return await execute(args); } catch (error) {
          if (error instanceof ApiError) return { error: { code: error.code, message: error.message } };
          throw error;
        }
      },
    });
    const tools: Record<string, AgentTool> = {
      listGardens: definition("List all account gardens.", t.Object({}), async () => input.context.gardens.map(item => item.garden)),
      inspectGarden: definition("Read plants, devices, latest readings, and history summaries for a garden.",
        t.Object({ gardenId: t.String() }), async ({ gardenId }) => {
          const garden = input.context.gardens.find(item => item.garden.id === gardenId);
          if (!garden) throw new ApiError(404, "NOT_FOUND", "Garden not found.");
          return garden;
        }),
      getReadings: definition("Read a plant's samples for an ordered ISO range of at most seven days.",
        t.Object({ plantId: t.String(), from: t.String({ format: "date-time" }), to: t.String({ format: "date-time" }) }),
        async ({ plantId, from, to }) => {
          if (Date.parse(from) > Date.parse(to) || Date.parse(to) - Date.parse(from) > 7 * 86_400_000) {
            throw new ApiError(400, "INVALID_RANGE", "Use an ordered range of at most seven days.");
          }
          const readings = await this.backend.getReadings(identity, plantId, { from, to });
          if (!readings) throw new ApiError(404, "NOT_FOUND", "Plant not found.");
          return readings;
        }),
      readMemory: definition("Read the account's MEMORY.md and current revision.", t.Object({}), async () => {
        input.context.memory = await this.backend.readMemory(identity);
        return input.context.memory;
      }),
      updateMemory: definition("Replace MEMORY.md using its current revision. Dates and provenance are required by the memory skill.",
        s.MemoryWrite, async args => {
          controller.signal.throwIfAborted();
          const memory = await this.backend.writeMemory(identity, args);
          input.context.memory = memory;
          const cached = this.cache.get(identity.accountId);
          if (cached) cached.dirty = true;
          return memory;
        }),
    };
    // A scheduled run is given every skill in its instructions.
    if (input.mode === "chat") {
      tools.loadSkill = definition("Read a prewritten care or memory skill.", t.Object({ name: t.Union(skillNames.map(name => t.Literal(name))) }),
        async ({ name }) => ({ name, markdown: await readSkill(name) }));
    }
    if (input.mode === "chat" && conversationId) {
      tools.proposeAction = definition("Propose ONE garden/plant addition or removal for a user's approval popup. Does not execute it.",
        s.Mutation, async (action: s.MutationData) => {
          if (proposed.length) throw new ApiError(409, "ACTION_LIMIT", "Ask for one change at a time.");
          // Reserve before awaiting so parallel tool calls cannot propose multiple actions.
          const placeholder = {} as ActionRecord;
          proposed.push(placeholder);
          try {
            const target = await this.domain.inspect(identity, action);
            controller.signal.throwIfAborted();
            Object.assign(placeholder, { accountId: identity.accountId, fingerprint: target.fingerprint,
              public: { id: crypto.randomUUID(), conversationId, description: target.description,
                action: structuredClone(action), status: "pending", expiresAt: new Date(this.clock() + 10 * 60_000).toISOString() } });
            return placeholder.public;
          } catch (error) { proposed.splice(proposed.indexOf(placeholder), 1); throw error; }
        });
    }
    // The page shows what a run is doing while it waits. It is told the tool and the name of
    // what the call is about, never the arguments or what came back.
    for (const [name, tool] of Object.entries(tools)) {
      const { execute } = tool;
      tool.execute = args => {
        const { gardenId, plantId, name: skill } = (args ?? {}) as Record<string, unknown>;
        const subject = input.context.gardens.find(item => item.garden.id === gardenId)?.garden.name
          ?? input.context.gardens.flatMap(item => item.plants).find(plant => plant.id === plantId)?.name
          ?? (name === "loadSkill" && skillNames.some(known => known === skill) ? skill as string : null);
        this.activities.set(identity.accountId, { tool: name, subject, step: calls + 1 });
        return execute(args);
      };
    }
    try {
      return await Promise.race([
        this.runner.run({ ...input, tools, signal: controller.signal }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new ApiError(504, "AGENT_TIMEOUT", "The mentor took too long. Try again.")); }, this.timeoutMs);
        }),
      ]);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, "AGENT_FAILED", "The mentor could not complete this run. Try again.", { cause: error });
    } finally {
      clearTimeout(timer!);
      controller.abort(); // Prevent tools from a failed/finished run continuing later.
      this.activities.delete(identity.accountId);
    }
  }

  async chat(identity: BackendIdentity, request: s.ChatRequestData): Promise<s.ChatResponseData> {
    this.register(identity);
    const requestKey = `${identity.accountId}\0${request.requestId}`;
    const inputKey = JSON.stringify(request);
    const existing = this.replies.get(requestKey);
    if (existing) {
      if (existing.input !== inputKey) throw new ApiError(409, "REQUEST_CONFLICT", "That request ID was already used for another message.");
      return structuredClone(existing.response);
    }
    return this.exclusive(identity, async () => {
      const conversationId = request.conversationId ?? crypto.randomUUID();
      let conversation = this.conversations.get(conversationId);
      if (request.conversationId && (!conversation || conversation.accountId !== identity.accountId)) {
        throw new ApiError(404, "NOT_FOUND", "Conversation not found or expired. Start a new conversation.");
      }
      if (!conversation) conversation = { accountId: identity.accountId, history: [], updatedAt: this.clock() };
      const history: RunInput["history"] = [...conversation.history.slice(-20), { role: "user", content: request.message }];
      const context = await buildContext(this.backend, identity, this.clock());
      const proposed: ActionRecord[] = [];
      const output = await this.run({ mode: "chat", persona: request.persona, context, history }, identity, proposed, conversationId);
      if (!Value.Check(s.ChatOutput, output)) throw new ApiError(502, "INVALID_AGENT_OUTPUT", "The mentor returned an invalid response.");
      for (const action of proposed) this.actions.set(action.public.id, action);
      const named = context.gardens.flatMap(garden => garden.plants);
      const blocks = publishable(output.blocks ?? [], { max: 2, now: Date.parse(context.observedAt), ids: accountIds(context),
        plants: new Map(context.gardens.flatMap(garden => garden.histories.map(history => [history.plantId, history.metrics]))) });
      const name = (plantId: string) => named.find(plant => plant.id === plantId)?.name ?? "a plant";
      // The mentor is told what it showed, so a later turn can refer to it.
      const shown = blocks.length ? `\n[Shown under this reply: ${blocks.map(block => describeBlock(block, name)).join("; ")}]` : "";
      conversation.history = [...history, { role: "assistant" as const, content: output.reply + shown }].slice(-20);
      conversation.updatedAt = this.clock();
      this.conversations.set(conversationId, conversation);
      const response: s.ChatResponseData = { conversationId, reply: output.reply,
        pendingActions: proposed.map(action => structuredClone(action.public)), contextRevision: revision(context), blocks,
        plants: named.filter(plant => blocks.some(block => "plantId" in block && block.plantId === plant.id))
          .map(plant => ({ id: plant.id, name: plant.name })) };
      this.replies.set(requestKey, { input: inputKey, response: structuredClone(response), at: this.clock() });
      return response;
    });
  }

  async decide(identity: BackendIdentity, actionId: string, decision: "approve" | "cancel"): Promise<s.DecisionData> {
    this.register(identity);
    const record = this.actions.get(actionId);
    if (!record || record.accountId !== identity.accountId) throw new ApiError(404, "NOT_FOUND", "Action not found.");
    return this.exclusive(identity, async () => {
      const action = record.public;
      if (action.status === "expired") throw new ApiError(410, "ACTION_EXPIRED", "That proposal expired. Ask for a new one.");
      if (action.status !== "pending") return { action: structuredClone(action) };
      if (decision === "cancel") action.status = "cancelled";
      else {
        try {
          await this.domain.execute(identity, action.action, action.id, record.fingerprint);
          action.status = "succeeded";
          action.result = { code: "OK", message: "The change was completed." };
          this.cache.delete(identity.accountId);
        } catch (error) {
          action.status = "failed";
          action.result = error instanceof ApiError ? { code: error.code, message: error.message }
            : { code: "BACKEND_FAILED", message: "The backend could not confirm this change. Do not assume it succeeded." };
        }
      }
      const conversation = this.conversations.get(action.conversationId);
      if (conversation) conversation.history.push({ role: "assistant", content:
        `Action result for ${action.description}: ${action.status}. ${action.result?.message ?? "The user cancelled it."}` });
      return { action: structuredClone(action) };
    });
  }

  /** Everything wrong with a generated set of insights, worded so the model can correct it. Empty when it can be published. */
  private insightProblems(output: unknown, context: AccountContext): string[] {
    if (!Value.Check(s.InsightOutput, output)) return ["Generated insights do not match the schema."];
    const problems: string[] = [];
    const ids = accountIds(context);
    const seen = new Set<string>();
    for (const generated of output.gardens) {
      const garden = context.gardens.find(item => item.garden.id === generated.gardenId);
      if (!garden || seen.has(generated.gardenId)) { problems.push("Generated insights referenced an invalid garden."); continue; }
      seen.add(generated.gardenId);
      const plants = new Set<string>();
      for (const overview of generated.overviews) {
        const plant = garden.plants.find(item => item.id === overview.plantId);
        if (!plant || plants.has(plant.id)) { problems.push("Generated insights referenced an invalid plant."); continue; }
        plants.add(plant.id);
        const metrics = garden.histories.find(item => item.plantId === plant.id)?.metrics ?? [];
        if (!metrics.length && overview.urgency !== null) problems.push(`Unmeasured plants must remain unassessed: ${plant.name}.`);
        if ((overview.urgency !== null && !overview.evidence.length) || overview.evidence.some(evidence => {
          const metric = metrics.find(metric => metric.metric === evidence.metric && metric.unit === evidence.unit);
          return !metric || Date.parse(evidence.from) > Date.parse(evidence.to) ||
            Date.parse(evidence.from) < Date.parse(metric.first.at) || Date.parse(evidence.to) > Date.parse(metric.last.at);
        })) problems.push(`Generated insights referenced unsupported evidence for ${plant.name}: each needs a metric and unit from that plant's history and a window inside it.`);
        if (!overview.headline.trim()) problems.push(`The headline for ${plant.name} is empty.`);
        problems.push(...proseProblems(`The headline for ${plant.name}`, overview.headline, LIMITS.headline, ids),
          ...proseProblems(`The text for ${plant.name}`, overview.text, LIMITS.text, ids));
      }
      if (plants.size !== garden.plants.length || generated.items.some(item => item.plantId !== null && !plants.has(item.plantId))) {
        problems.push("Generated insights must cover the garden's plants.");
      }
      for (const item of generated.items) problems.push(...proseProblems(`A note for ${garden.garden.name}`, item.text, LIMITS.text, ids));
    }
    if (seen.size !== context.gardens.length) problems.push("Generated insights must cover all gardens.");
    return problems;
  }

  /** One scheduled run, with a single chance for the model to correct output that cannot be published. */
  private async generate(context: AccountContext, identity: BackendIdentity): Promise<s.InsightOutputData> {
    let output = await this.run({ mode: "scheduled", context, history: [] }, identity, []);
    let problems = this.insightProblems(output, context);
    if (problems.length) {
      output = await this.run({ mode: "scheduled", context, history: [
        { role: "assistant", content: JSON.stringify(output) },
        { role: "user", content: `That output cannot be published:\n${problems.slice(0, 20).map(problem => `- ${problem}`).join("\n")}\nReturn the complete output again with these corrected.` },
      ] }, identity, []);
      problems = this.insightProblems(output, context);
    }
    if (problems.length) throw new ApiError(502, "INVALID_AGENT_OUTPUT", problems[0]!);
    return output as s.InsightOutputData;
  }

  async refresh(identity: BackendIdentity, force = true): Promise<s.RefreshData> {
    if (force) this.register(identity);
    else this.cleanup();
    return this.exclusive(identity, async () => {
      const now = this.clock();
      this.attempts.set(identity.accountId, now);
      this.refreshing.add(identity.accountId);
      try {
        if (!this.runner) throw new ApiError(503, "AGENT_NOT_CONFIGURED", "Set GOOGLE_VERTEX_PROJECT and configure Google Application Default Credentials on the BFF to enable insights.");
        await this.backend.recordInsightAttempt?.(identity, now);
        const persisted = await this.backend.readInsightSnapshot?.(identity);
        if (persisted) this.cache.set(identity.accountId, { ...persisted,
          gardens: new Map(persisted.gardens.map(g => [g.insights.gardenId, g])) });
        const context = await buildContext(this.backend, identity, now);
        const inputRevision = revision(context);
        const previous = this.cache.get(identity.accountId);
        if (!force && previous && !previous.dirty && !this.failures.has(identity.accountId) &&
          previous.revision === inputRevision && now - previous.generatedAt < HOUR) {
          return { refreshed: false, generatedAt: new Date(previous.generatedAt).toISOString(), gardenIds: [...previous.gardens.keys()] };
        }
        const output = await this.generate(context, identity);
        const generatedAt = this.clock();
        const next: Cache = { revision: revision(context), generatedAt, dirty: false, gardens: new Map() };
        for (const garden of output.gardens) {
          const known = context.gardens.find(item => item.garden.id === garden.gardenId)!;
          // A block that cannot be drawn is left out; it is no reason to lose the whole run.
          const scope = { now, ids: accountIds(context), plants: new Map(known.histories.map(history => [history.plantId, history.metrics])) };
          const overviews = garden.overviews.map(overview => ({ ...overview,
            blocks: publishable(overview.blocks, { ...scope, own: overview.plantId, max: 3 }) }));
          const blocks = publishable(garden.blocks ?? [], { ...scope, max: 2 });
          const layout = trail(garden.layout, overviews);
          next.gardens.set(garden.gardenId, { fingerprint: gardenFingerprint(known),
            insights: { gardenId: garden.gardenId, status: "ready", generatedAt: new Date(generatedAt).toISOString(),
              overviews, items: garden.items.map(item => ({ ...item, id: crypto.randomUUID() })),
              ...(blocks.length ? { blocks } : {}), ...(layout ? { layout } : {}) } });
        }
        await this.backend.writeInsightSnapshot?.(identity, { ...next, version: persisted?.version,
          gardens: [...next.gardens.values()] });
        this.cache.set(identity.accountId, next);
        this.failures.delete(identity.accountId);
        return { refreshed: true, generatedAt: new Date(generatedAt).toISOString(), gardenIds: [...next.gardens.keys()] };
      } catch (error) {
        const failure = error instanceof ApiError ? error : new ApiError(502, "AGENT_FAILED", "Insight refresh failed. Previous insights were retained.", { cause: error });
        this.failures.set(identity.accountId, { at: this.clock(), error: { code: failure.code, message: failure.message } });
        await this.backend.recordInsightAttempt?.(identity, this.clock(), { code: failure.code, message: failure.message })
          .catch(storageError => logFailure(storageError, { scope: "insight-failure-storage", accountId: identity.accountId }));
        throw failure;
      } finally { this.refreshing.delete(identity.accountId); }
    });
  }

  decorate(identity: BackendIdentity, insights: InsightsData, dashboard?: DashboardData): InsightsData {
    // Durable responses already include current invalidation/failure state and
    // filter deleted plants. Never overlay them with an older process-local cache.
    if (insights.generation) return { ...insights, generation: { ...insights.generation,
      ...(this.refreshing.has(identity.accountId) ? { state: "refreshing" as const } : {}) } };
    const cached = this.cache.get(identity.accountId);
    const garden = cached?.gardens.get(insights.gardenId);
    const failure = this.failures.get(identity.accountId);
    const stale = cached && (cached.dirty || this.clock() - cached.generatedAt >= HOUR ||
      (dashboard && garden && garden.fingerprint !== gardenFingerprint(dashboard)));
    return { ...(garden?.insights ?? insights), generation: {
      state: this.refreshing.has(identity.accountId) ? "refreshing" : failure ? "failed" : garden ? stale ? "stale" : "ready" : "unavailable",
      model: "gemini-3.8-flash", contextRevision: cached?.revision ?? null,
      lastAttemptAt: this.attempts.has(identity.accountId) ? new Date(this.attempts.get(identity.accountId)!).toISOString() : null,
      error: failure?.error ?? null,
    } };
  }

  async tick() {
    this.cleanup();
    if (!this.runner) return;
    for (const identity of await this.backend.listAgentAccounts?.() ?? []) this.register(identity);
    for (const { identity } of [...this.identities.values()]) {
      if (this.busy.has(identity.accountId)) continue;
      try { await this.refresh(identity, false); } catch (error) {
        logFailure(error, { scope: "scheduled-insights", accountId: identity.accountId });
      }
    }
  }
}
