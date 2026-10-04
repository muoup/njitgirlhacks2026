import { createAuthClient } from "better-auth/react";

import type { AuthSource } from "./types";

/** Better Auth's own client, talking to the BFF's /api/auth endpoints with cookie sessions. */
export function createBffAuth(baseURL: string): AuthSource {
  const client = createAuthClient({ baseURL });

  function check(result: { error: { message?: string; code?: string } | null }) {
    if (!result.error) return;
    // The BFF only offers Google when it has been given OAuth credentials.
    if (result.error.code === "PROVIDER_NOT_FOUND") throw new Error("Google sign-in isn't set up on this server yet.");
    throw new Error(result.error.message || "Something went wrong. Try again.");
  }

  return {
    useSession() {
      const { data, isPending } = client.useSession();
      if (data) return { status: "signed-in", user: { name: data.user.name, email: data.user.email } };
      return { status: isPending ? "loading" : "signed-out" };
    },
    async signIn(email, password) {
      check(await client.signIn.email({ email, password }));
    },
    async signUp(name, email, password) {
      check(await client.signUp.email({ name, email, password }));
    },
    async signInWithGoogle() {
      // On success the browser leaves for Google and comes back to the dashboard.
      check(await client.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/dashboard` }));
    },
    async methods() {
      const response = await fetch(`${baseURL}/api/v1/sign-in/methods`);
      if (!response.ok) throw new Error("The ways to sign in could not be read.");
      return { google: (await response.json()).google === true };
    },
    async signOut() {
      check(await client.signOut());
    },
  };
}
