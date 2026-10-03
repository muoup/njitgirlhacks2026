import type { DashboardResponse } from "@/lib/api";

/**
 * The dashboard under the grove band is a list of these, drawn in order by <Widget />.
 * Nothing else decides what appears there, so a generated layout can replace
 * `defaultLayout` later without the page changing.
 */
export type WidgetSpec = (
  | { type: "follow-ups" }
  /** With `plantId`, every note on that plant; without, the notes that need no follow-up. */
  | { type: "notes"; plantId?: string }
  | { type: "roster" }
  | { type: "plant-summary"; plantId: string }
  /** `metrics` limits the charts to those metrics; by default every reported metric is drawn. */
  | { type: "history"; plantId: string; metrics?: string[] }
) & {
  /** Columns taken on wide screens, out of three. */
  span: 1 | 2 | 3;
};

/** What to show when nothing has chosen a layout: follow-ups first, then the supporting numbers. */
export function defaultLayout(dashboard: DashboardResponse, plantId: string | null): WidgetSpec[] {
  if (plantId) {
    return [
      { type: "plant-summary", plantId, span: 2 },
      { type: "notes", plantId, span: 1 },
      { type: "history", plantId, span: 3 },
    ];
  }
  if (dashboard.plants.length === 0) return [];
  return [
    { type: "follow-ups", span: 3 },
    { type: "roster", span: 2 },
    { type: "notes", span: 1 },
  ];
}
