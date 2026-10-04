import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { postgresFixture } from "./postgres-fixture";
import { authDatabase, migrate, checkDatabase } from "../src/storage/database";
import { PostgresBackend } from "../src/storage/postgres-backend";
import { createApp } from "../src/app";
import { setPassword } from "../src/auth";
import { loadConfig } from "../src/config";
import { AgentService } from "../src/agent/service";
import type { BackendIdentity } from "../src/backend";
import type { IngestData } from "../src/ingestion";
import { DomainService } from "../src/domain";
import type { WeatherSource } from "../src/weather";

const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const origin = "http://localhost:3000";
const config = loadConfig({ BETTER_AUTH_SECRET: "integration-test-secret-at-least-32-characters", SEED_DEMO_ACCOUNT: "false" });
const now = Date.parse("2026-10-04T12:00:00Z");
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let backend: PostgresBackend;
let runtime: Awaited<ReturnType<typeof createApp>>;
let alice: BackendIdentity;
let bob: BackendIdentity;
let cookie: string;
let bobCookie: string;
let gardenId: string;
let plantId: string;
let key: string;
const sample: IngestData = { sampleId: "boot-abcd:1", color: "#3D8040", measurements: [
  { metric: "soil_moisture_raw", value: 45, unit: "ADC" },
  { metric: "air_quality_raw", value: 50, unit: "raw" },
  { metric: "light_level_raw", value: 400, unit: "ADC" },
  { metric: "pressure", value: 101325, unit: "Pa" },
  { metric: "temperature", value: 23, unit: "°C" },
  { metric: "altitude", value: 25, unit: "m" },
] };
// Stands in for the forecast service, and counts what it is asked.
const asked: Array<{ latitude: number; longitude: number }> = [];
const rainy = { date: "2026-10-06", day: "Tuesday", sky: "Showers" as const, high: 30, low: 25, rain: 8.3, rainChance: 63, sunshine: 6, gust: 14, alerts: ["rain" as const] };
const weather: WeatherSource = {
  async search(query) { return query === "Miami" ? [{ name: "Miami, Florida, United States", latitude: 25.77, longitude: -80.19 }] : []; },
  async forecast(place) { asked.push(place); return { fetchedAt: new Date(now).toISOString(), days: [rainy] }; },
};
function request(path: string, body?: unknown, session = cookie, method = body === undefined ? "GET" : "POST", headers: Record<string,string> = {}) {
  return runtime.app.handle(new Request(`http://localhost:3001${path}`, { method,
    headers: { Origin: origin, ...(session ? { Cookie: session } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined }));
}
beforeAll(async () => {
  fixture = await postgresFixture();
  await migrate(fixture.pool);
  await migrate(fixture.pool); // Applied migrations must be repeatable.
  backend = new PostgresBackend(fixture.pool, encryptionKey, () => now);
  runtime = await createApp({ config, backend, authDatabase: authDatabase(fixture.pool), weather });
  async function signup(email: string) {
    const response = await request("/api/auth/sign-up/email", { name: email.split("@")[0], email, password: "FixturePassword2026!" }, "");
    expect(response.status).toBe(200);
    const body = await response.json();
    return { identity: { version: "v1" as const, accountId: body.user.id, userId: body.user.id },
      cookie: response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ") };
  }
  ({ identity: alice, cookie } = await signup("alice@fixture.example"));
  ({ identity: bob, cookie: bobCookie } = await signup("bob@fixture.example"));
}, 30_000);
afterAll(async () => { await fixture?.pool.end(); });

describe("PostgreSQL-backed app", () => {
  test("schema checks pass and new accounts start empty", async () => {
    expect((await checkDatabase(fixture.pool)).schemaReady).toBe(true);
    expect((await backend.listGardens(alice)).gardens).toEqual([]);
  });
  test("garden/plant creation is durable, owner-scoped, and idempotent", async () => {
    const garden = await request("/api/v1/gardens", { name: "Windowsill" }, cookie, "POST", { "Idempotency-Key": "garden-1" });
    expect(garden.status).toBe(201);
    gardenId = (await garden.json()).garden.id;
    const duplicate = await request("/api/v1/gardens", { name: "Windowsill" }, cookie, "POST", { "Idempotency-Key": "garden-1" });
    expect((await duplicate.json()).garden.id).toBe(gardenId);
    const conflict = await request("/api/v1/gardens", { name: "Different" }, cookie, "POST", { "Idempotency-Key": "garden-1" });
    expect(conflict.status).toBe(409);
    const response = await request(`/api/v1/gardens/${gardenId}/plants`, { name: "Basil", species: "Ocimum basilicum" }, cookie, "POST", { "Idempotency-Key": "plant-1" });
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const planted = await response.json(); plantId = planted.plant.id; key = planted.apiKey.key;
    const repeated = await request(`/api/v1/gardens/${gardenId}/plants`, { name: "Basil", species: "Ocimum basilicum" }, cookie, "POST", { "Idempotency-Key": "plant-1" });
    expect(await repeated.json()).toEqual(planted);
    expect((await backend.listGardens(alice)).gardens[0]?.plantCount).toBe(1);
    expect((await request(`/api/v1/dashboard?gardenId=${gardenId}`, undefined, bobCookie)).status).toBe(404);
    expect((await request(`/api/v1/plants/${plantId}/api-keys`, undefined, bobCookie)).status).toBe(404);
    expect((await request(`/api/v1/plants/${plantId}`, undefined, bobCookie, "DELETE")).status).toBe(404);
    const stored = await fixture.pool.query("SELECT encrypted_key FROM grove.device_keys WHERE plant_id=$1", [plantId]);
    expect(stored.rows[0].encrypted_key).not.toContain(key);
    const ledger = await fixture.pool.query("SELECT result FROM grove.mutations WHERE request_id='plant-1'");
    expect(JSON.stringify(ledger.rows)).not.toContain(key);
    expect((await backend.hydrateDashboard(alice, gardenId))?.devices[0]?.lastSeenAt).toBeNull();
  });
  test("a garden's owner alone can say where it is, and its dashboard then carries a forecast", async () => {
    const before = (await backend.listGardens(alice)).gardens[0]!;
    expect(before).toMatchObject({ setting: "indoors" });
    expect(before.location).toBeUndefined();
    expect((await (await request(`/api/v1/dashboard?gardenId=${gardenId}`)).json()).forecast).toBeUndefined();
    expect(asked).toHaveLength(0);
    expect(await (await request("/api/v1/places?query=Miami")).json()).toEqual({ places: [{ name: "Miami, Florida, United States", latitude: 25.77, longitude: -80.19 }] });
    expect((await request("/api/v1/places?query=M")).status).toBe(422);
    const version = async () => (await fixture.pool.query("SELECT data_version FROM grove.agent_accounts WHERE account_id=$1", [alice.accountId])).rows[0].data_version;
    const start = await version();

    const place = { name: " Miami, Florida, United States ", latitude: 25.77427, longitude: -80.19366 };
    expect((await request(`/api/v1/gardens/${gardenId}`, { setting: "outdoors", location: place }, bobCookie, "PATCH")).status).toBe(404);
    expect((await request(`/api/v1/gardens/${gardenId}`, { setting: "outdoors", location: place }, "", "PATCH")).status).toBe(401);
    for (const invalid of [{}, { setting: "balcony" }, { location: { name: "Nowhere", latitude: 91, longitude: 0 } }, { location: { name: "Half", latitude: 1 } }]) {
      expect((await request(`/api/v1/gardens/${gardenId}`, invalid, cookie, "PATCH")).status).toBe(422);
    }
    const placed = await request(`/api/v1/gardens/${gardenId}`, { setting: "outdoors", location: place }, cookie, "PATCH");
    expect(placed.status).toBe(200);
    const garden = { ...before, setting: "outdoors" as const, location: { name: "Miami, Florida, United States", latitude: 25.77, longitude: -80.19 } };
    expect(await placed.json()).toEqual({ garden });
    expect((await backend.listGardens(alice)).gardens).toEqual([garden]);
    // Insights written before the garden had weather are stale; saying the same again changes nothing.
    expect(await version()).toBe(start + 1);
    await request(`/api/v1/gardens/${gardenId}`, { setting: "outdoors" }, cookie, "PATCH");
    expect(await version()).toBe(start + 1);

    const dashboard = await (await request(`/api/v1/dashboard?gardenId=${gardenId}`)).json();
    expect(dashboard.forecast).toEqual({ place: garden.location.name, fetchedAt: new Date(now).toISOString(), days: [rainy] });
    expect(asked).toEqual([garden.location]);

    // A name alone leaves the place be; null forgets it.
    expect((await (await request(`/api/v1/gardens/${gardenId}`, { name: "Sill" }, cookie, "PATCH")).json()).garden).toEqual({ ...garden, name: "Sill" });
    const cleared = await request(`/api/v1/gardens/${gardenId}`, { name: "Windowsill", setting: "indoors", location: null }, cookie, "PATCH");
    expect((await cleared.json()).garden).toEqual(before);
    expect((await (await request(`/api/v1/dashboard?gardenId=${gardenId}`)).json()).forecast).toBeUndefined();
    await expect(fixture.pool.query("UPDATE grove.gardens SET place='Somewhere' WHERE id=$1", [gardenId])).rejects.toThrow();
  });
  test("firmware can ingest every prototype sensor without a browser session", async () => {
    const response = await request("/api/v1/ingest/readings", sample, "", "POST", { Authorization: `Bearer ${key}` });
    expect(response.status).toBe(201);
    const accepted = await response.json();
    expect(accepted.duplicate).toBe(false);
    const retried = await request("/api/v1/ingest/readings", sample, "", "POST", { Authorization: `Bearer ${key}` });
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({ ...accepted, duplicate: true });
    const reordered = { measurements: sample.measurements.map(({ metric, value, unit }) => ({ unit, metric, value })).reverse(), sampleId: sample.sampleId, color: "#3d8040" };
    expect((await request("/api/v1/ingest/readings", reordered, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(200);
    const conflicting = await request("/api/v1/ingest/readings", { ...sample, measurements: sample.measurements.slice(1) }, "", "POST", { Authorization: `Bearer ${key}` });
    expect(conflicting.status).toBe(409);
    expect((await request("/api/v1/ingest/readings", { ...sample, color: "#000000" }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(409);
    const dashboard = (await request(`/api/v1/dashboard?gardenId=${gardenId}`));
    expect(dashboard.status).toBe(200);
    const data = await dashboard.json();
    expect(data.meta.source).toBe("backend");
    expect(data.latestReadings[0].measurements).toHaveLength(6);
    expect(data.latestReadings[0].color).toBe("#3d8040");
    expect(data.devices[0].lastSeenAt).toBe(new Date(now).toISOString());
    const history = await backend.getReadings(alice, plantId, { from: new Date(now-86400000).toISOString(), to: new Date(now).toISOString() });
    expect(history?.readings).toHaveLength(1);
    expect(history?.sampling?.method).toBe("last");
    expect(await backend.getReadings(bob, plantId, { from: new Date(now-86400000).toISOString(), to: new Date(now).toISOString() })).toBeNull();
  });
  test("ingestion rejects cookie-only auth, spoofed ownership, wrong units, and duplicate metrics", async () => {
    expect((await request("/api/v1/ingest/readings", sample)).status).toBe(401);
    expect((await request("/api/v1/ingest/readings", { ...sample, plantId }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(422);
    expect((await request("/api/v1/ingest/readings", { ...sample, measurements: [{ metric: "soil_moisture_raw", value: 45, unit: "%" }] }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(422);
    expect((await request("/api/v1/ingest/readings", { ...sample, measurements: [sample.measurements[0], sample.measurements[0]] }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(422);
    // One hex value is the colour; the four channel counts it replaced are no longer taken.
    for (const color of ["3d8040", "#3d80", "green"]) {
      expect((await request("/api/v1/ingest/readings", { ...sample, sampleId: "boot-abcd:2", color }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(422);
    }
    expect((await request("/api/v1/ingest/readings", { sampleId: "boot-abcd:2", measurements: [{ metric: "color_red", value: 240, unit: "count" }] }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(422);
    expect((await request("/api/v1/gardens", { name: "Cross site" }, cookie, "POST", { Origin: "https://attacker.example" })).status).toBe(403);
  });
  test("memory compare-and-swap rejects competing writes and survives new adapter instances", async () => {
    const writes = await Promise.allSettled([
      backend.writeMemory(alice, { markdown: "Prefers basil", expectedRevision: 0 }),
      backend.writeMemory(alice, { markdown: "Competing", expectedRevision: 0 }),
    ]);
    expect(writes.filter(w => w.status === "fulfilled")).toHaveLength(1);
    expect(writes.filter(w => w.status === "rejected")).toHaveLength(1);
    expect((await new PostgresBackend(fixture.pool, encryptionKey).readMemory(alice)).revision).toBe(1);
    expect((await backend.readMemory(bob)).markdown).toBe("");
  });
  test("dense history is bounded and represents actual samples", async () => {
    // Faster than sending hundreds of HTTP requests; exercise real history SQL.
    const deviceId = (await fixture.pool.query("SELECT id FROM grove.devices WHERE plant_id=$1", [plantId])).rows[0].id;
    await fixture.pool.query(`INSERT INTO grove.sensor_readings(plant_id,device_id,sample_id,measured_at,received_at,measurements)
      SELECT $1,$2,'dense:'||n,$3::timestamptz-make_interval(secs=>n),$3::timestamptz,$4::jsonb FROM generate_series(1,2000) AS n`,
      [plantId, deviceId, new Date(now).toISOString(), JSON.stringify(sample.measurements)]);
    const result = await backend.getReadings(alice, plantId, { from: new Date(now-3600000).toISOString(), to: new Date(now).toISOString() });
    expect(result!.readings.length).toBeLessThanOrEqual(61);
    expect(result!.readings.at(-1)?.measuredAt).toBe(new Date(now).toISOString());
    expect(result!.sampling).toEqual({ method: "last", bucketSeconds: 60 });
    // Stored as 45 ADC; shown on the soil calibration.
    expect(result!.readings[0]?.measurements[0]).toEqual({ metric: "soil_moisture_raw", value: 9, unit: "%", word: "Dry" });
  });
  test("approval fingerprints are rechecked inside the mutation transaction", async () => {
    const domain = new DomainService(backend);
    const action = { kind: "removeGarden" as const, gardenId };
    const target = await domain.inspect(alice, action);
    const added = await backend.mutate(alice, { kind: "createPlant", gardenId, name: "Thyme", species: "Thymus vulgaris" }, "concurrent-plant");
    await expect(backend.mutate(alice, action, "stale-approval", target.fingerprint)).rejects.toThrow("The target changed");
    expect(await backend.hydrateDashboard(alice, gardenId)).not.toBeNull();
    if (added && "plant" in added) await backend.mutate(alice, { kind: "removePlant", plantId: added.plant.id }, "remove-thyme");
  });
  test("a plant can be renamed by its owner alone, keeping its key and readings", async () => {
    const path = `/api/v1/plants/${plantId}`;
    expect((await request(path, { name: "Stolen" }, bobCookie, "PATCH")).status).toBe(404);
    expect((await request(path, {}, cookie, "PATCH")).status).toBe(422);
    const history = (await backend.getReadings(alice, plantId, { from: new Date(now - 86_400_000).toISOString(), to: new Date(now).toISOString() }))?.readings.length;
    const renamed = await request(path, { name: "  Sweet basil " }, cookie, "PATCH");
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).plant).toEqual({ id: plantId, gardenId, name: "Sweet basil", species: "Ocimum basilicum" });
    const dashboard = await backend.hydrateDashboard(alice, gardenId);
    expect(dashboard?.plants[0]).toMatchObject({ name: "Sweet basil", species: "Ocimum basilicum" });
    // The monitor was named after the plant, so it follows the new name.
    expect(dashboard?.devices[0]?.name).toBe("Sweet basil monitor");
    expect((await (await request(`${path}/api-keys`)).json()).apiKey.key).toBe(key);
    expect((await backend.getReadings(alice, plantId, { from: new Date(now - 86_400_000).toISOString(), to: new Date(now).toISOString() }))?.readings.length).toBe(history);
    const both = await request(path, { name: "Basil", species: "Ocimum basilicum 'Genovese'" }, cookie, "PATCH");
    expect((await both.json()).plant).toMatchObject({ name: "Basil", species: "Ocimum basilicum 'Genovese'" });
  });
  test("auth sessions and keys survive recreation; rotation immediately rejects old keys", async () => {
    runtime = await createApp({ config, backend: new PostgresBackend(fixture.pool, encryptionKey, () => now), authDatabase: authDatabase(fixture.pool), weather });
    expect((await request("/api/v1/me")).status).toBe(200);
    expect((await (await request(`/api/v1/plants/${plantId}/api-keys`)).json()).apiKey.key).toBe(key);
    const rotated = await request(`/api/v1/plants/${plantId}/api-keys`, {}, cookie);
    expect(rotated.status).toBe(200);
    const replacement = (await rotated.json()).apiKey.key;
    expect(replacement).not.toBe(key);
    expect((await request("/api/v1/ingest/readings", { ...sample, sampleId: "boot-abcd:2" }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(401);
    key = replacement;
    expect((await request("/api/v1/ingest/readings", { ...sample, sampleId: "boot-abcd:2" }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(201);
  });
  test("a forgotten password can be replaced from the server, leaving sessions signed in", async () => {
    const signIn = (password: string) => request("/api/auth/sign-in/email", { email: "bob@fixture.example", password }, "");
    await expect(setPassword(runtime.auth, "nobody@fixture.example", "ReplacedPassword2026!")).rejects.toThrow("No account");
    await expect(setPassword(runtime.auth, "bob@fixture.example", "short")).rejects.toThrow("characters");
    expect((await signIn("FixturePassword2026!")).status).toBe(200);
    await setPassword(runtime.auth, " Bob@Fixture.example ", "ReplacedPassword2026!");
    expect((await signIn("FixturePassword2026!")).status).toBe(401);
    expect((await signIn("ReplacedPassword2026!")).status).toBe(200);
    expect((await request("/api/v1/me", undefined, bobCookie)).status).toBe(200);
  });
  test("generated insights persist and cron rediscovers accounts after service recreation", async () => {
    let calls = 0;
    const runner = { async run(input: any) {
      calls++;
      if (calls === 1) await input.tools.updateMemory.execute({ markdown: "Updated during scheduled generation", expectedRevision: input.context.memory.revision });
      return { gardens: input.context.gardens.map((g: any) => ({ gardenId: g.garden.id, items: [],
        overviews: g.plants.map((p: any) => ({ plantId: p.id, urgency: null, headline: "Raw sensors", text: "Await calibration", evidence: [], blocks: [] })) })) };
    } };
    const agent = new AgentService(backend, runner, () => now);
    await agent.refresh(alice);
    expect((await backend.getInsights(alice, gardenId))?.insights.generation?.state).toBe("ready");
    const restarted = new AgentService(new PostgresBackend(fixture.pool, encryptionKey, () => now), runner, () => now);
    await restarted.refresh(alice, false);
    expect(calls).toBe(1);
    await backend.ingest(key, { ...sample, sampleId: "boot-abcd:3" });
    expect((await backend.getInsights(alice, gardenId))?.insights.generation?.state).toBe("stale");
    await restarted.tick();
    expect(calls).toBe(2);
    expect((await backend.getInsights(alice, gardenId))?.insights.overviews?.[0]?.headline).toBe("Raw sensors");
    const failing = new AgentService(backend, { async run() { throw new Error("fixture failure"); } }, () => now);
    await expect(failing.refresh(alice)).rejects.toThrow("The mentor could not complete this run");
    const retained = await backend.getInsights(alice, gardenId);
    expect(retained?.insights.generation?.state).toBe("failed");
    expect(retained?.insights.overviews).toHaveLength(1);
    const retryAfterRestart = new AgentService(backend, runner, () => now);
    await retryAfterRestart.tick();
    expect(calls).toBe(3);
    expect((await backend.getInsights(alice, gardenId))?.insights.generation?.state).toBe("ready");
  });
  test("garden deletion cascades to readings and credentials", async () => {
    const headers = { "Idempotency-Key": "remove-garden" };
    expect((await request(`/api/v1/gardens/${gardenId}`, undefined, cookie, "DELETE", headers)).status).toBe(204);
    expect((await request(`/api/v1/gardens/${gardenId}`, undefined, cookie, "DELETE", headers)).status).toBe(204);
    expect((await request("/api/v1/ingest/readings", { ...sample, sampleId: "boot-abcd:4" }, "", "POST", { Authorization: `Bearer ${key}` })).status).toBe(401);
    expect((await fixture.pool.query("SELECT count(*)::int AS count FROM grove.sensor_readings")).rows[0].count).toBe(0);
    expect((await fixture.pool.query("SELECT count(*)::int AS count FROM grove.device_keys")).rows[0].count).toBe(0);
  });
});
