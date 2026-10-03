import { API_URL } from "@/lib/config";
import { createBffAuth } from "./bff";
import { fixtureAuth } from "./fixture";
import type { AuthSource } from "./types";

// Chosen once at load, so `auth.useSession` is the same hook on every render.
export const auth: AuthSource = API_URL ? createBffAuth(API_URL) : fixtureAuth;

/** True when sign-in is the pretend one from fixture.ts, so pages can say so. */
export const isFixtureAuth = !API_URL;

export type { SessionState, SessionUser } from "./types";
