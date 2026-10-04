import type { ReactNode } from "react";

import { GroveSymbols } from "@/components/grove/GroveSymbols";
import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { Planted } from "@/components/grove/Scene";
import type { Plant, Reading } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CompactReadings, readingInWords } from "./CompactReadings";
import { useMetrics } from "./metrics";
import { type PlantOverview, URGENCY, type Urgency, urgencyLabel } from "./overview";
import "@/components/grove/grove.css";

const FAIRIES = [
  { x: 330, y: 70, path: "a", duration: 24, delay: -4 },
  { x: 700, y: 50, path: "c", duration: 29, delay: -12 },
  { x: 1150, y: 80, path: "b", duration: 26, delay: -7 },
] as const;

function Fairy() {
  return (
    <>
      <g className="grove-flutter">
        <use href="#grove-fairy-wings" />
      </g>
      <use href="#grove-fairy-body" />
    </>
  );
}

/** A small cut stone beside a mushroom that wants something: marked for "calling for you", plain for "keep watch". */
function Flag({ urgency }: { urgency: Urgency }) {
  return (
    <svg aria-hidden="true" viewBox="-10 -10 20 20" className="absolute top-7 right-2 size-5 sm:right-5">
      <polygon points="0,-9 9,0 0,9 -9,0" style={{ fill: URGENCY[urgency].color }} />
      <polygon points="0,-9 9,0 0,0" fill="rgb(255 255 255 / 0.3)" />
      {urgency === "act" && <path d="M0,-4.5 V1 M0,3.6 V4.2" stroke="#2a0f08" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

// The top edge of the ground, in the ground's own 1440 by 60 box.
const GROUND_EDGE = "0,12 240,3 520,14 820,5 1100,15 1300,6 1440,10";

/**
 * A strip of the grove across the top of a page, with the page's own ground along its bottom
 * edge. `--floor` is how tall that ground is; `children` stand on it. `turf` lays grass along
 * the edge, for a page whose ground is not the colour of the grove.
 */
export function GroveStrip({ className, turf, children }: { className?: string; turf?: boolean; children?: ReactNode }) {
  return (
    <div className={cn("relative h-[376px] overflow-hidden bg-grove-sky [--floor:92px] sm:h-[330px] sm:[--floor:78px]", className)}>
      <GroveSymbols />

      {/* Scenery stands on the bottom edge of this box, which is the top of the ground strip. */}
      <svg
        aria-hidden="true"
        viewBox="0 -46 1440 266"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 top-0 h-[calc(100%-var(--floor)+14px)] w-full"
      >
        <polygon points="0,70 1440,40 1440,220 0,220" style={{ fill: "var(--grove-haze)" }} />
        <g transform="translate(1010 44) scale(0.42)">
          <circle className="grove-glow" r="112" fill="rgb(230 234 208 / 0.06)" />
          <polygon
            points="62,0 50,36 19,59 -19,59 -50,36 -62,0 -50,-36 -19,-59 19,-59 50,-36"
            style={{ fill: "var(--grove-moon)" }}
          />
          <polygon points="0,0 19,-59 50,-36 62,0" fill="rgb(255 255 255 / 0.3)" />
          <polygon points="0,0 -19,59 -50,36 -62,0" fill="rgb(0 0 0 / 0.09)" />
        </g>
        <g className="grove-far">
          <Planted shape="ridge" x={-60} y={176} scale={1.1} />
          <Planted shape="ridge" x={360} y={182} scale={0.95} />
          <Planted shape="ridge" x={790} y={174} scale={1.15} />
          <Planted shape="ridge" x={1500} y={180} scale={1} flip />
          <polygon
            className="grove-t1"
            points="0,220 0,170 200,156 420,172 700,152 980,170 1200,154 1440,166 1440,220"
          />
        </g>
        <g className="grove-mid">
          <Planted shape="tree-c" x={170} y={222} scale={0.6} sway={{}} />
          <Planted shape="thicket" x={300} y={214} scale={0.7} />
          <Planted shape="tree-b" x={1260} y={222} scale={0.72} sway={{ delay: -3 }} />
          <Planted shape="thicket" x={1090} y={214} scale={0.65} />
        </g>
        {FAIRIES.map(fairy => (
          <g key={fairy.x} transform={`translate(${fairy.x} ${fairy.y}) scale(0.8)`}>
            <g
              className={`grove-float-${fairy.path}`}
              style={{ animationDuration: `${fairy.duration}s`, animationDelay: `${fairy.delay}s` }}
            >
              <Fairy />
            </g>
          </g>
        ))}
        <g className="grove-near">
          <Planted shape="tree-a" x={30} y={226} scale={0.7} sway={{ duration: 8 }} />
          <Planted shape="tree-c" x={1410} y={226} scale={0.7} flip sway={{ duration: 9, delay: -3 }} />
        </g>
      </svg>

      {/* The ground is the page's own colour, so the mushrooms stand on top of the dashboard. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-(--floor) w-full overflow-visible fill-background"
      >
        <polygon points={`0,60 ${GROUND_EDGE} 1440,60`} />
        {turf && (
          <polyline points={GROUND_EDGE} fill="none" vectorEffect="non-scaling-stroke" strokeWidth="6" style={{ stroke: "var(--grove-near-1)" }} />
        )}
      </svg>
      {children}
    </div>
  );
}

/**
 * The garden at a glance: one mushroom per plant, standing on the top edge of the page with
 * its latest readings under its name. The aura's colour is the plant's urgency. Choosing a
 * mushroom selects its plant.
 */
export function GroveBand({
  plants,
  overviews,
  readings,
  selectedId,
  onSelect,
}: {
  plants: Plant[];
  overviews: PlantOverview[];
  readings: Reading[];
  selectedId: string | null;
  onSelect: (plantId: string | null) => void;
}) {
  const metrics = useMetrics();
  return (
    // The ground is deep enough for two rows of readings under each name, clear of where the trail sets off.
    <GroveStrip className="sm:h-[346px] sm:[--floor:94px]">
      <div
        role="group"
        aria-label="Plants in this garden"
        className="absolute inset-x-0 bottom-0 flex justify-center-safe gap-1 overflow-x-auto px-4 sm:gap-2 sm:px-16"
      >
        {plants.map(plant => {
          const selected = plant.id === selectedId;
          const urgency = overviews.find(overview => overview.plantId === plant.id)?.urgency ?? null;
          const reading = readings.find(item => item.plantId === plant.id);
          return (
            <button
              key={plant.id}
              type="button"
              aria-pressed={selected}
              aria-label={`${plant.name}: ${urgencyLabel(urgency).toLowerCase()}, ${readingInWords(reading, metrics)}`}
              onClick={() => onSelect(selected ? null : plant.id)}
              className="group relative flex w-[100px] shrink-0 cursor-pointer flex-col items-center border-0 bg-transparent p-0 pt-6 font-sans outline-none sm:w-[132px]"
            >
              {(urgency === "act" || urgency === "watch") && <Flag urgency={urgency} />}
              <PlantMushroom
                urgency={urgency}
                quiet={!reading}
                className={cn(
                  "h-[80px] w-[86px] origin-[50%_90%] sm:h-[102px] sm:w-[110px] transition-transform duration-200 group-hover:scale-110",
                  selected && "scale-[1.18] group-hover:scale-[1.18]",
                )}
              />
              <span className="flex h-[calc(var(--floor)-18px)] flex-col items-center gap-0.5">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-sm font-bold text-grove-mist",
                    "group-focus-visible:ring-[3px] group-focus-visible:ring-ring/60",
                    selected && "bg-primary text-primary-foreground",
                  )}
                >
                  {plant.name}
                </span>
                <CompactReadings reading={reading} className="text-grove-mist" />
              </span>
            </button>
          );
        })}
      </div>
    </GroveStrip>
  );
}
