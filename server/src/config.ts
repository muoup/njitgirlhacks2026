export interface Config {
  port: number;
  baseURL: string;
  frontendOrigins: string[];
  production: boolean;
  authSecret: string;
  google?: { clientId: string; clientSecret: string };
  seedDemo: boolean;
  agent: { project?: string; location: string; scheduleEnabled: boolean };
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const production = env.NODE_ENV === "production";
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
    // Development-only fallback; sessions are already ephemeral with memory storage.
    authSecret: env.BETTER_AUTH_SECRET ?? `${crypto.randomUUID()}${crypto.randomUUID()}`,
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : undefined,
    seedDemo: !production && env.SEED_DEMO_ACCOUNT !== "false",
    agent: {
      project: (env.GOOGLE_VERTEX_PROJECT || env.GOOGLE_CLOUD_PROJECT)?.trim() || undefined,
      location: env.GOOGLE_VERTEX_LOCATION?.trim() || "global",
      scheduleEnabled: env.AGENT_SCHEDULE_ENABLED !== "false",
    },
  };
}
