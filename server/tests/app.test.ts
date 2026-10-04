import { beforeAll, describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { demoCredentials } from "../src/auth";
import { loadConfig } from "../src/config";
import { MockBackend } from "../src/backend";

const origin = "http://localhost:3000";
let app: Awaited<ReturnType<typeof createApp>>["app"];

function request(path: string, cookie?: string, body?: object, method = body ? "POST" : "GET") {
  return app.handle(new Request(`http://localhost:3001${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }));
}

function cookies(response: Response) {
  return response.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ");
}

async function signUp(email: string) {
  const response = await request("/api/auth/sign-up/email", undefined, {
    name: "Test Gardener", email, password: "TestPassword2026!",
  });
  expect(response.status).toBe(200);
  expect(cookies(response)).toContain("better-auth.session_token=");
  return cookies(response);
}

beforeAll(async () => {
  ({ app } = await createApp({
    config: loadConfig({}),
    backend: new MockBackend(() => Date.parse("2026-10-03T12:04:00Z")),
  }));
});

describe("BFF contracts and sessions", () => {
  test("public health and docs work; domain data requires login", async () => {
    expect(await (await request("/health")).json()).toEqual({ status: "ok" });
    const response = await request("/api/v1/gardens");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Sign in to access this endpoint." },
    });
  });

  test("seeded demo login hydrates a dashboard and numerical history", async () => {
    const login = await request("/api/auth/sign-in/email", undefined, {
      email: demoCredentials.email, password: demoCredentials.password,
    });
    expect(login.status).toBe(200);
    const cookie = cookies(login);
    const me = await (await request("/api/v1/me", cookie)).json();
    expect(me.user.email).toBe(demoCredentials.email);
    expect(me.account.id).toBe(me.user.id);

    const gardenResponse = await request("/api/v1/gardens", cookie);
    expect(gardenResponse.status).toBe(200);
    expect(gardenResponse.headers.get("access-control-allow-origin")).toBe(origin);
    expect(gardenResponse.headers.get("access-control-allow-credentials")).toBe("true");
    const { gardens } = await gardenResponse.json();
    const response = await request(`/api/v1/dashboard?gardenId=${gardens[0].id}`, cookie);
    expect(response.status).toBe(200);
    const dashboard = await response.json();
    expect(dashboard.meta.source).toBe("mock");
    expect(dashboard.plants).toHaveLength(5);
    expect(dashboard.plants.some((plant: { status?: string }) => plant.status === "needs_care")).toBe(true);
    expect(dashboard.plants.some((plant: { status?: string }) => plant.status === undefined)).toBe(true);
    expect(dashboard.latestReadings).toHaveLength(4);
    expect(dashboard.latestReadings[0].measurements.map((item: { metric: string }) => item.metric))
      .toEqual(["soil_moisture", "temperature", "humidity"]);
    expect(dashboard.insights.items.filter((item: { needsFollowUp: boolean }) => item.needsFollowUp)).toHaveLength(2);
    expect(dashboard.devices.some((device: { lastSeenAt: string | null }) => device.lastSeenAt === null)).toBe(true);
    expect(dashboard.latestReadings[0].measurements[0].unit).toBe("%");

    const from = "2026-10-03T00:00:00Z";
    const to = "2026-10-03T03:00:00Z";
    const history = await request(`/api/v1/plants/${dashboard.plants[0].id}/readings?from=${from}&to=${to}`, cookie);
    expect(history.status).toBe(200);
    const result = await history.json();
    expect(result.readings).toHaveLength(4);
    expect(Date.parse(result.readings[0].measuredAt)).toBe(Date.parse(from));
    expect(Date.parse(result.readings[3].measuredAt)).toBe(Date.parse(to));
    const insights = await request(`/api/v1/gardens/${gardens[0].id}/insights`, cookie);
    expect(insights.status).toBe(200);
    expect((await insights.json()).insights.status).toBe("ready");

    const empty = await request(`/api/v1/dashboard?gardenId=${gardens[2].id}`, cookie);
    expect(empty.status).toBe(200);
    const emptyDashboard = await empty.json();
    expect(emptyDashboard.plants).toEqual([]);
    expect(emptyDashboard.latestReadings).toEqual([]);
    expect(emptyDashboard.insights).toMatchObject({ status: "unavailable", generatedAt: null, items: [] });

    const keyRequest = await app.handle(new Request(`http://localhost:3001/api/v1/plants/${dashboard.plants[0].id}/api-keys`, {
      method: "POST", headers: { Cookie: cookie, Origin: origin },
    }));
    expect(keyRequest.status).toBe(501);
    expect((await keyRequest.json()).error.code).toBe("NOT_IMPLEMENTED");
  });

  test("accounts cannot hydrate another account's fixture IDs", async () => {
    const alice = await signUp("alice@example.com");
    const bob = await signUp("bob@example.com");
    const { gardens } = await (await request("/api/v1/gardens", alice)).json();
    const { plants } = await (await request(`/api/v1/dashboard?gardenId=${gardens[0].id}`, alice)).json();
    expect((await request(`/api/v1/dashboard?gardenId=${gardens[0].id}`, bob)).status).toBe(404);
    expect((await request(`/api/v1/gardens/${gardens[0].id}/insights`, bob)).status).toBe(404);
    expect((await request(`/api/v1/plants/${plants[0].id}/readings?from=2026-10-03T00:00:00Z&to=2026-10-03T01:00:00Z`, bob)).status).toBe(404);
  });

  test("malformed queries and excessive ranges return documented errors", async () => {
    const cookie = await signUp("validation@example.com");
    const missing = await request("/api/v1/dashboard", cookie);
    expect(missing.status).toBe(422);
    expect((await missing.json()).error.code).toBe("INVALID_REQUEST");
    const malformed = await request("/api/v1/plants/unknown/readings?from=bad&to=bad", cookie);
    expect(malformed.status).toBe(422);
    const excessive = await request("/api/v1/plants/unknown/readings?from=2026-10-01T00:00:00Z&to=2026-10-10T00:00:00Z", cookie);
    expect(excessive.status).toBe(400);
    expect((await excessive.json()).error.code).toBe("INVALID_RANGE");
  });

  test("shed routes require a session and ownership, return 501, and leave fixtures unchanged", async () => {
    const owner = await signUp("shed-owner@example.com");
    const outsider = await signUp("shed-outsider@example.com");
    const before = await (await request("/api/v1/gardens", owner)).json();
    const gardenId = before.gardens[0].id;
    const dashboard = await (await request(`/api/v1/dashboard?gardenId=${gardenId}`, owner)).json();
    const plantId = dashboard.plants[0].id;
    const operations: { path: string; method: string; body?: object; scoped: boolean }[] = [
      { path: "/api/v1/gardens", method: "POST", body: { name: "New garden" }, scoped: false },
      { path: `/api/v1/gardens/${gardenId}`, method: "DELETE", scoped: true },
      { path: `/api/v1/gardens/${gardenId}/plants`, method: "POST", body: { name: "Rosemary", species: "Salvia rosmarinus" }, scoped: true },
      { path: `/api/v1/plants/${plantId}`, method: "PATCH", body: { name: "Renamed" }, scoped: true },
      { path: `/api/v1/plants/${plantId}`, method: "DELETE", scoped: true },
      { path: `/api/v1/plants/${plantId}/api-keys`, method: "GET", scoped: true },
      { path: `/api/v1/plants/${plantId}/api-keys`, method: "POST", scoped: true },
    ];
    for (const operation of operations) {
      const { path, method, body } = operation;
      expect((await request(path, undefined, body, method)).status).toBe(401);
      const reserved = await request(path, owner, body, method);
      expect(reserved.status).toBe(501);
      expect((await reserved.json()).error.code).toBe("NOT_IMPLEMENTED");
      if (path.endsWith("/api-keys")) expect(reserved.headers.get("cache-control")).toBe("no-store");
      if (operation.scoped) {
        const inaccessible = await request(path, outsider, body, method);
        expect(inaccessible.status).toBe(404);
        expect((await inaccessible.json()).error.code).toBe("NOT_FOUND");
        const missing = path.replace(gardenId, "unknown").replace(plantId, "unknown");
        expect((await request(missing, owner, body, method)).status).toBe(404);
      }
    }
    expect(await (await request("/api/v1/gardens", owner)).json()).toEqual(before);
    expect(await (await request(`/api/v1/dashboard?gardenId=${gardenId}`, owner)).json()).toEqual(dashboard);
  });

  test("shed creation and edits validate input and browser preflight allows PATCH and DELETE", async () => {
    const cookie = await signUp("shed-validation@example.com");
    const { gardens } = await (await request("/api/v1/gardens", cookie)).json();
    for (const body of [{}, { name: "" }, { name: "   " }, { name: 42 }]) {
      const response = await request("/api/v1/gardens", cookie, body);
      expect(response.status).toBe(422);
      expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    }
    for (const body of [{ name: "Fern" }, { name: " ", species: "Fern" }, { name: "Fern", species: " " }]) {
      expect((await request(`/api/v1/gardens/${gardens[0].id}/plants`, cookie, body)).status).toBe(422);
    }
    const dashboard = await (await request(`/api/v1/dashboard?gardenId=${gardens[0].id}`, cookie)).json();
    for (const body of [{}, { name: " " }, { species: "" }, { name: "Fern", species: 42 }]) {
      const response = await request(`/api/v1/plants/${dashboard.plants[0].id}`, cookie, body, "PATCH");
      expect(response.status).toBe(422);
      expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    }
    const preflight = await app.handle(new Request(`http://localhost:3001/api/v1/gardens/${gardens[0].id}`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "DELETE" },
    }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("DELETE");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("PATCH");
    expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");
  });

  test("logout revokes a previously valid session", async () => {
    const cookie = await signUp("logout@example.com");
    expect((await request("/api/v1/me", cookie)).status).toBe(200);
    expect((await request("/api/auth/sign-out", cookie, {})).status).toBe(200);
    expect((await request("/api/v1/me", cookie)).status).toBe(401);
  });

  test("OpenAPI includes native auth, protected routes, schemas, and errors", async () => {
    expect((await request("/openapi")).status).toBe(200);
    const response = await request("/openapi/json");
    expect(response.status).toBe(200);
    const schema = await response.json();
    expect(schema.paths["/api/auth/sign-up/email"].post.requestBody).toBeDefined();
    expect(schema.paths["/api/auth/sign-in/social"].post).toBeDefined();
    expect(schema.paths["/api/v1/dashboard"].get.security).toEqual([{ bffSession: [] }]);
    expect(schema.paths["/api/v1/dashboard"].get.responses["200"].content["application/json"].schema).toBeDefined();
    expect(schema.paths["/api/v1/dashboard"].get.responses["401"]).toBeDefined();
    const dashboardSchema = schema.paths["/api/v1/dashboard"].get.responses["200"].content["application/json"].schema;
    expect(dashboardSchema.properties.plants.items.properties.status.enum)
      .toEqual(["healthy", "needs_care"]);
    expect(dashboardSchema.properties.insights.properties.items.items.required).toContain("needsFollowUp");
    expect(schema.paths["/api/v1/plants/{id}/api-keys"].post.responses["501"]).toBeDefined();
    const shedRoutes = [
      ["/api/v1/gardens", "post", "201"],
      ["/api/v1/gardens/{id}", "delete", "204"],
      ["/api/v1/gardens/{id}/plants", "post", "201"],
      ["/api/v1/plants/{id}", "patch", "200"],
      ["/api/v1/plants/{id}", "delete", "204"],
      ["/api/v1/plants/{id}/api-keys", "get", "200"],
      ["/api/v1/plants/{id}/api-keys", "post", "200"],
    ];
    for (const [path, method, success] of shedRoutes) {
      const operation = schema.paths[path!][method!];
      expect(operation.security).toEqual([{ bffSession: [] }]);
      expect(operation.responses[success!]).toBeDefined();
      if (success === "204") expect(operation.responses[success].content).toBeUndefined();
      expect(operation.responses["501"]).toBeDefined();
      expect(operation.responses["401"]).toBeDefined();
    }
    expect(schema.paths["/api/v1/gardens/{id}/plants"].post.requestBody.content["application/json"].schema.required)
      .toEqual(["name", "species"]);
    expect(schema.components.securitySchemes.bffSession.in).toBe("cookie");
  });
});
