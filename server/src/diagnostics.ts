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

// pg sometimes throws plain Errors without a code. Translate only known driver
// messages into fixed labels; never print SQL errors or arbitrary message text.
function databaseCode(message: unknown) {
  if (typeof message !== "string") return undefined;
  switch (message) {
    case "Connection terminated due to connection timeout":
    case "timeout exceeded when trying to connect":
    case "timeout expired": return "DATABASE_CONNECTION_TIMEOUT";
    case "Connection terminated unexpectedly":
    case "Connection terminated": return "DATABASE_CONNECTION_CLOSED";
    case "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string":
    case "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string": return "DATABASE_PASSWORD_MISSING";
    case "The server does not support SSL connections": return "DATABASE_TLS_UNSUPPORTED";
    case "There was an error establishing an SSL connection": return "DATABASE_TLS_FAILED";
    case "self signed certificate in certificate chain": return "SELF_SIGNED_CERT_IN_CHAIN";
    case "Database migrations are missing. Run bun run db:migrate before starting the server.": return "DATABASE_SCHEMA_MISSING";
  }
  if (message.startsWith("SASL:")) return "DATABASE_SASL_FAILED";
  return undefined;
}

function databaseHint(codes: Array<string | undefined>) {
  if (codes.includes("DATABASE_PASSWORD_MISSING")) return "The driver received no usable database password. Include the PostgreSQL service password in DATABASE_URL and URL-encode special characters; a Tiger management API key is not the database password.";
  if (codes.some(code => code === "28P01" || code === "28000" || code === "DATABASE_SASL_FAILED")) return "Database authentication failed. Check the service username/password and URL encoding in DATABASE_URL.";
  if (codes.some(code => code === "DATABASE_CONNECTION_TIMEOUT" || code === "ETIMEDOUT" || code === "EHOSTUNREACH" || code === "ENETUNREACH")) return "The database connection timed out or could not reach the network. Check the service host/port, service status, Tiger IP allowlist, and VM outbound access. The connection timeout is 10 seconds.";
  if (codes.includes("ECONNREFUSED")) return "The database refused the connection. Check the service status and PostgreSQL host/port in DATABASE_URL.";
  if (codes.some(code => code === "ENOTFOUND" || code === "EAI_AGAIN")) return "The database hostname could not be resolved. Check DATABASE_URL and the VM's DNS access.";
  if (codes.includes("DATABASE_CONNECTION_CLOSED")) return "The database connection closed before completion. Check service status, the PostgreSQL endpoint, TLS settings, and network restrictions.";
  if (codes.some(code => code && /CERT|TLS|SSL/.test(code))) return "Database TLS negotiation or certificate verification failed. Check sslmode and the provider's trusted CA certificate settings.";
  if (codes.includes("3D000")) return "The requested database does not exist. Use the database name from the service's PostgreSQL connection details.";
  if (codes.includes("42501")) return "The database role lacks permission. Migrations need permission to create schemas/tables in this database.";
  if (codes.some(code => code === "DATABASE_SCHEMA_MISSING" || code === "42P01" || code === "3F000")) return "Application tables or schemas are missing. Run bun run db:migrate using the same DATABASE_URL.";
  return undefined;
}

export function failureDetails(error: unknown, options: { database?: boolean } = {}) {
  const seen = new Set<unknown>();
  const chain: Array<{
    name: string; code?: string; status?: number; url?: string; retryable?: boolean;
    provider?: ReturnType<typeof providerDetails>; stack?: string[];
  }> = [];
  const pending: unknown[] = [error];
  while (pending.length && chain.length < 6) {
    const current = pending.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const value = record(current);
    if (!value) { chain.push({ name: "UnknownError" }); break; }
    const status = typeof value.statusCode === "number" ? value.statusCode : typeof value.status === "number" ? value.status : undefined;
    // Classify a known library error without emitting its message or credentials.
    const missingCredentials = typeof value.message === "string" && value.message.includes("Could not load the default credentials");
    chain.push({ name: token(value.name) ?? "Error", code: token(value.code) ??
      (options.database ? databaseCode(value.message) : undefined) ?? (missingCredentials ? "GOOGLE_ADC_MISSING" : undefined), status,
      url: endpoint(value.url), retryable: typeof value.isRetryable === "boolean" ? value.isRetryable : undefined,
      provider: providerDetails(value),
      // Exclude the first stack line: error messages can embed model responses.
      stack: stackFrames(value),
    });
    const cause = value.cause ?? value.lastError;
    if (cause) pending.push(cause);
    if (Array.isArray(value.errors)) pending.push(...value.errors.slice(0, 6));
  }
  const provider = chain.find(item => {
    if (!item.url) return false;
    const host = new URL(item.url).hostname;
    return host === "generativelanguage.googleapis.com" || host === "aiplatform.googleapis.com" || host.endsWith("-aiplatform.googleapis.com") || host.endsWith(".aiplatform.googleapis.com");
  });
  const vertex = provider?.url && new URL(provider.url).hostname !== "generativelanguage.googleapis.com";
  const reason = provider?.provider?.reasons?.[0];
  const hint = options.database ? databaseHint(chain.map(item => item.code))
    : chain.some(item => item.code === "GOOGLE_ADC_MISSING") ? "Google Application Default Credentials are missing. Run gcloud auth application-default login, then gcloud auth application-default set-quota-project with your GOOGLE_VERTEX_PROJECT."
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
  console.error("BFF failure", JSON.stringify({ timestamp: new Date().toISOString(), ...context,
    ...failureDetails(error, { database: context.scope.startsWith("database-") }) }, null, 2));
}

// What a refused device submission looked like, for whoever is writing the firmware. The key is
// never logged, only whether one came. What the device sent is cut short and passed through
// `redact`, since nothing says a broken request holds only readings.
export function logIngestFailure(request: Request, failure: { status: number; code: string; reasons: string[]; body?: string }) {
  const sent = (name: string) => request.headers.get(name)?.slice(0, 120) ?? null;
  const authorization = request.headers.get("Authorization");
  console.error("Ingest failure", JSON.stringify({
    timestamp: new Date().toISOString(), status: failure.status, code: failure.code, reasons: failure.reasons,
    contentType: sent("Content-Type"), contentLength: sent("Content-Length"), userAgent: sent("User-Agent"),
    key: !authorization ? "missing" : /^Bearer grove_device_[A-Za-z0-9_-]{43}$/i.test(authorization) ? "well-formed" : "malformed",
    body: failure.body === undefined ? "(not read)" : redact(failure.body.length > 600 ? `${failure.body.slice(0, 600)}… (${failure.body.length} characters)` : failure.body),
  }, null, 2));
}
