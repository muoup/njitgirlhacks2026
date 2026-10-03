import { GroveSymbols } from "@/components/grove/GroveSymbols";
import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { Planted } from "@/components/grove/Scene";
import type { Plant } from "@/lib/api";
import { cn } from "@/lib/utils";
import { statusLabel } from "./view";
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

/**
 * The garden as a strip of the grove: one mushroom per plant, standing on the top edge of
 * the page. Glowing is healthy, wrinkled needs care, unlit has no status. A fairy hovers
 * over a plant with a note that needs follow-up. Choosing a mushroom selects its plant.
 */
export function GroveBand({
  plants,
  selectedId,
  followUpIds,
  onSelect,
}: {
  plants: Plant[];
  selectedId: string | null;
  /** Plants with a note that needs follow-up. */
  followUpIds: Set<string>;
  onSelect: (plantId: string | null) => void;
}) {
  return (
    <div className="relative h-[270px] overflow-hidden bg-grove-sky">
      <GroveSymbols />

      {/* Scenery stands on the bottom edge of this box, which is the top of the ground strip. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 220"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 top-0 h-[calc(100%-46px)] w-full"
      >
        <polygon points="0,90 1440,60 1440,220 0,220" style={{ fill: "var(--grove-haze)" }} />
        <g transform="translate(985 86) scale(0.42)">
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
          <Planted shape="tree-a" x={30} y={226} scale={0.92} sway={{ duration: 8 }} />
          <Planted shape="tree-c" x={1410} y={226} scale={0.95} flip sway={{ duration: 9, delay: -3 }} />
        </g>
      </svg>

      {/* The ground is the page's own colour, so the mushrooms stand on top of the dashboard. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[60px] w-full fill-background"
      >
        <polygon points="0,60 0,12 240,3 520,14 820,5 1100,15 1300,6 1440,10 1440,60" />
      </svg>

      <div
        role="group"
        aria-label="Plants in this garden"
        className="absolute inset-x-0 bottom-0 flex justify-center-safe gap-1 overflow-x-auto px-4 sm:gap-4 sm:px-16"
      >
        {plants.map(plant => {
          const selected = plant.id === selectedId;
          const followUp = followUpIds.has(plant.id);
          return (
            <button
              key={plant.id}
              type="button"
              aria-pressed={selected}
              aria-label={`${plant.name}: ${statusLabel(plant).toLowerCase()}${followUp ? ", has a note that needs follow-up" : ""}`}
              onClick={() => onSelect(selected ? null : plant.id)}
              className="group relative flex shrink-0 cursor-pointer flex-col items-center border-0 bg-transparent p-0 pt-6 font-sans outline-none"
            >
              {followUp && (
                <svg aria-hidden="true" viewBox="-20 -20 40 40" className="grove-float-c absolute top-0 left-1/2 size-9">
                  <circle className="grove-glow" r="16" fill="rgb(243 230 168 / 0.14)" />
                  <Fairy />
                </svg>
              )}
              <PlantMushroom
                status={plant.status}
                className={cn(
                  "h-[80px] w-[86px] origin-[50%_90%] sm:h-[102px] sm:w-[110px] transition-transform duration-200 group-hover:scale-110",
                  selected && "scale-[1.18] group-hover:scale-[1.18]",
                )}
              />
              <span className="flex h-9 items-start">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-sm font-bold text-grove-mist",
                    "group-focus-visible:ring-[3px] group-focus-visible:ring-ring/60",
                    selected && "bg-primary text-primary-foreground",
                  )}
                >
                  {plant.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
