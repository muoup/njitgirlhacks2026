import { useSyncExternalStore } from "react";

import type { AuthSource, SessionState, SessionUser } from "./types";

/**
 * A pretend session for running without the BFF: any email and password are accepted
 * and the "session" is a name kept in localStorage. It protects nothing.
 */

const KEY = "grove.fixture-session";
const listeners = new Set<() => void>();

function read(): SessionState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { status: "signed-in", user: JSON.parse(raw) as SessionUser };
  } catch {
    // Storage can be blocked or hold something unreadable; treat both as signed out.
  }
  return { status: "signed-out" };
}

let state = read();

function write(user: SessionUser | null) {
  state = user ? { status: "signed-in", user } : { status: "signed-out" };
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the session lasts until the page is reloaded.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function nameFrom(email: string) {
  const local = email.split("@")[0] || "Gardener";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function hasFixtureSession() {
  return state.status === "signed-in";
}

export const fixtureAuth: AuthSource = {
  useSession: () => useSyncExternalStore(subscribe, () => state),
  async signIn(email) {
    write({ name: nameFrom(email), email });
  },
  async signUp(name, email) {
    write({ name: name || nameFrom(email), email });
  },
  async signInWithGoogle() {
    write({ name: "Demo Gardener", email: "demo@grove.local" });
  },
  async signOut() {
    write(null);
  },
};
