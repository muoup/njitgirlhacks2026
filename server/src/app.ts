import { cors } from "@elysiajs/cors";
import { openapi, type ElysiaOpenAPIConfig } from "@elysiajs/openapi";
import { Elysia, t } from "elysia";
import type { BetterAuthOptions } from "better-auth";
import { createAuth, seedDemoAccount } from "./auth";
import { MockBackend, type BackendAdapter, type BackendIdentity } from "./backend";
import { loadConfig, type Config } from "./config";
import * as s from "./schemas";
import * as a from "./agent/schemas";
import { ApiError } from "./errors";
import { DomainService } from "./domain";
import { AgentService } from "./agent/service";
import { GeminiRunner, type AgentRunner } from "./agent/runner";
import { logFailure } from "./diagnostics";
import { IngestRequest, IngestResponse } from "./ingestion";
import { hashKey } from "./storage/keys";
import { metricCatalogue } from "./metrics";

const errorResponses = {
  400: s.ErrorResponse,
  401: s.ErrorResponse,
  403: s.ErrorResponse,
  404: s.ErrorResponse,
  409: s.ErrorResponse,
  413: s.ErrorResponse,
  410: s.ErrorResponse,
  422: s.ErrorResponse,
  429: s.ErrorResponse,
  500: s.ErrorResponse,
  501: s.ErrorResponse,
  502: s.ErrorResponse,
  503: s.ErrorResponse,
  504: s.ErrorResponse,
};

