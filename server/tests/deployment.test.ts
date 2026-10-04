import { expect, test } from "bun:test";
import { createApp } from "../src/app";
import { createAuth, demoCredentials } from "../src/auth";
import { MockBackend } from "../src/backend";
import { loadConfig } from "../src/config";

const productionEnv = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "deployment-test-secret-at-least-32-characters",
  BETTER_AUTH_URL: "https://api.grove.example",
  FRONTEND_ORIGINS: "https://grove.example",
};

test("production requires a stable secret even with demo enabled", () => {
  expect(() => loadConfig({ NODE_ENV: "production", ALLOW_DEMO_IN_PRODUCTION: "true" }))
    .toThrow("BETTER_AUTH_SECRET is required");
});

test("production still refuses missing adapters without explicit demo opt-in", async () => {
  const config = loadConfig(productionEnv);
  expect(config.seedDemo).toBe(false);
  await expect(createApp({ config })).rejects.toThrow("Configure the real backend adapter");
  await expect(createApp({ config, backend: new MockBackend() })).rejects.toThrow("Configure durable Better Auth storage");
  expect(loadConfig({ ...productionEnv, ALLOW_DEMO_IN_PRODUCTION: "false" }).allowDemoInProduction).toBe(false);
});

test("explicit production demo supports sessions, secure cookies, and fixture hydration", async () => {
  const config = loadConfig({ ...productionEnv, ALLOW_DEMO_IN_PRODUCTION: "true" });
  const { app } = await createApp({ config });
  const login = await app.handle(new Request("https://api.grove.example/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: "https://grove.example", "Content-Type": "application/json" },
    body: JSON.stringify({ email: demoCredentials.email, password: demoCredentials.password }),
  }));
  expect(login.status).toBe(200);
  const cookies = login.headers.getSetCookie();
  expect(cookies.some(cookie => cookie.startsWith("__Secure-better-auth.session_token=") && cookie.includes("Secure"))).toBe(true);
  const cookie = cookies.map(value => value.split(";")[0]).join("; ");
  const gardens = await app.handle(new Request("https://api.grove.example/api/v1/gardens", {
    headers: { Cookie: cookie, Origin: "https://grove.example" },
  }));
  expect(gardens.status).toBe(200);
  expect((await gardens.json()).gardens).toHaveLength(3);

  // The public demo account can still be disabled independently.
  expect(loadConfig({ ...productionEnv, ALLOW_DEMO_IN_PRODUCTION: "true", SEED_DEMO_ACCOUNT: "false" }).seedDemo).toBe(false);
  expect(() => createAuth(loadConfig(productionEnv))).toThrow("Configure durable Better Auth storage");
});
