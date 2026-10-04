import type { GoogleVertexProviderSettings } from "@ai-sdk/google-vertex";

// The SDK's auth wrapper calls only getAccessToken. No ADC files or network needed.
export const testVertexAuth: GoogleVertexProviderSettings["googleAuthOptions"] = {
  authClient: { getAccessToken: async () => ({ token: "test-access-token" }) } as NonNullable<NonNullable<GoogleVertexProviderSettings["googleAuthOptions"]>["authClient"]>,
};
