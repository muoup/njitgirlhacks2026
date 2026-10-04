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

/**
 * Gives the account with this email a new password, as Better Auth's own reset does once a
 * mailed token has been checked. There is no mail here, so this is for `scripts/password.ts`,
 * run by whoever holds the database, and never for a route. Sessions are left signed in.
 */
export async function setPassword(auth: Auth, email: string, password: string) {
  const context = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = context.password.config;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw new Error(`A password has ${minPasswordLength} to ${maxPasswordLength} characters.`);
  }
  const found = await context.internalAdapter.findUserByEmail(email.trim().toLowerCase());
  if (!found) throw new Error(`No account has the email ${email}.`);
  const userId = found.user.id;
  const hash = await context.password.hash(password);
  // An account made by signing in with Google has no password yet.
  if (await context.internalAdapter.findCredentialAccount(userId)) await context.internalAdapter.updatePassword(userId, hash);
  else await context.internalAdapter.createAccount({ userId, providerId: "credential", accountId: userId, password: hash });
}

export async function seedDemoAccount(auth: Auth) {
  await auth.api.signUpEmail({ body: demoCredentials });
}
