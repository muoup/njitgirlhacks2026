import { useCallback, useEffect, useState } from "react";

export type Resource<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: unknown };

const LOADING = { status: "loading" } as const;

/**
 * Loads something whenever `deps` change. Pass `null` as the loader to wait.
 * `deps` are compared by their JSON, so keep them to strings, numbers and booleans.
 */
export function useResource<T>(load: (() => Promise<T>) | null, deps: readonly unknown[]) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([load !== null, attempt, ...deps]);
  const [loaded, setLoaded] = useState<{ key: string; resource: Resource<T> } | null>(null);

  useEffect(() => {
    if (!load) return;
    let stale = false;
    load().then(
      data => {
        if (!stale) setLoaded({ key, resource: { status: "ready", data } });
      },
      error => {
        if (!stale) setLoaded({ key, resource: { status: "error", error } });
      },
    );
    return () => {
      stale = true;
    };
    // `load` is a fresh closure every render; `key` says when it needs to run again.
  }, [key]);

  // A result for earlier deps is never shown for the current ones.
  const resource: Resource<T> = loaded?.key === key ? loaded.resource : LOADING;
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { resource, retry };
}
