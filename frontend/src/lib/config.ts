function readApiUrl() {
  try {
    return process.env.BUN_PUBLIC_API_URL || null;
  } catch {
    // Bun inlines BUN_PUBLIC_* variables that are set. An unset one stays a `process.env`
    // lookup, and a browser has no `process` to look in.
    return null;
  }
}

/**
 * Origin of the BFF, e.g. http://localhost:3001. Set BUN_PUBLIC_API_URL to use it.
 * When unset, the app runs on local fixtures and a pretend session (see lib/api and lib/auth).
 */
export const API_URL: string | null = readApiUrl();