export async function createApp(options: {
  config?: Config;
  backend?: BackendAdapter;
  authDatabase?: BetterAuthOptions["database"];
  agentRunner?: AgentRunner;
} = {}) {
  const config = options.config ?? loadConfig();
  const backend: BackendAdapter = options.backend ?? new MockBackend();
  const agents = new AgentService(backend, options.agentRunner ??
    (config.agent.project ? new GeminiRunner({ project: config.agent.project, location: config.agent.location }) : undefined));
  const domain = new DomainService(backend);
  const ingestLimits = new Map<string, { at: number; count: number }>();
  function requestId(request: Request) {
    const value = request.headers.get("Idempotency-Key");
    if (value && !/^[A-Za-z0-9_.:-]{1,120}$/.test(value)) throw new ApiError(422, "INVALID_REQUEST", "Invalid Idempotency-Key.");
    return value ?? crypto.randomUUID();
  }
  function checkOrigin(request: Request) {
    const origin = request.headers.get("Origin");
    if ((origin && ![...config.frontendOrigins, new URL(config.baseURL).origin].includes(origin)) ||
      (!origin && request.headers.get("Sec-Fetch-Site") === "cross-site")) {
      throw new ApiError(403, "FORBIDDEN_ORIGIN", "This origin cannot submit agent requests.");
    }
  }
  async function requirePlant(identity: BackendIdentity, plantId: string) {
    if (!await backend.hasPlant(identity, plantId)) {
      throw new ApiError(404, "NOT_FOUND", "Plant not found.");
    }
  }
  if (config.production && !config.allowDemoInProduction && !options.backend) {
    throw new Error("Configure the real backend adapter before running in production, or use ./prod.sh --demo for the ephemeral scaffold.");
  }
  const auth = createAuth(config, options.authDatabase);
  if (config.seedDemo && !options.authDatabase) await seedDemoAccount(auth);

  // Mounted auth handlers do not expose their schemas to Elysia. Merge Better
  // Auth's generated document into the BFF document instead of hand-writing it.
  const authSchema = await auth.api.generateOpenAPISchema();
  const authPaths = Object.fromEntries(
    Object.entries(authSchema.paths).map(([path, operation]) => [`/api/auth${path}`, operation]),
  );
  type Documentation = NonNullable<ElysiaOpenAPIConfig["documentation"]>;
  const documentation = {
    info: {
      title: "Grove BFF",
      version: "0.1.0",
      description: "Cookie-authenticated garden backend with PostgreSQL/TimescaleDB storage, plant-key sensor ingestion, and Gemini chat/scheduled insights. Without database configuration, development uses fixtures.",
    },
    tags: [
      ...authSchema.tags,
      { name: "Account" }, { name: "Gardens" }, { name: "Dashboard" },
      { name: "Readings" }, { name: "Insights" }, { name: "Provisioning" },
      { name: "Agent" },
      { name: "Ingestion" },
    ],
    paths: authPaths,
    components: {
      ...authSchema.components,
      securitySchemes: {
        ...authSchema.components.securitySchemes,
        bffSession: {
          type: "apiKey", in: "cookie", name: "better-auth.session_token",
          description: "Better Auth session cookie; include credentials in frontend requests. HTTPS uses the __Secure- cookie prefix.",
        },
        plantApiKey: { type: "http", scheme: "bearer", bearerFormat: "Plant API key",
          description: "Firmware credential scoped to one plant/device. Browser sessions do not authorize ingestion." },
      },
    },
  } as Documentation;

  const app = new Elysia({ normalize: false, serve: {
    // A Gemini run can take up to 60 seconds, and an insight refresh may run twice to
    // correct itself. Bun's default 10-second idle timeout would drop the socket mid-request.
    idleTimeout: 150,
    maxRequestBodySize: 16 * 1024,
  } })
    .use(cors({
      origin: config.frontendOrigins,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    }))
    .onError(({ code, error, set, request }) => {
      if (error instanceof ApiError) {
        if (error.status >= 500 && error.status !== 501) {
          logFailure(error, { scope: "http", path: new URL(request.url).pathname });
        }
        set.status = error.status;
        return { error: { code: error.code, message: error.message } };
      }
      if (code === "VALIDATION" || code === "PARSE") {
        set.status = code === "VALIDATION" ? 422 : 400;
        return { error: { code: "INVALID_REQUEST", message: "Request does not match the documented schema." } };
      }
      if (code === "NOT_FOUND") {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Endpoint not found." } };
      }
      set.status = 500;
      logFailure(error, { scope: "http", path: new URL(request.url).pathname });
      return { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } };
    })
    .onAfterHandle(({ request, response }) => {
      if (new URL(request.url).pathname !== "/openapi/json") return;
      // The installed OpenAPI generator emits `content: { type: "void" }`
      // for t.Void(). A 204 response has no content in the OpenAPI document.
      const spec = response as { paths?: Record<string, Record<string, {
        responses?: Record<string, { content?: unknown }>;
      }>> };
      for (const path of Object.values(spec.paths ?? {})) {
        for (const operation of Object.values(path)) {
          const noContent = operation.responses?.["204"];
          if (noContent) delete noContent.content;
        }
      }
    })
    .use(openapi({ documentation }))
    // Forward the original URL/body; mounting at a prefix would strip the
    // /api/auth path that Better Auth expects.
    .all("/api/auth/*", ({ request }) => auth.handler(request), {
      parse: "none", detail: { hide: true },
    })
    .get("/health", () => ({ status: "ok" as const }), {
      response: t.Object({ status: t.Literal("ok") }),
      detail: { summary: "Server liveness", operationId: "getHealth" },
    })
    .post("/api/v1/ingest/readings", async ({ request, body, set }) => {
      set.headers["Cache-Control"] = "no-store";
      const header = request.headers.get("Authorization") ?? "";
      const match = /^Bearer (grove_device_[A-Za-z0-9_-]{43})$/i.exec(header);
      if (!match) throw new ApiError(401, "INVALID_DEVICE_KEY", "A valid plant API key is required.");
      if (!backend.ingest) throw new ApiError(503, "INGESTION_UNAVAILABLE", "Configure database storage to accept device readings.");
      const now = Date.now();
      for (const [key, entry] of ingestLimits) if (now-entry.at >= 60_000) ingestLimits.delete(key);
      const key = hashKey(match[1]!);
      const entry = ingestLimits.get(key) ?? { at: now, count: 0 };
      if (entry.count >= 120 || (!ingestLimits.has(key) && ingestLimits.size >= 5000)) {
        set.headers["Retry-After"] = "60";
        throw new ApiError(429, "INGESTION_RATE_LIMIT", "At most 120 submissions per minute per key are accepted.");
      }
      entry.count++; ingestLimits.set(key, entry);
      const result = await backend.ingest(match[1]!, body);
      set.status = result.duplicate ? 200 : 201;
      return result;
    }, {
      body: IngestRequest, response: { ...errorResponses, 200: IngestResponse, 201: IngestResponse },
      detail: { tags: ["Ingestion"], operationId: "submitSensorReading", security: [{ plantApiKey: [] }],
        summary: "Submit one firmware sensor sample", description: "Key determines account, plant, and device. Reuse sampleId unchanged on retries. measuredAt is optional. Raw ADC/AQ/color values are not calibrated percentages, ppm, or lux. No Gemini call is made during ingestion." },
    })
    .macro({
      authenticated: {
        async resolve({ request }) {
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to access this endpoint.");
          const identity: BackendIdentity = {
            version: "v1", userId: session.user.id, accountId: session.user.id,
          };
          agents.register(identity);
          await backend.touchAccount?.(identity);
          return { user: session.user, identity };
        },
      },
    })
    .group("/api/v1", app => app.guard({
      authenticated: true,
      response: errorResponses,
      detail: { security: [{ bffSession: [] }] },
    }, app => app
      .get("/me", ({ user, identity }) => ({
        user: { id: user.id, name: user.name, email: user.email },
        account: { id: identity.accountId },
      }), {
        response: { 200: s.MeResponse },
        detail: { tags: ["Account"], summary: "Current account", operationId: "getMe" },
      })
      .get("/gardens", ({ identity }) => backend.listGardens(identity), {
        response: { 200: s.GardensResponse },
        detail: { tags: ["Gardens"], summary: "List the account's gardens", operationId: "listGardens" },
      })
      .post("/gardens", async ({ identity, body, set, request }) => {
        checkOrigin(request);
        const result = await domain.execute(identity, { kind: "createGarden", ...body }, requestId(request));
        agents.invalidate(identity);
        if (!result || !("garden" in result)) throw new ApiError(502, "BACKEND_FAILED", "The backend did not return the new garden.");
        set.status = 201;
        return result;
      }, {
        body: s.NewGarden,
        response: { 201: s.GardenResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Gardens"], summary: "Create a garden", operationId: "createGarden",
          description: "Account-scoped creation. Optional Idempotency-Key supports retries. Development mock storage returns 501.",
        },
      })
      .delete("/gardens/:id", async ({ identity, params, set, request }) => {
        checkOrigin(request);
        await domain.execute(identity, { kind: "removeGarden", gardenId: params.id }, requestId(request));
        agents.invalidate(identity);
        set.status = 204;
      }, {
        params: t.Object({ id: s.Id }),
        response: { 204: t.Void(), 501: s.ErrorResponse },
        detail: {
          tags: ["Gardens"], summary: "Remove a garden", operationId: "removeGarden",
          description: "Checks ownership and cascades to plants, devices, readings, and firmware credentials. Mock storage returns 501.",
        },
      })
      .post("/gardens/:id/plants", async ({ identity, params, body, set, request }) => {
        checkOrigin(request);
        set.headers["Cache-Control"] = "no-store";
        const result = await domain.execute(identity, { kind: "createPlant", gardenId: params.id, ...body }, requestId(request));
        agents.invalidate(identity);
        if (!result || !("plant" in result)) throw new ApiError(502, "BACKEND_FAILED", "The backend did not return the new plant.");
        set.status = 201;
        return result;
      }, {
        params: t.Object({ id: s.Id }), body: s.NewPlant,
        response: { 201: s.PlantedResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Create a plant with a firmware key", operationId: "createPlant",
          description: "Creates one plant, associated monitor, and API key atomically. Optional Idempotency-Key supports retries. Mock storage returns 501.",
        },
      })
      .patch("/plants/:id", async ({ identity, params, body, request }) => {
        checkOrigin(request);
        await requirePlant(identity, params.id);
        if (!backend.updatePlant) throw new ApiError(501, "NOT_IMPLEMENTED", "Plant changes await the backend protocol.");
        const result = await backend.updatePlant(identity, params.id, body);
        agents.invalidate(identity);
        return result;
      }, {
        params: t.Object({ id: s.Id }), body: s.PlantEdit,
        response: { 200: s.PlantResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Rename a plant or correct its species", operationId: "updatePlant",
          description: "Changes the name, the species, or both; a field left out keeps its value. The plant keeps its readings and its firmware key. Mock storage returns 501.",
        },
      })
      .delete("/plants/:id", async ({ identity, params, set, request }) => {
        checkOrigin(request);
        await domain.execute(identity, { kind: "removePlant", plantId: params.id }, requestId(request));
        agents.invalidate(identity);
        set.status = 204;
      }, {
        params: t.Object({ id: s.Id }),
        response: { 204: t.Void(), 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Remove a plant", operationId: "removePlant",
          description: "Checks ownership and deletes its device, readings, and firmware key. Mock storage returns 501.",
        },
      })
      .get("/dashboard", async ({ identity, query }) => {
        const dashboard = await backend.hydrateDashboard(identity, query.gardenId);
        if (!dashboard) throw new ApiError(404, "NOT_FOUND", "Garden not found.");
        return { ...dashboard, insights: agents.decorate(identity, dashboard.insights, dashboard) };
      }, {
        query: t.Object({ gardenId: s.Id }),
        response: { 200: s.DashboardResponse },
        detail: { tags: ["Dashboard"], summary: "Hydrate one garden dashboard", operationId: "getDashboard" },
      })
      .get("/metrics", () => ({ metrics: metricCatalogue }), {
        response: { 200: t.Object({ metrics: t.Array(s.MetricInfo) }) },
        detail: { tags: ["Readings"], summary: "List the metrics the grove knows", operationId: "listMetrics",
          description: "What each metric is called, its display unit, and the scale and healthy range it is drawn on. The dashboard response carries the same list." },
      })
      .get("/plants/:id/readings", async ({ identity, params, query }) => {
        const from = Date.parse(query.from);
        const to = Date.parse(query.to);
        if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > 7 * 86_400_000) {
          throw new ApiError(400, "INVALID_RANGE", "Use an ordered time range of at most seven days.");
        }
        const readings = await backend.getReadings(identity, params.id, query);
        if (!readings) throw new ApiError(404, "NOT_FOUND", "Plant not found.");
        return readings;
      }, {
        params: t.Object({ id: s.Id }), query: s.ReadingsQuery,
        response: { 200: s.ReadingsResponse },
        detail: {
          tags: ["Readings"], summary: "Read a plant's numerical history",
          description: "Inclusive ISO timestamp range, at most seven days. Database history returns at most 361 actual samples using the last sample per time bucket; sampling describes the bucket. Full raw history stays in storage. Mock history is hourly.",
          operationId: "getPlantReadings",
        },
      })
      .get("/gardens/:id/insights", async ({ identity, params }) => {
        const result = await backend.getInsights(identity, params.id);
        if (!result) throw new ApiError(404, "NOT_FOUND", "Garden not found.");
        return { ...result, insights: agents.decorate(identity, result.insights) };
      }, {
        params: t.Object({ id: s.Id }), response: { 200: s.InsightsResponse },
        detail: {
          tags: ["Insights"], summary: "Read existing garden insights", operationId: "getGardenInsights",
          description: "Returns cached generated insights when available, with freshness and failure metadata. Does not call Gemini synchronously; use POST /api/v1/insights/refresh to force generation.",
        },
      })
      .post("/chat", ({ identity, body, request, set }) => {
        checkOrigin(request);
        set.headers["Cache-Control"] = "no-store";
        return agents.chat(identity, body);
      }, {
        body: a.ChatRequest, response: { 200: a.ChatResponse },
        detail: { tags: ["Agent"], operationId: "askMentor", summary: "Chat with the account-wide garden mentor",
          description: "Gnome and wizard share all account gardens and MEMORY.md. Conversations and request deduplication last one hour in this process. Additions/removals return proposals for explicit popup approval." },
      })
      .post("/chat/actions/:id/decision", ({ identity, params, body, request, set }) => {
        checkOrigin(request);
        set.headers["Cache-Control"] = "no-store";
        return agents.decide(identity, params.id, body.decision);
      }, {
        params: t.Object({ id: s.Id }), body: a.DecisionRequest, response: { 200: a.DecisionResponse },
        detail: { tags: ["Agent"], operationId: "decideAgentAction", summary: "Approve or cancel an exact proposed change",
          description: "Account ownership, expiry, and target state are rechecked. Repeated decisions do not execute twice in this process. A 200 response can contain action.status=failed, including NOT_IMPLEMENTED while the backend is unavailable." },
      })
      .post("/insights/refresh", ({ identity, request, set }) => {
        checkOrigin(request);
        set.headers["Cache-Control"] = "no-store";
        return agents.refresh(identity, true);
      }, {
        body: t.Optional(t.Object({})), response: { 200: a.RefreshResponse },
        detail: { tags: ["Insights", "Agent"], operationId: "refreshAgentInsights", summary: "Force an account-wide scheduled insight refresh",
          description: "Runs the restricted cron harness, bypassing cache. Can update memory and insights, never garden/plant resources. Requires a Vertex project and ADC. Existing insights survive failures." },
      })
      .get("/plants/:id/api-keys", async ({ identity, params, set }) => {
        set.headers["Cache-Control"] = "no-store";
        await requirePlant(identity, params.id);
        if (backend.getPlantApiKey) return backend.getPlantApiKey(identity, params.id);
        throw new ApiError(501, "NOT_IMPLEMENTED", "Plant API-key retrieval awaits the backend protocol.");
      }, {
        params: t.Object({ id: s.Id }), response: { 200: s.ApiKeyResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Retrieve a plant API key", operationId: "getPlantApiKey",
          description: "Owner-only retrieval of an encrypted-at-rest key. Cache-Control: no-store. Mock storage returns 501.",
        },
      })
      .post("/plants/:id/api-keys", async ({ identity, params, set, request }) => {
        checkOrigin(request);
        set.headers["Cache-Control"] = "no-store";
        await requirePlant(identity, params.id);
        if (backend.replacePlantApiKey) return backend.replacePlantApiKey(identity, params.id);
        throw new ApiError(501, "NOT_IMPLEMENTED", "Plant API-key issuance awaits the backend protocol.");
      }, {
        params: t.Object({ id: s.Id }), response: { 200: s.ApiKeyResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Replace a plant API key", operationId: "replacePlantApiKey",
          description: "Owner-only rotation; old key stops authenticating. Mock storage returns 501.",
        },
      }),
    ));

  return { app, auth, agents };
}
