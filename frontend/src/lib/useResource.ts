import { useCallback, useEffect, useState } from "react";
import { DATA_CHANGED } from "./data-events";

export type Resource<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: unknown };

const LOADING = { status: "loading" } as const;

/**
 * Loads something whenever `deps` change, and again whenever the page's data is said to have
 * changed. Pass `null` as the loader to wait.
 * `deps` are compared by their JSON, so keep them to strings, numbers and booleans.
 */
export function useResource<T>(load: (() => Promise<T>) | null, deps: readonly unknown[]) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => window.removeEventListener(DATA_CHANGED, refresh);
  }, []);
  const depsKey = JSON.stringify([load !== null, ...deps]);
  const key = `${attempt}:${depsKey}`;
  const [loaded, setLoaded] = useState<{ depsKey: string; attempt: number; resource: Resource<T> } | null>(null);

  useEffect(() => {
    if (!load) return;
    let stale = false;
    load().then(
      data => {
        if (!stale) setLoaded({ depsKey, attempt, resource: { status: "ready", data } });
      },
      error => {
        if (!stale) setLoaded({ depsKey, attempt, resource: { status: "error", error } });
      },
    );
    return () => {
      stale = true;
    };
    // `load` is a fresh closure every render; `key` says when it needs to run again.
  }, [key]);

  // A result for earlier deps is never shown for the current ones. One for the same deps stays
  // up while it is fetched again, so that a refresh does not blank what is on the page.
  const kept = loaded?.depsKey === depsKey && (loaded.attempt === attempt || loaded.resource.status === "ready");
  const resource: Resource<T> = kept ? loaded.resource : LOADING;
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { resource, retry };
}
