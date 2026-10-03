import { cors } from "@elysiajs/cors";
import { openapi, type ElysiaOpenAPIConfig } from "@elysiajs/openapi";
import { Elysia, t } from "elysia";
import type { BetterAuthOptions } from "better-auth";
import { createAuth, seedDemoAccount } from "./auth";
import { MockBackend, type BackendAdapter, type BackendIdentity } from "./backend";
import { loadConfig, type Config } from "./config";
import * as s from "./schemas";

class ApiError extends Error {
  constructor(public status: 400 | 401 | 404 | 501, public code: string, message: string) {
    super(message);
  }
}

const errorResponses = {
  400: s.ErrorResponse,
  401: s.ErrorResponse,
  404: s.ErrorResponse,
  422: s.ErrorResponse,
  500: s.ErrorResponse,
};

export async function createApp(options: {
  config?: Config;
  backend?: BackendAdapter;
  authDatabase?: BetterAuthOptions["database"];
} = {}) {
  const config = options.config ?? loadConfig();
  const backend = options.backend ?? new MockBackend();
  async function requireGarden(identity: BackendIdentity, gardenId: string) {
    const { gardens } = await backend.listGardens(identity);
    if (!gardens.some(garden => garden.id === gardenId)) {
      throw new ApiError(404, "NOT_FOUND", "Garden not found.");
    }
  }
  async function requirePlant(identity: BackendIdentity, plantId: string) {
    if (!await backend.hasPlant(identity, plantId)) {
      throw new ApiError(404, "NOT_FOUND", "Plant not found.");
    }
  }
  if (config.production && !options.backend) {
    throw new Error("Configure the real backend adapter before running in production.");
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
      description: "Cookie-authenticated dashboard API. Domain responses are development fixtures; backend integration, caching, and Gemini scheduling are deferred.",
    },
    tags: [
      ...authSchema.tags,
      { name: "Account" }, { name: "Gardens" }, { name: "Dashboard" },
      { name: "Readings" }, { name: "Insights" }, { name: "Provisioning" },
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
      },
    },
  } as Documentation;

  const app = new Elysia()
    .use(cors({
      origin: config.frontendOrigins,
      credentials: true,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    }))
    .onError(({ code, error, set }) => {
      if (error instanceof ApiError) {
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
      console.error("BFF request failed", error);
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
    .macro({
      authenticated: {
        async resolve({ request }) {
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to access this endpoint.");
          const identity: BackendIdentity = {
            version: "v1", userId: session.user.id, accountId: session.user.id,
          };
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
      .post("/gardens", () => {
        throw new ApiError(501, "NOT_IMPLEMENTED", "Garden creation awaits the backend protocol.");
      }, {
        body: s.NewGarden,
        response: { 201: s.GardenResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Gardens"], summary: "Create a garden (reserved)", operationId: "createGarden",
          description: "Validates the request, then returns 501 without creating a garden. Future success returns 201.",
        },
      })
      .delete("/gardens/:id", async ({ identity, params }) => {
        await requireGarden(identity, params.id);
        throw new ApiError(501, "NOT_IMPLEMENTED", "Garden removal awaits the backend protocol.");
      }, {
        params: t.Object({ id: s.Id }),
        response: { 204: t.Void(), 501: s.ErrorResponse },
        detail: {
          tags: ["Gardens"], summary: "Remove a garden (reserved)", operationId: "removeGarden",
          description: "Checks account ownership, then returns 501 without changes. Future success returns 204 and removes the garden's plants, readings, and keys; backend cascade semantics are pending.",
        },
      })
      .post("/gardens/:id/plants", async ({ identity, params }) => {
        await requireGarden(identity, params.id);
        throw new ApiError(501, "NOT_IMPLEMENTED", "Plant creation awaits the backend protocol.");
      }, {
        params: t.Object({ id: s.Id }), body: s.NewPlant,
        response: { 201: s.PlantedResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Create a plant with a firmware key (reserved)", operationId: "createPlant",
          description: "Validates the request and garden ownership, then returns 501. Future success returns 201 with the plant and a backend-issued API key; no plant or key is created here.",
        },
      })
      .delete("/plants/:id", async ({ identity, params }) => {
        await requirePlant(identity, params.id);
        throw new ApiError(501, "NOT_IMPLEMENTED", "Plant removal awaits the backend protocol.");
      }, {
        params: t.Object({ id: s.Id }),
        response: { 204: t.Void(), 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Remove a plant (reserved)", operationId: "removePlant",
          description: "Checks account ownership, then returns 501 without changes. Future success returns 204; backend cleanup and key revocation semantics are pending.",
        },
      })
      .get("/dashboard", async ({ identity, query }) => {
        const dashboard = await backend.hydrateDashboard(identity, query.gardenId);
        if (!dashboard) throw new ApiError(404, "NOT_FOUND", "Garden not found.");
        return dashboard;
      }, {
        query: t.Object({ gardenId: s.Id }),
        response: { 200: s.DashboardResponse },
        detail: { tags: ["Dashboard"], summary: "Hydrate one garden dashboard", operationId: "getDashboard" },
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
          description: "Required UTC/offset timestamps, inclusive range, maximum seven days. Mock data includes reported hourly samples with a four-minute reporting delay; backend sampling is TBD.",
          operationId: "getPlantReadings",
        },
      })
      .get("/gardens/:id/insights", async ({ identity, params }) => {
        const result = await backend.getInsights(identity, params.id);
        if (!result) throw new ApiError(404, "NOT_FOUND", "Garden not found.");
        return result;
      }, {
        params: t.Object({ id: s.Id }), response: { 200: s.InsightsResponse },
        detail: {
          tags: ["Insights"], summary: "Read existing garden insights", operationId: "getGardenInsights",
          description: "Does not call Gemini or schedule generation. Freshness policy is TBD.",
        },
      })
      .get("/plants/:id/api-keys", async ({ identity, params, set }) => {
        set.headers["Cache-Control"] = "no-store";
        await requirePlant(identity, params.id);
        throw new ApiError(501, "NOT_IMPLEMENTED", "Plant API-key retrieval awaits the backend protocol.");
      }, {
        params: t.Object({ id: s.Id }), response: { 200: s.ApiKeyResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Retrieve a plant API key (reserved)", operationId: "getPlantApiKey",
          description: "Checks account ownership, then returns 501. Future success returns a secret with Cache-Control: no-store. Backend key storage and whether existing secrets can be retrieved are TBD.",
        },
      })
      .post("/plants/:id/api-keys", async ({ identity, params, set }) => {
        set.headers["Cache-Control"] = "no-store";
        await requirePlant(identity, params.id);
        throw new ApiError(501, "NOT_IMPLEMENTED", "Plant API-key issuance awaits the backend protocol.");
      }, {
        params: t.Object({ id: s.Id }), response: { 200: s.ApiKeyResponse, 501: s.ErrorResponse },
        detail: {
          tags: ["Provisioning"], summary: "Replace a plant API key (reserved)", operationId: "replacePlantApiKey",
          description: "Checks account ownership, then returns 501 without issuing or revoking keys. Future success returns a backend-issued key with Cache-Control: no-store and invalidates the old credential.",
        },
      }),
    ));

  return { app, auth };
}
