import type { DashboardResponse, InsightItem, Plant, Reading } from "@/lib/api";

/** What every widget is given: the hydrated garden and a way to move the selection. */
export interface DashboardView {
  dashboard: DashboardResponse;
  selectPlant: (plantId: string | null) => void;
}

export function findPlant(dashboard: DashboardResponse, plantId: string) {
  return dashboard.plants.find(plant => plant.id === plantId);
}

export function latestReading(dashboard: DashboardResponse, plantId: string): Reading | undefined {
  return dashboard.latestReadings.find(reading => reading.plantId === plantId);
}

export function followUps(dashboard: DashboardResponse): InsightItem[] {
  return dashboard.insights.items.filter(item => item.needsFollowUp);
}

/** The hand-lettered line for a plant. It says no more than the reported status does. */
export function plantHeadline(plant: Plant) {
  if (plant.status === "healthy") return `${plant.name} is happy.`;
  if (plant.status === "needs_care") return `${plant.name} needs you.`;
  return plant.name;
}

export function statusLabel(plant: Plant) {
  if (plant.status === "healthy") return "Healthy";
  if (plant.status === "needs_care") return "Needs care";
  return "No status";
}
