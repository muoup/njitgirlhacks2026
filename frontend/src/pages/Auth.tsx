import { type FormEvent, useState } from "react";
import { Link, Navigate } from "react-router";

import { NoticeBoard } from "@/components/grove/NoticeBoard";
import { Scene } from "@/components/grove/Scene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const COPY = {
  signin: {
    title: "Welcome back.",
    lead: "Sign in to see how your garden is doing.",
    submit: "Sign in",
    busy: "Signing in…",
    switchLead: "New here?",
    switchLabel: "Create an account",
    switchTo: "/signup",
  },
  signup: {
    title: "Join the grove.",
    lead: "Create an account to start watching your soil.",
    submit: "Create account",
    busy: "Creating account…",
    switchLead: "Already have an account?",
    switchLabel: "Sign in",
    switchTo: "/signin",
  },
} as const;

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function messageFrom(error: unknown) {
  // fetch rejects with a TypeError when the server cannot be reached at all.
  if (error instanceof TypeError) return "Couldn't reach the server. Check your connection and try again.";
  return error instanceof Error && error.message ? error.message : "Something went wrong. Try again.";
}

function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On success the session changes and the page redirects, so `busy` is only cleared on failure.
  async function run(kind: "form" | "google", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(messageFrom(caught));
      setBusy(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email"));
    const password = String(fields.get("password"));
    run("form", () =>
      mode === "signup" ? auth.signUp(String(fields.get("name")), email, password) : auth.signIn(email, password),
    );
  }

  return (
    <>
      <h1 className="m-0 font-brush text-5xl leading-none font-normal text-grove-parchment">{copy.title}</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">{copy.lead}</p>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={busy !== null}
        onClick={() => run("google", auth.signInWithGoogle)}
      >
        <GoogleMark />
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="grid gap-4">
        {mode === "signup" && (
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
          />
          {mode === "signup" && (
            <p id="password-hint" className="m-0 text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="m-0 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full font-bold" disabled={busy !== null}>
          {busy === "form" ? copy.busy : copy.submit}
        </Button>
      </form>

      <p className="mt-5 mb-0 text-center text-sm text-muted-foreground">
        {copy.switchLead}{" "}
        <Link to={copy.switchTo} className="font-bold text-grove-ember-hi underline underline-offset-4">
          {copy.switchLabel}
        </Link>
      </p>

    </>
  );
}

/** Sign in and sign up: the same grove, dimmed, with the form on a notice board in the clearing. */
export function Auth({ mode }: { mode: Mode }) {
  const session = auth.useSession();
  if (session.status === "signed-in") return <Navigate to="/dashboard" replace />;

  return (
    // Tall enough for the form plus some post below it, so short screens scroll.
    <div
      className={cn(
        "relative overflow-hidden bg-grove-sky text-foreground",
        mode === "signup" ? "min-h-[max(100svh,820px)]" : "min-h-[max(100svh,720px)]",
      )}
    >
      <header className="absolute inset-x-0 top-0 z-20 px-[clamp(20px,6vw,96px)] py-5">
        <Link to="/" className="font-brush text-4xl leading-none text-grove-parchment no-underline">
          loam gnome
        </Link>
      </header>

      <main>
        <Scene backdrop>
          <div aria-hidden="true" className="absolute inset-0 bg-grove-sky/60" />
          <NoticeBoard>
            {/* Keyed so switching between sign in and sign up starts with a clean form. */}
            <AuthForm key={mode} mode={mode} />
          </NoticeBoard>
        </Scene>
      </main>
    </div>
  );
}
