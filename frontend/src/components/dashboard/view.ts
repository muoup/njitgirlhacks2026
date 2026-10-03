import type { DashboardResponse, Reading } from "@/lib/api";
import type { PlantOverview } from "./overview";

/** What every widget is given: the hydrated garden, its plant overviews and the selection. */
export interface DashboardView {
  dashboard: DashboardResponse;
  overviews: PlantOverview[];
  selectedId: string | null;
  selectPlant: (plantId: string | null) => void;
}

export function findPlant(dashboard: DashboardResponse, plantId: string) {
  return dashboard.plants.find(plant => plant.id === plantId);
}

export function latestReading(dashboard: DashboardResponse, plantId: string): Reading | undefined {
  return dashboard.latestReadings.find(reading => reading.plantId === plantId);
}

/** When any monitor in the garden last reported, if one ever has. */
export function lastHeardAt(dashboard: DashboardResponse) {
  return dashboard.devices
    .flatMap(device => device.lastSeenAt ?? [])
    .sort()
    .at(-1);
}
