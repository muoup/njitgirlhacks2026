import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";

import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { Button } from "@/components/ui/button";
import type { Reading } from "@/lib/api";
import { formatMeasurement, metricLabel, timeAgo } from "@/lib/format";
import { LineChart } from "../LineChart";
import { type OverviewBlock, type PlantOverview, URGENCY, urgencyLabel } from "../overview";
import { Plaque, Skeleton } from "../Panel";
import { Slip } from "../ParchmentNote";
import { mostMoved, rangeOf, seriesByMetric, usePlantReadings } from "../readings";
import { type DashboardView, findPlant, latestReading } from "../view";

/** The latest numbers, written large and plain. */
function ReadingsBlock({ reading }: { reading: Reading | undefined }) {
  if (!reading) return <p className="m-0 text-sm text-muted-foreground">No readings have arrived for this plant yet.</p>;
  return (
    <dl className="m-0 flex flex-wrap gap-x-8 gap-y-3">
      {reading.measurements.map(measurement => (
        <div key={measurement.metric}>
          <dd className="m-0 text-3xl leading-none font-bold tabular-nums">{formatMeasurement(measurement)}</dd>
          <dt className="mt-1 text-xs text-muted-foreground">{metricLabel(measurement.metric)}</dt>
        </div>
      ))}
    </dl>
  );
}

/** One metric over a range, in the plant's urgency colour. */
function ChartBlock({ plantId, block }: { plantId: string; block: Extract<OverviewBlock, { type: "chart" }> }) {
  const { resource } = usePlantReadings(plantId, block.range);
  const range = rangeOf(block.range);

  if (resource.status === "loading") return <Skeleton className="h-36" />;
  if (resource.status === "error") return <p className="m-0 text-sm text-muted-foreground">The history couldn&rsquo;t be loaded.</p>;

  const series = seriesByMetric(resource.data.readings);
  const metric = block.metric ?? mostMoved(series);
  const chosen = metric ? series.get(metric) : undefined;
  if (!metric || !chosen) return <p className="m-0 text-sm text-muted-foreground">No readings in the last {range.label}.</p>;

  return (
    <LineChart
      title={`${metricLabel(metric)}, last ${range.label}`}
      unit={chosen.unit}
      points={chosen.points}
      from={Date.parse(resource.data.from)}
      to={Date.parse(resource.data.to)}
      height={132}
    />
  );
}

/**
 * One plant as a stop on the trail: its headline, what was written about it on a slip of
 * paper, and whichever blocks its overview (or the layout) asks for on a wooden plaque.
 * An overview with no blocks is just the headline and the slip.
 */
export function PlantStop({
  overview,
  blocks = overview.blocks,
  cut,
  view,
}: {
  overview: PlantOverview;
  /** Shown instead of the overview's own blocks. */
  blocks?: OverviewBlock[];
  cut?: number;
  view: DashboardView;
}) {
  const plant = findPlant(view.dashboard, overview.plantId);
  if (!plant) return null;
  const reading = latestReading(view.dashboard, plant.id);
  const color = overview.urgency ? URGENCY[overview.urgency].color : undefined;
  const selected = view.selectedId === plant.id;

  const heading = (
    <div className="flex items-center gap-3">
      <PlantMushroom urgency={overview.urgency} quiet={!reading} className="h-16 w-[4.4rem] shrink-0" />
      <div className="min-w-0">
        <h2 className="m-0 font-brush text-4xl leading-none font-normal text-grove-parchment">{overview.headline}</h2>
        <p className="mt-1.5 mb-0 text-sm text-muted-foreground">
          <span className="font-bold" style={{ color }}>
            {urgencyLabel(overview.urgency)}
          </span>
          {" · "}
          <i>{plant.species}</i>
          {reading && ` · measured ${timeAgo(reading.measuredAt)}`}
        </p>
      </div>
    </div>
  );
  const move = selected ? (
    <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => view.selectPlant(null)}>
      <ArrowLeft />
      Whole garden
    </Button>
  ) : (
    <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => view.selectPlant(plant.id)}>
      All of {plant.name}&rsquo;s history
      <ArrowRight />
    </Button>
  );
  const drawn = blocks.map((block, index) =>
    block.type === "readings" ? (
      <ReadingsBlock key={index} reading={reading} />
    ) : (
      <ChartBlock key={index} plantId={plant.id} block={block} />
    ),
  );
  const slip = overview.text && (
    <Slip pin={color} tilt={cut}>
      {overview.text}
    </Slip>
  );

  return (
    <article className="relative" style={{ "--chart-1": color } as CSSProperties}>
      {color && (
        <div
          aria-hidden="true"
          className="grove-glow pointer-events-none absolute -inset-x-16 -inset-y-12"
          style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${color} 13%, transparent), transparent)` }}
        />
      )}
      {blocks.some(block => block.type === "chart") ? (
        <Plaque cut={cut}>
          <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
            <div className="min-w-0">
              {heading}
              {/* The slip is pinned to the board and hangs a little off its edge. */}
              {slip && <div className="mt-5 -ml-7 max-w-sm sm:-ml-9">{slip}</div>}
              <div className="mt-3">{move}</div>
            </div>
            <div className="grid min-w-0 content-start gap-5">{drawn}</div>
          </div>
        </Plaque>
      ) : blocks.length > 0 ? (
        <>
          <Plaque cut={cut}>
            <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
              {heading}
              {drawn}
            </div>
            <div className="mt-3">{move}</div>
          </Plaque>
          {/* With no chart to sit beside, the slip is pinned over the board's lower edge. */}
          {slip && <div className="relative z-10 -mt-6 mr-6 ml-auto max-w-sm">{slip}</div>}
        </>
      ) : (
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-5">
          <div>
            {heading}
            <div className="mt-2">{move}</div>
          </div>
          {slip && <div className="max-w-sm min-w-[min(100%,16rem)] flex-1">{slip}</div>}
        </div>
      )}
    </article>
  );
}
