import { expect, spyOn, test } from "bun:test";
import { createBffApi } from "../src/lib/api/bff";
import { ApiError, NetworkError } from "../src/lib/api/types";
import { createRequestId } from "../src/lib/request-id";

test("chat can send a request when the browser has no secure-context randomUUID", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined });
  let requestId = "";
  const fetch = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (_url: RequestInfo | URL, options?: RequestInit) => {
    requestId = JSON.parse(options!.body as string).requestId;
    expect(options!.credentials).toBe("include");
    return Response.json({ conversationId: "conversation", reply: "Hello.", pendingActions: [], contextRevision: "revision" });
  }, { preconnect() {} }));
  try {
    const response = await createBffApi("http://vm.example:3001").askMentor({
      persona: "gnome", message: "Hello", requestId: createRequestId(),
    });
    expect(requestId).toMatch(/^[a-f0-9]{32}$/);
    expect(createRequestId()).not.toBe(requestId);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(response.reply).toBe("Hello.");
  } finally {
    fetch.mockRestore();
    if (descriptor) Object.defineProperty(crypto, "randomUUID", descriptor);
    else Reflect.deleteProperty(crypto, "randomUUID");
  }
});

test("transport failures are distinguished from HTTP agent errors and bad response JSON", async () => {
  const api = createBffApi("http://vm.example:3001");
  const request = { persona: "gnome" as const, message: "Hello", requestId: "test" };
  const fetch = spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
  try {
    await expect(api.askMentor(request)).rejects.toBeInstanceOf(NetworkError);
    fetch.mockImplementation(Object.assign(async () => Response.json({ error: { code: "AGENT_TIMEOUT", message: "The mentor took too long. Try again." } }, { status: 504 }), { preconnect() {} }));
    await expect(api.askMentor(request)).rejects.toBeInstanceOf(ApiError);
    await expect(api.askMentor(request)).rejects.toMatchObject({ status: 504, code: "AGENT_TIMEOUT" });
    fetch.mockImplementation(Object.assign(async () => new Response("not json"), { preconnect() {} }));
    await expect(api.askMentor(request)).rejects.toBeInstanceOf(SyntaxError);
  } finally { fetch.mockRestore(); }
});
