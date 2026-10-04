import { expect, test } from "bun:test";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";

test("a slow mentor replies over HTTP after Bun's default idle deadline", async () => {
  const { app } = await createApp({
    config: loadConfig({ SEED_DEMO_ACCOUNT: "false" }),
    agentRunner: { async run() {
      await Bun.sleep(12_000);
      return { reply: "The mentor finished thinking." };
    } },
  });
  const signup = await app.handle(new Request("http://localhost:3001/api/auth/sign-up/email", {
    method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Chat Tester", email: "transport@example.com", password: "TestPassword2026!" }),
  }));
  expect(signup.status).toBe(200);
  const cookie = signup.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  app.listen({ hostname: "127.0.0.1", port: 0 });
  try {
    const response = await fetch(`http://127.0.0.1:${app.server!.port}/api/v1/chat`, {
      method: "POST", headers: { Origin: "http://localhost:3000", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ persona: "gnome", message: "Hello", requestId: "slow-chat" }),
      signal: AbortSignal.timeout(18_000),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect((await response.json()).reply).toBe("The mentor finished thinking.");
  } finally { await app.stop(true); }
}, 20_000);
