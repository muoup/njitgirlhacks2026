import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";

import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { Button } from "@/components/ui/button";
import { spanInWords, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BlockView, isWide } from "../Blocks";
import { type Metrics, useMetrics } from "../metrics";
import { Note } from "../Note";
import { type OverviewBlock, type PlantOverview, URGENCY, urgencyLabel } from "../overview";
import { Plaque } from "../Panel";
import { type DashboardView, findPlant, latestReading } from "../view";

const HOUR = 3_600_000;

function listed(words: string[]) {
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : (words[0] ?? "");
}

/** "Based on soil and warmth over 2 days.": what the note rests on, from the evidence that came with it. */
function basis(evidence: PlantOverview["evidence"], metrics: Metrics) {
  if (evidence.length === 0) return null;
  const names = listed([...new Set(evidence.map(item => metrics.label(item.metric).toLowerCase()))]);
  const span = Math.max(...evidence.map(item => Date.parse(item.to))) - Math.min(...evidence.map(item => Date.parse(item.from)));
  if (span < HOUR) return `Based on the latest ${names}.`;
  return `Based on ${names} over ${spanInWords(span)}.`;
}

/**
 * One plant as a stop on the trail: its headline, what was written about it on a
 * slate, and whichever blocks its overview (or the layout) asks for on a wooden plaque.
 * An overview with no blocks is just the headline and the note.
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
  const metrics = useMetrics();
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
  const draw = (shown: OverviewBlock[]) =>
    shown.map((block, index) => <BlockView key={index} block={block} plantId={plant.id} reading={reading} />);
  // A chart fills its side of the board, so the steps go under the note. Without one, that side
  // would be left mostly bare: the steps go there instead, and what it holds is set at mid-height.
  const charted = blocks.some(block => block.type === "chart");
  const beside = charted ? blocks.filter(block => block.type !== "steps") : blocks;
  const under = charted ? blocks.filter(block => block.type === "steps") : [];
  const note = overview.text && (
    <Note light={color} cut={cut} foot={basis(overview.evidence, metrics)}>
      {overview.text}
    </Note>
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
      {blocks.some(isWide) ? (
        <Plaque cut={cut}>
          <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
            <div className="min-w-0">
              {heading}
              {/* The note is set against the board and hangs a little off its edge. */}
              {note && <div className="mt-5 -ml-7 max-w-sm sm:-ml-9">{note}</div>}
              {under.length > 0 && <div className="mt-5 grid gap-5">{draw(under)}</div>}
              <div className="mt-3">{move}</div>
            </div>
            <div className={cn("grid min-w-0 gap-5", charted ? "content-start" : "content-center")}>{draw(beside)}</div>
          </div>
        </Plaque>
      ) : blocks.length > 0 ? (
        <>
          <Plaque cut={cut}>
            <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
              {heading}
              {draw(blocks)}
            </div>
            <div className="mt-3">{move}</div>
          </Plaque>
          {/* With nothing wide to sit beside, the note hangs over the board's lower edge. */}
          {note && <div className="relative z-10 -mt-6 mr-6 ml-auto max-w-sm">{note}</div>}
        </>
      ) : (
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-5">
          <div>
            {heading}
            <div className="mt-2">{move}</div>
          </div>
          {note && <div className="max-w-sm min-w-[min(100%,16rem)] flex-1">{note}</div>}
        </div>
      )}
    </article>
  );
}
