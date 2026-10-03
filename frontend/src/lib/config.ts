import { requireApiUrl } from "./api-url";

function readApiUrl(): string | undefined {
  try {
    return process.env.BUN_PUBLIC_API_URL;
  } catch {
    // Bun inlines BUN_PUBLIC_* variables that are set. An unset one stays a `process.env`
    // lookup, and a browser has no `process` to look in.
    return undefined;
  }
}

/**
 * Origin of the BFF, e.g. http://localhost:3001. Set BUN_PUBLIC_API_URL to use it.
 * Required in both Bun entry points and the browser. No offline data/auth fallback.
 */
export const API_URL = requireApiUrl(readApiUrl());
