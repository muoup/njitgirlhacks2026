/** A request identifier for deduplication; getRandomValues also works on HTTP origins. */
export function createRequestId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
}
