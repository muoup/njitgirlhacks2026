import { betterAuth, type BetterAuthOptions } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { openAPI } from "better-auth/plugins";
import type { Config } from "./config";

export const demoCredentials = {
  name: "Demo Gardener",
  email: "demo@grove.local",
  password: "GroveDemo2026!",
};

export function createAuth(config: Config, database?: BetterAuthOptions["database"]) {
  if (config.production && !config.allowDemoInProduction && !database) {
    throw new Error("Configure durable Better Auth storage before running in production, or use ./prod.sh --demo for the ephemeral scaffold.");
  }
  return betterAuth({
    appName: "Grove",
    baseURL: config.baseURL,
    basePath: "/api/auth",
    secret: config.authSecret,
    trustedOrigins: config.frontendOrigins,
    database: database ?? memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true },
    socialProviders: config.google ? { google: config.google } : {},
    plugins: [openAPI({ disableDefaultReference: true })],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export async function seedDemoAccount(auth: Auth) {
  await auth.api.signUpEmail({ body: demoCredentials });
}
