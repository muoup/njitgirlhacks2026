import { ApiError, type GroveApi } from "./types";

export function createBffApi(baseUrl: string): GroveApi {
  async function get<T>(path: string): Promise<T> {
    // The session is a cookie on the BFF's origin, so every call has to send credentials.
    const response = await fetch(`${baseUrl}${path}`, { credentials: "include" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        body?.error?.code ?? "UNKNOWN",
        body?.error?.message ?? "The request could not be completed.",
      );
    }
    return response.json();
  }

  return {
    listGardens: () => get("/api/v1/gardens"),
    getDashboard: gardenId => get(`/api/v1/dashboard?${new URLSearchParams({ gardenId })}`),
    getPlantReadings: (plantId, from, to) =>
      get(
        `/api/v1/plants/${encodeURIComponent(plantId)}/readings?${new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
        })}`,
      ),
  };
}
