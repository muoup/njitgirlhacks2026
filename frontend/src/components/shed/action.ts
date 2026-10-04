import { useState } from "react";

import { NetworkError, notBuilt } from "@/lib/api";

/** What to tell someone when a change could not be made. */
export function failureMessage(error: unknown) {
  if (notBuilt(error)) return "The grove can't do this yet. It's waiting on the backend.";
  if (error instanceof NetworkError) return error.message;
  return error instanceof Error && error.message ? error.message : "Something went wrong. Try again.";
}

/** Runs one change at a time and keeps what went wrong with the last one. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(failureMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run, clear: () => setError(null) };
}
