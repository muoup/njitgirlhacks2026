import { ApiError, type GroveApi } from "./types";

export function createBffApi(baseUrl: string): GroveApi {
  async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    // The session is a cookie on the BFF's origin, so every call has to send credentials.
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      credentials: "include",
      ...(body !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        failure?.error?.code ?? "UNKNOWN",
        failure?.error?.message ?? "The request could not be completed.",
      );
    }
    // Removals answer with no content.
    return response.status === 204 ? (undefined as T) : response.json();
  }

  const plant = (plantId: string) => `/plants/${encodeURIComponent(plantId)}`;
  const garden = (gardenId: string) => `/gardens/${encodeURIComponent(gardenId)}`;

  return {
    askMentor: input => request("/chat", "POST", input),
    decideAgentAction: (id, decision) => request(`/chat/actions/${encodeURIComponent(id)}/decision`, "POST", { decision }),
    refreshInsights: () => request("/insights/refresh", "POST", {}),
    listGardens: () => request("/gardens"),
    getDashboard: gardenId => request(`/dashboard?${new URLSearchParams({ gardenId })}`),
    getPlantReadings: (plantId, from, to) =>
      request(`${plant(plantId)}/readings?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`),

    createGarden: name => request("/gardens", "POST", { name }),
    removeGarden: gardenId => request(garden(gardenId), "DELETE"),
    createPlant: (gardenId, newPlant) => request(`${garden(gardenId)}/plants`, "POST", newPlant),
    removePlant: plantId => request(plant(plantId), "DELETE"),
    getPlantApiKey: plantId => request(`${plant(plantId)}/api-keys`),
    replacePlantApiKey: plantId => request(`${plant(plantId)}/api-keys`, "POST"),
  };
}
