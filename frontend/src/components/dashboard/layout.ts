import type { DashboardResponse } from "@/lib/api";
import { byUrgency, isUrgent, type OverviewBlock, type PlantOverview } from "./overview";

/**
 * The dashboard under the grove band is a list of these, drawn in order by <Widget /> as
 * stops along the trail. Nothing else decides what appears there, so a generated order
 * takes the place of `defaultLayout` without the page changing.
 */
export type WidgetSpec =
  /** One plant's overview. `blocks` replaces the blocks the overview itself asks for. */
  | { type: "plant"; plantId: string; blocks?: OverviewBlock[] }
  /** Several plants that want nothing, a line each. */
  | { type: "calm-plants"; plantIds: string[] }
  /** Notes about the garden as a whole, and its monitors. */
  | { type: "garden-notes" }
  /** The week's forecast where the garden is. Only drawn for a garden that has one. */
  | { type: "weather" }
  /** `metrics` limits the charts to those metrics; by default every reported metric is drawn. */
  | { type: "history"; plantId: string; metrics?: string[] };

/**
 * The order that came with the garden's insights, if it still places every plant exactly
 * once. One written before a plant was added or removed no longer does, and is passed over.
 */
function generatedLayout(dashboard: DashboardResponse): WidgetSpec[] | null {
  const stops = dashboard.insights.layout;
  if (!stops?.length) return null;
  const placed = stops.flatMap(stop => (stop.type === "plant" ? [stop.plantId] : stop.type === "calm-plants" ? stop.plantIds : []));
  const known = new Set(dashboard.plants.map(plant => plant.id));
  if (placed.length !== known.size || new Set(placed).size !== known.size || !placed.every(id => known.has(id))) return null;
  return stops;
}

/** A garden with a forecast shows it once, just ahead of its notes unless the order says where; one without never does. */
function withWeather(stops: WidgetSpec[], dashboard: DashboardResponse): WidgetSpec[] {
  if (!dashboard.forecast) return stops.filter(stop => stop.type !== "weather");
  if (stops.length === 0 || stops.some(stop => stop.type === "weather")) return stops;
  const notes = stops.findIndex(stop => stop.type === "garden-notes");
  return notes < 0 ? [...stops, { type: "weather" }] : [...stops.slice(0, notes), { type: "weather" }, ...stops.slice(notes)];
}

/** The stops of a garden's trail, or of one plant's page: as generated when there is such an order, else `defaultLayout`. */
export function layoutFor(dashboard: DashboardResponse, overviews: PlantOverview[], plantId: string | null): WidgetSpec[] {
  if (plantId) return defaultLayout(dashboard, overviews, plantId);
  return withWeather(generatedLayout(dashboard) ?? defaultLayout(dashboard, overviews, null), dashboard);
}

/**
 * What to show when nothing has chosen a layout. For a garden: each plant that wants
 * something gets its own stop, most urgent first, then the calm ones together, then the
 * garden's own notes. For one plant: its overview, then its full history.
 */
export function defaultLayout(dashboard: DashboardResponse, overviews: PlantOverview[], plantId: string | null): WidgetSpec[] {
  if (plantId) {
    // Its charts are all in the history below; what it stands at and what to do stay beside the note.
    const kept = overviews.find(overview => overview.plantId === plantId)?.blocks.filter(block => block.type === "meter" || block.type === "steps") ?? [];
    return [
      { type: "plant", plantId, blocks: [{ type: "readings" }, ...kept] },
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
