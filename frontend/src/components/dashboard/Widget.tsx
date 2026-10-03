import type { WidgetSpec } from "./layout";
import type { DashboardView } from "./view";
import { CalmPlants } from "./widgets/CalmPlants";
import { GardenNotes } from "./widgets/GardenNotes";
import { History } from "./widgets/History";
import { PlantStop } from "./widgets/PlantStop";

/** Draws one entry of a layout. Every kind of widget the dashboard knows is listed here. */
export function Widget({ spec, index, view }: { spec: WidgetSpec; index: number; view: DashboardView }) {
  switch (spec.type) {
    case "plant": {
      const overview = view.overviews.find(item => item.plantId === spec.plantId);
      return overview ? <PlantStop overview={overview} blocks={spec.blocks} cut={index} view={view} /> : null;
    }
    case "calm-plants":
      return <CalmPlants plantIds={spec.plantIds} view={view} />;
    case "garden-notes":
      return <GardenNotes view={view} />;
    case "history":
      return <History plantId={spec.plantId} metrics={spec.metrics} cut={index} />;
  }
}
