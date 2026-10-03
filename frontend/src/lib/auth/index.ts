import { API_URL } from "@/lib/config";
import { createBffAuth } from "./bff";
import type { AuthSource } from "./types";

// Chosen once at load, so `auth.useSession` is the same hook on every render.
export const auth: AuthSource = createBffAuth(API_URL);

export type { SessionState, SessionUser } from "./types";
