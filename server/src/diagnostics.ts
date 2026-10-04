// SDK exceptions can contain entire prompts, generated text, headers, and API keys.
// Log a small allowlist rather than passing those exceptions to console.error.
function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}
function token(value: unknown) {
  return typeof value === "string" && /^[\w.$-]{1,100}$/.test(value) ? value : undefined;
}
function redact(value: string) {
  let result = value;
  for (const secret of [process.env.GEMINI_API_KEY, process.env.GOOGLE_GENERATIVE_AI_API_KEY, process.env.GOOGLE_VERTEX_API_KEY, process.env.BETTER_AUTH_SECRET,
    process.env.DATABASE_URL, process.env.DEVICE_API_KEY_ENCRYPTION_KEY, process.env.GOOGLE_CLIENT_SECRET]) {
    if (secret) result = result.split(secret).join("[redacted]");
  }
  return result.replace(/AIza[\w-]{20,}/g, "[redacted]")
    .replace(/grove_device_[A-Za-z0-9_-]{43}/g, "[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s)]+/g, "[redacted]")
    .replace(/(https?:\/\/[^\s?]+)\?[^\s)]*/g, "$1?[redacted]");
}
function endpoint(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? redact(`${url.origin}${url.pathname}`) : undefined;
  } catch { return undefined; }
}
function providerDetails(error: Record<string, unknown>) {
  let body = record(error.data);
  if (typeof error.responseBody === "string" && error.responseBody.length < 65_536) {
    // Raw JSON often retains ErrorInfo reasons that the SDK's parsed schema drops.
    try { body = record(JSON.parse(error.responseBody)) ?? body; } catch { /* Not a JSON API error. */ }
  }
  const provider = record(body?.error);
  if (!provider) return undefined;
  const reasons = Array.isArray(provider.details) ? provider.details.map(detail => token(record(detail)?.reason)).filter(Boolean) : [];
  return {
    status: token(provider.status), code: typeof provider.code === "number" ? provider.code : undefined,
    reasons: reasons.length ? reasons : undefined,
  };
}

export function failureDetails(error: unknown) {
  const seen = new Set<unknown>();
  const chain: Array<{
    name: string; code?: string; status?: number; url?: string; retryable?: boolean;
    provider?: ReturnType<typeof providerDetails>; stack?: string[];
  }> = [];
  let current = error;
  while (current && !seen.has(current) && chain.length < 6) {
    seen.add(current);
    const value = record(current);
    if (!value) { chain.push({ name: "UnknownError" }); break; }
    const status = typeof value.statusCode === "number" ? value.statusCode : typeof value.status === "number" ? value.status : undefined;
    // Classify a known library error without emitting its message or credentials.
    const missingCredentials = typeof value.message === "string" && value.message.includes("Could not load the default credentials");
    chain.push({ name: token(value.name) ?? "Error", code: token(value.code) ?? (missingCredentials ? "GOOGLE_ADC_MISSING" : undefined), status,
      url: endpoint(value.url), retryable: typeof value.isRetryable === "boolean" ? value.isRetryable : undefined,
      provider: providerDetails(value),
      // Exclude the first stack line: error messages can embed model responses.
      stack: stackFrames(value),
    });
    current = value.cause ?? value.lastError;
  }
  const provider = chain.find(item => {
    if (!item.url) return false;
    const host = new URL(item.url).hostname;
    return host === "generativelanguage.googleapis.com" || host === "aiplatform.googleapis.com" || host.endsWith("-aiplatform.googleapis.com") || host.endsWith(".aiplatform.googleapis.com");
  });
  const vertex = provider?.url && new URL(provider.url).hostname !== "generativelanguage.googleapis.com";
  const reason = provider?.provider?.reasons?.[0];
  const hint = chain.some(item => item.code === "GOOGLE_ADC_MISSING") ? "Google Application Default Credentials are missing. Run gcloud auth application-default login, then gcloud auth application-default set-quota-project with your GOOGLE_VERTEX_PROJECT."
    : reason === "SERVICE_DISABLED" ? "Enable the Vertex AI / Agent Platform API (aiplatform.googleapis.com) in the configured Cloud project."
    : reason?.includes("API_KEY") ? "Google rejected the API key or its restrictions. Check the key's API/project permissions."
    : vertex && (provider?.status === 401 || provider?.status === 403) ? "Vertex AI denied access. Check Application Default Credentials, roles/aiplatform.user, the enabled aiplatform.googleapis.com API, and the project's billing account."
    : provider?.status === 401 || provider?.status === 403 ? "Google denied access. Check the API key, project access, and API restrictions."
    : provider?.status === 404 ? "Google could not find the requested model for this endpoint/project. Check model availability and access."
    : provider?.status === 429 ? "Google rejected the request because of quota or rate limits."
    : provider?.status === 400 ? "Google rejected the request configuration. Check model features, thinking settings, and schemas."
    : chain.some(item => item.code === "AGENT_NOT_CONFIGURED") ? "Set GOOGLE_VERTEX_PROJECT in server/.env and configure Google Application Default Credentials, then restart the BFF."
    : chain.some(item => item.code === "AGENT_TIMEOUT") ? "The model run exceeded the BFF timeout."
    : undefined;
  return { errors: chain, hint };
}

function stackFrames(error: Record<string, unknown>) {
  if (typeof error.stack !== "string") return undefined;
  let stack = error.stack;
  // Strip the entire message, including embedded newlines that look like frames.
  if (typeof error.message === "string" && error.message) {
    const at = stack.indexOf(error.message);
    if (at >= 0) stack = stack.slice(at + error.message.length);
  }
  return stack.split("\n").filter(line => /^\s*at\s/.test(line)).slice(0, 12).map(redact);
}

export function logFailure(error: unknown, context: { scope: string; path?: string; accountId?: string }) {
  console.error("BFF failure", JSON.stringify({ timestamp: new Date().toISOString(), ...context, ...failureDetails(error) }, null, 2));
}
