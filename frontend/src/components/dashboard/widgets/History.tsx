import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api, type Reading } from "@/lib/api";
import { metricLabel } from "@/lib/format";
import { useResource } from "@/lib/useResource";
import { cn } from "@/lib/utils";
import { type ChartPoint, LineChart } from "../LineChart";
import { Panel, Skeleton } from "../Panel";

const HOUR = 3_600_000;
const RANGES = [
  { id: "24h", label: "24 hours", span: 24 * HOUR },
  { id: "7d", label: "7 days", span: 7 * 24 * HOUR },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

/** Splits readings into one series per metric, in the order the metrics first appear. */
function seriesByMetric(readings: Reading[]) {
  const series = new Map<string, { unit: string; points: ChartPoint[] }>();
  for (const reading of readings) {
    const at = Date.parse(reading.measuredAt);
    for (const { metric, unit, value } of reading.measurements) {
      const entry = series.get(metric) ?? { unit, points: [] };
      entry.points.push({ at, value });
      series.set(metric, entry);
    }
  }
  return series;
}

/** A plant's numbers over time, one small chart per metric. Fetched apart from the dashboard. */
export function History({ plantId, metrics }: { plantId: string; metrics?: string[] }) {
  const [rangeId, setRangeId] = useState<RangeId>("24h");
  const range = RANGES.find(item => item.id === rangeId)!;
  const { resource, retry } = useResource(() => {
    const to = new Date();
    return api.getPlantReadings(plantId, new Date(to.getTime() - range.span), to);
  }, [plantId, rangeId]);

  const toggle = (
    <div role="group" aria-label="Time range" className="flex rounded-lg border p-0.5">
      {RANGES.map(item => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === rangeId}
          onClick={() => setRangeId(item.id)}
          className={cn(
            "cursor-pointer rounded-md border-0 bg-transparent px-3 py-1 font-sans text-sm text-muted-foreground outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:font-bold aria-pressed:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  let body;
  if (resource.status === "loading") {
    body = (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  } else if (resource.status === "error") {
    body = (
      <div className="py-8 text-center">
        <p className="m-0 text-sm text-muted-foreground">The history couldn&rsquo;t be loaded.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  } else {
    const { from, to, readings } = resource.data;
    const series = [...seriesByMetric(readings)].filter(([metric]) => !metrics || metrics.includes(metric));
    body =
      series.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-6">
          {series.map(([metric, { unit, points }]) => (
            <LineChart
              key={metric}
              title={metricLabel(metric)}
              unit={unit}
              points={points}
              from={Date.parse(from)}
              to={Date.parse(to)}
            />
          ))}
        </div>
      ) : (
        <p className="m-0 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No readings in the last {range.label}.
        </p>
      );
  }

  return (
    <Panel title="History" action={toggle}>
      {body}
    </Panel>
  );
}
