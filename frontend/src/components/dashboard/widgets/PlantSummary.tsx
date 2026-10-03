import { ArrowLeft } from "lucide-react";

import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { Button } from "@/components/ui/button";
import { formatMeasurement, metricLabel, timeAgo } from "@/lib/format";
import { Panel } from "../Panel";
import { type DashboardView, findPlant, latestReading, plantHeadline } from "../view";

/** One plant: the storybook line, then exactly what was measured and when. */
export function PlantSummary({ plantId, view }: { plantId: string; view: DashboardView }) {
  const plant = findPlant(view.dashboard, plantId);
  if (!plant) {
    return (
      <Panel>
        <p className="m-0 text-sm text-muted-foreground">This plant isn&rsquo;t in the garden.</p>
      </Panel>
    );
  }
  const reading = latestReading(view.dashboard, plantId);

  return (
    <Panel>
      <Button variant="ghost" size="sm" className="-mt-1 -ml-2 text-muted-foreground" onClick={() => view.selectPlant(null)}>
        <ArrowLeft />
        Whole garden
      </Button>

      <div className="mt-2 flex items-center gap-4">
        <PlantMushroom status={plant.status} className="h-20 w-[5.5rem] shrink-0" />
        <div>
          <h2 className="m-0 font-brush text-5xl leading-none font-normal text-grove-parchment">{plantHeadline(plant)}</h2>
          <p className="mt-2 mb-0 text-sm text-muted-foreground">
            <i>{plant.species}</i>
            {reading && ` · measured ${timeAgo(reading.measuredAt)}`}
          </p>
        </div>
      </div>

      {reading ? (
        <dl className="mt-6 mb-0 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
          {reading.measurements.map(measurement => (
            <div key={measurement.metric} className="rounded-lg bg-muted px-4 py-3">
              <dt className="text-xs text-muted-foreground">{metricLabel(measurement.metric)}</dt>
              <dd className="m-0 mt-1 text-3xl font-bold tabular-nums">{formatMeasurement(measurement)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-6 mb-0 rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
          No readings have arrived for this plant yet.
        </p>
      )}
    </Panel>
  );
}
