import type { DashboardResponse } from "@/lib/api";
import { byUrgency, isUrgent, type OverviewBlock, type PlantOverview } from "./overview";

/**
 * The dashboard under the grove band is a list of these, drawn in order by <Widget /> as
 * stops along the trail. Nothing else decides what appears there, so a generated layout
 * can replace `defaultLayout` later without the page changing.
 */
export type WidgetSpec =
  /** One plant's overview. `blocks` replaces the blocks the overview itself asks for. */
  | { type: "plant"; plantId: string; blocks?: OverviewBlock[] }
  /** Several plants that want nothing, a line each. */
  | { type: "calm-plants"; plantIds: string[] }
  /** Notes about the garden as a whole, and its monitors. */
  | { type: "garden-notes" }
  /** `metrics` limits the charts to those metrics; by default every reported metric is drawn. */
  | { type: "history"; plantId: string; metrics?: string[] };

/**
 * What to show when nothing has chosen a layout. For a garden: each plant that wants
 * something gets its own stop, most urgent first, then the calm ones together, then the
 * garden's own notes. For one plant: its overview, then its full history.
 */
export function defaultLayout(dashboard: DashboardResponse, overviews: PlantOverview[], plantId: string | null): WidgetSpec[] {
  if (plantId) {
    return [
      { type: "plant", plantId, blocks: [{ type: "readings" }] },
      { type: "history", plantId },
    ];
  }
  if (dashboard.plants.length === 0) return [];
  const urgent = overviews.filter(isUrgent).sort(byUrgency);
  const calm = overviews.filter(overview => !isUrgent(overview)).sort(byUrgency);
  return [
    ...urgent.map(overview => ({ type: "plant" as const, plantId: overview.plantId })),
    ...(calm.length > 0 ? [{ type: "calm-plants" as const, plantIds: calm.map(overview => overview.plantId) }] : []),
    { type: "garden-notes" },
  ];
}
