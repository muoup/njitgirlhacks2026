import type { DashboardResponse, Plant } from "@/lib/api";
import type { RangeId } from "./readings";

/** How much a plant wants from its owner: nothing, a look, or something done today. */
export type Urgency = "ok" | "watch" | "act";

/** The pieces an overview can be built from. A calm plant needs none; an urgent one adds some. */
export type OverviewBlock =
  | { type: "readings" }
  /** Without `metric`, the chart shows whichever metric moved most over the range. */
  | { type: "chart"; range: RangeId; metric?: string };

/**
 * One plant as the dashboard presents it. This is the shape a generated overview will have:
 * the agent chooses the urgency, the words and the blocks, and the page draws them.
 */
export interface PlantOverview {
  plantId: string;
  /** `null` when nothing is known about the plant's health. */
  urgency: Urgency | null;
  headline: string;
  /** Empty when there is nothing to say. */
  text: string;
  blocks: OverviewBlock[];
}

export const URGENCY: Record<Urgency, { label: string; color: string }> = {
  ok: { label: "Fine", color: "var(--grove-ok)" },
  watch: { label: "Keep an eye on it", color: "var(--grove-watch)" },
  act: { label: "Needs you", color: "var(--grove-act)" },
};

export function urgencyLabel(urgency: Urgency | null) {
  return urgency ? URGENCY[urgency].label : "No status";
}

export function isUrgent(overview: PlantOverview) {
  return overview.urgency === "act" || overview.urgency === "watch";
}

function headline(plant: Plant, urgency: Urgency | null) {
  if (urgency === "act") return `${plant.name} needs you.`;
  if (urgency === "watch") return `Check on ${plant.name}.`;
  if (urgency === "ok") return `${plant.name} is happy.`;
  return plant.name;
}

/**
 * Stands in for the agent until overviews are generated: builds them from what the BFF
 * already sends. A plant reported as needing care is urgent, a note asking for follow-up
 * makes one worth a look, and either earns its recent history on screen.
 */
export function standInOverviews(dashboard: DashboardResponse): PlantOverview[] {
  return dashboard.plants.map(plant => {
    const notes = dashboard.insights.items
      .filter(item => item.plantId === plant.id)
      .sort((a, b) => Number(b.needsFollowUp) - Number(a.needsFollowUp));
    const urgency: Urgency | null =
      plant.status === "needs_care"
        ? "act"
        : notes.some(note => note.needsFollowUp)
          ? "watch"
          : plant.status === "healthy"
            ? "ok"
            : null;
    const measured = dashboard.latestReadings.some(reading => reading.plantId === plant.id);
    return {
      plantId: plant.id,
      urgency,
      headline: headline(plant, urgency),
      text: notes.map(note => note.text).join(" "),
      blocks: measured && (urgency === "act" || urgency === "watch") ? [{ type: "readings" }, { type: "chart", range: "7d" }] : [],
    };
  });
}

const RANK: Record<Urgency, number> = { act: 0, watch: 1, ok: 2 };

/** Most urgent first; plants with nothing known last. Equal plants keep the garden's order. */
export function byUrgency(a: PlantOverview, b: PlantOverview) {
  return (a.urgency ? RANK[a.urgency] : 3) - (b.urgency ? RANK[b.urgency] : 3);
}
