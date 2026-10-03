import { useState } from "react";

import { Button } from "@/components/ui/button";
import { metricLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LineChart } from "../LineChart";
import { Plaque, Skeleton } from "../Panel";
import { type RangeId, RANGES, rangeOf, seriesByMetric, usePlantReadings } from "../readings";

/** A plant's numbers over time, one small chart per metric. */
export function History({ plantId, metrics, cut }: { plantId: string; metrics?: string[]; cut?: number }) {
  const [rangeId, setRangeId] = useState<RangeId>("24h");
  const range = rangeOf(rangeId);
  const { resource, retry } = usePlantReadings(plantId, rangeId);

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
    <Plaque title="History" action={toggle} cut={cut}>
      {body}
    </Plaque>
  );
}
