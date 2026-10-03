import type { WidgetSpec } from "./layout";
import type { DashboardView } from "./view";
import { History } from "./widgets/History";
import { FollowUps, Notes } from "./widgets/Notes";
import { PlantSummary } from "./widgets/PlantSummary";
import { Roster } from "./widgets/Roster";

// min-w-0 lets a wide table scroll inside its widget instead of stretching the grid.
const SPANS = { 1: "min-w-0 lg:col-span-1", 2: "min-w-0 lg:col-span-2", 3: "min-w-0 lg:col-span-3" };

function render(spec: WidgetSpec, view: DashboardView) {
  switch (spec.type) {
    case "follow-ups":
      return <FollowUps view={view} />;
    case "notes":
      return <Notes plantId={spec.plantId} view={view} />;
    case "roster":
      return <Roster view={view} />;
    case "plant-summary":
      return <PlantSummary plantId={spec.plantId} view={view} />;
    case "history":
      return <History plantId={spec.plantId} metrics={spec.metrics} />;
  }
}

/** Draws one entry of a layout. Every kind of widget the dashboard knows is listed here. */
export function Widget({ spec, view }: { spec: WidgetSpec; view: DashboardView }) {
  return <div className={SPANS[spec.span]}>{render(spec, view)}</div>;
}
