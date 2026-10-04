import { Value } from "@sinclair/typebox/value";
import type { BackendAdapter, BackendIdentity } from "./backend";
import { ApiError } from "./errors";
import { Mutation, type MutationData } from "./agent/schemas";
import { GardenResponse, PlantedResponse } from "./schemas";

export class DomainService {
  constructor(private readonly backend: BackendAdapter) {}

  async inspect(identity: BackendIdentity, action: MutationData) {
    if (!Value.Check(Mutation, action)) throw new ApiError(422, "INVALID_REQUEST", "Invalid garden or plant action.");
    if (action.kind === "createGarden") return { description: `Create garden “${action.name}”.`, fingerprint: "new-garden" };
    if (action.kind === "removePlant") {
      const { gardens } = await this.backend.listGardens(identity);
      for (const garden of gardens) {
        const dashboard = await this.backend.hydrateDashboard(identity, garden.id);
        const plant = dashboard?.plants.find(plant => plant.id === action.plantId);
        if (plant) return { description: `Remove “${plant.name}” from “${garden.name}”, including its readings and firmware key.`,
          fingerprint: JSON.stringify(plant) };
      }
      throw new ApiError(404, "NOT_FOUND", "Plant not found.");
    }
    const dashboard = await this.backend.hydrateDashboard(identity, action.gardenId);
    if (!dashboard) throw new ApiError(404, "NOT_FOUND", "Garden not found.");
    return {
      description: action.kind === "createPlant"
        ? `Plant “${action.name}” (${action.species}) in “${dashboard.garden.name}”.`
        : `Remove “${dashboard.garden.name}” and its ${dashboard.plants.length} plants, readings, and firmware keys.`,
      fingerprint: JSON.stringify({ garden: dashboard.garden, plants: dashboard.plants,
        devices: dashboard.devices.map(device => ({ id: device.id, name: device.name })) }),
    };
  }

  async execute(identity: BackendIdentity, action: MutationData, requestId: string, expected?: string) {
    const replay = await this.backend.replayMutation?.(identity, action, requestId);
    if (replay) return replay.result;
    const current = await this.inspect(identity, action);
    if (expected !== undefined && current.fingerprint !== expected) {
      throw new ApiError(409, "ACTION_CHANGED", "The target changed. Ask the mentor for a new proposal.");
    }
    const result = await this.backend.mutate(identity, action, requestId, expected);
    if ((action.kind === "createGarden" && !Value.Check(GardenResponse, result)) ||
      (action.kind === "createPlant" && !Value.Check(PlantedResponse, result))) {
      throw new ApiError(502, "BACKEND_FAILED", "The backend did not confirm the new resource.");
    }
    return result;
  }
}
