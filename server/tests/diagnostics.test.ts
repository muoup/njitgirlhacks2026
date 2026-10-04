import { describe, expect, spyOn, test } from "bun:test";
import { failureDetails } from "../src/diagnostics";
import { ApiError } from "../src/errors";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { GeminiRunner } from "../src/agent/runner";
import { testVertexAuth } from "./vertex-auth";

describe("server failure diagnostics", () => {
  test("cause/retry traces keep provider reasons and exclude messages, keys, and payloads", () => {
    const provider = Object.assign(new Error("private-prompt\n    at private-memory:1:2"), {
      statusCode: 400, url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=private-key",
      requestBodyValues: { text: "private-prompt" }, responseHeaders: { authorization: "private-key" },
      data: { error: { code: 400, status: "INVALID_ARGUMENT" } },
      responseBody: JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT", message: "private-key private-memory",
        details: [{ reason: "API_KEY_INVALID", metadata: { key: "private-key" } }] } }),
    });
    const retry = Object.assign(new Error("private-output"), { lastError: provider });
    const detail = failureDetails(new ApiError(502, "AGENT_FAILED", "Public message", { cause: retry }));
    expect(detail.errors).toHaveLength(3);
    expect(detail.errors[2]).toMatchObject({ status: 400, provider: { status: "INVALID_ARGUMENT", reasons: ["API_KEY_INVALID"] } });
    expect(detail.errors[2]!.stack?.length).toBeGreaterThan(0);
    expect(detail.hint).toContain("API key");
    const serialized = JSON.stringify(detail);
    for (const sensitive of ["private-key", "private-prompt", "private-memory", "private-output", "requestBodyValues", "responseBody", "authorization"]) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  test("HTTP Vertex failures log their original cause while keeping client errors generic", async () => {
    const fetch: typeof globalThis.fetch = Object.assign(async () => Response.json({ error: {
      code: 403, status: "PERMISSION_DENIED", message: "private-prompt private-key",
      details: [{ reason: "IAM_PERMISSION_DENIED" }],
    } }, { status: 403 }), { preconnect: () => {} });
    const { app } = await createApp({ config: loadConfig({ SEED_DEMO_ACCOUNT: "false" }), agentRunner: new GeminiRunner({ project: "test-project", location: "global" }, { fetch, googleAuthOptions: testVertexAuth }) });
    const post = (path: string, body: object, cookie?: string) => app.handle(new Request(`http://localhost:3001${path}`, {
      method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    }));
    const signup = await post("/api/auth/sign-up/email", { name: "Logger Tester", email: "logger@example.com", password: "TestPassword2026!" });
    const cookie = signup.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    const log = spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await post("/api/v1/chat", { persona: "gnome", message: "private-prompt", requestId: "diagnostic" }, cookie);
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: { code: "AGENT_FAILED", message: "The mentor could not complete this run. Try again." } });
      expect(log).toHaveBeenCalledTimes(1);
      const detail = JSON.parse(log.mock.calls[0]![1] as string);
      expect(detail.path).toBe("/api/v1/chat");
      expect(detail.errors.some((error: { status?: number }) => error.status === 403)).toBe(true);
      expect(detail.hint).toContain("roles/aiplatform.user");
      expect(JSON.stringify(detail)).not.toContain("private-key");
      expect(JSON.stringify(detail)).not.toContain("private-prompt");
    } finally { log.mockRestore(); }
  });

  test("missing ADC and disabled Cloud API failures explain the required setup", () => {
    const missing = failureDetails(new Error("Could not load the default credentials. private-memory"));
    expect(missing.errors[0]!.code).toBe("GOOGLE_ADC_MISSING");
    expect(missing.hint).toContain("gcloud auth application-default login");
    expect(JSON.stringify(missing)).not.toContain("private-memory");
    const disabled = failureDetails(Object.assign(new Error("private-output"), {
      statusCode: 403, url: "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google/models/gemini-3.8-flash:generateContent",
      data: { error: { status: "PERMISSION_DENIED", code: 403, details: [{ reason: "SERVICE_DISABLED" }] } },
    }));
    expect(disabled.hint).toContain("aiplatform.googleapis.com");
  });
});
