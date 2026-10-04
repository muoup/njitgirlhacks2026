import { expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { IngestRequest, validateSample, type IngestData } from "../src/ingestion";
import { DeviceKeys } from "../src/storage/keys";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { MockBackend } from "../src/backend";

test("sensor contract rejects unknown, nonfinite, fractional ADC, and future readings", () => {
  const sample: IngestData = { sampleId: "boot-1:42", measurements: [{ metric: "temperature", value: 20, unit: "°C" }] };
  expect(Value.Check(IngestRequest, sample)).toBe(true);
  for (const value of [NaN, Infinity, -Infinity, 151]) {
    expect(Value.Check(IngestRequest, { ...sample, measurements: [{ metric: "temperature", value, unit: "°C" }] })).toBe(false);
  }
  expect(Value.Check(IngestRequest, { ...sample, measurements: [{ metric: "soil_moisture_raw", value: 5.5, unit: "ADC" }] })).toBe(false);
  expect(Value.Check(IngestRequest, { ...sample, measurements: [{ metric: "co2", value: 50, unit: "ppm" }] })).toBe(false);
  expect(() => validateSample({ ...sample, measuredAt: "2026-10-04T12:06:00Z" }, Date.parse("2026-10-04T12:00:00Z"))).toThrow("five minutes");
});

test("encrypted keys are bound to plant and encryption secret", () => {
  const keys = new DeviceKeys(Buffer.alloc(32, 1).toString("base64"));
  const issued = keys.issue("plant-1");
  expect(keys.decrypt(issued.encrypted, "plant-1")).toBe(issued.key);
  expect(() => keys.decrypt(issued.encrypted, "plant-2")).toThrow();
  expect(() => new DeviceKeys(Buffer.alloc(32, 2).toString("base64")).decrypt(issued.encrypted, "plant-1")).toThrow();
});

test("database config requires independent key encryption and stable auth secrets", () => {
  expect(() => loadConfig({ DATABASE_URL: "https://example.com" })).toThrow("PostgreSQL");
  expect(() => loadConfig({ DATABASE_URL: "postgres://localhost/grove" })).toThrow("DEVICE_API_KEY_ENCRYPTION_KEY");
  expect(() => loadConfig({ DATABASE_URL: "postgres://localhost/grove", DEVICE_API_KEY_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64") })).toThrow("BETTER_AUTH_SECRET");
});

test("ingestion rate limits are bounded and OpenAPI separates device and session auth", async () => {
  let count = 0;
  const backend = Object.assign(new MockBackend(), { async ingest() { count++; return {
    accepted: true as const, duplicate: false, measuredAt: "2026-10-04T12:00:00Z", receivedAt: "2026-10-04T12:00:00Z",
  }; } });
  const { app } = await createApp({ config: loadConfig({ SEED_DEMO_ACCOUNT: "false" }), backend });
  const key = `grove_device_${"a".repeat(43)}`;
  for (let i=0;i<121;i++) {
    const response = await app.handle(new Request("http://localhost:3001/api/v1/ingest/readings", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ sampleId: `boot-1:${i}`, measurements: [{ metric: "soil_moisture_raw", value: 800, unit: "ADC" }] }),
    }));
    expect(response.status).toBe(i === 120 ? 429 : 201);
    if (i === 120) expect(response.headers.get("Retry-After")).toBe("60");
  }
  expect(count).toBe(120);
  const spec = await (await app.handle(new Request("http://localhost:3001/openapi/json"))).json();
  expect(spec.paths["/api/v1/ingest/readings"].post.security).toEqual([{ plantApiKey: [] }]);
  expect(spec.paths["/api/v1/gardens"].get.security).toEqual([{ bffSession: [] }]);
  expect(spec.components.securitySchemes.plantApiKey.scheme).toBe("bearer");
});
