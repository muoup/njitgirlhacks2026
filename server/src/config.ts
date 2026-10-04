export interface Config {
  port: number;
  baseURL: string;
  frontendOrigins: string[];
  production: boolean;
  allowDemoInProduction: boolean;
  authSecret: string;
  google?: { clientId: string; clientSecret: string };
  seedDemo: boolean;
  database?: { url: string; encryptionKey: string };
  agent: { project?: string; location: string; scheduleEnabled: boolean };
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const production = env.NODE_ENV === "production";
  const allowDemoInProduction = production && env.ALLOW_DEMO_IN_PRODUCTION === "true";
  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      if (!["postgres:", "postgresql:"].includes(new URL(databaseUrl).protocol)) throw new Error();
    } catch { throw new Error("DATABASE_URL must be a PostgreSQL connection URL."); }
    if (!env.DEVICE_API_KEY_ENCRYPTION_KEY || !/^[A-Za-z0-9+/]{43}=$/.test(env.DEVICE_API_KEY_ENCRYPTION_KEY) ||
      Buffer.from(env.DEVICE_API_KEY_ENCRYPTION_KEY, "base64").length !== 32) {
      throw new Error("DEVICE_API_KEY_ENCRYPTION_KEY must be 32 random bytes encoded as base64 (openssl rand -base64 32).");
    }
    if (!env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is required with DATABASE_URL.");
  }
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  if (production && !env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }
  if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
    throw new Error("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  const frontendOrigins = (env.FRONTEND_ORIGINS ?? "http://localhost:3000")
    .split(",").map(origin => new URL(origin.trim()).origin);
  return {
    port,
    baseURL: env.BETTER_AUTH_URL ?? `http://localhost:${port}`,
    frontendOrigins,
    production,
    allowDemoInProduction,
    database: databaseUrl ? { url: databaseUrl, encryptionKey: env.DEVICE_API_KEY_ENCRYPTION_KEY! } : undefined,
    // Development-only fallback; sessions are already ephemeral with memory storage.
    authSecret: env.BETTER_AUTH_SECRET ?? `${crypto.randomUUID()}${crypto.randomUUID()}`,
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : undefined,
    seedDemo: (!production || allowDemoInProduction) && env.SEED_DEMO_ACCOUNT !== "false",
    agent: {
      project: (env.GOOGLE_VERTEX_PROJECT || env.GOOGLE_CLOUD_PROJECT)?.trim() || undefined,
      location: env.GOOGLE_VERTEX_LOCATION?.trim() || "global",
      scheduleEnabled: env.AGENT_SCHEDULE_ENABLED !== "false",
    },
  };
}
