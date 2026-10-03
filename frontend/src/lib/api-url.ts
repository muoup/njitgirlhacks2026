/** Shared validation for the Bun entry points and the browser bundle. */
export function requireApiUrl(value: string | undefined): string {
  const hint = "Set BUN_PUBLIC_API_URL=http://localhost:3001 in frontend/.env or the launch environment.";
  if (!value?.trim()) {
    throw new Error(`BUN_PUBLIC_API_URL is required. ${hint}`);
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`BUN_PUBLIC_API_URL must be an absolute HTTP(S) origin. ${hint}`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`BUN_PUBLIC_API_URL must be an absolute HTTP(S) origin. ${hint}`);
  }
  return url.origin;
}
