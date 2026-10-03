import type { CSSProperties } from "react";

import type { InsightItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type DashboardView, findPlant } from "./view";

const TILTS = ["-1.2deg", "0.8deg", "-0.5deg", "1.3deg"];

/**
 * An insight as a slip of paper: written words look different from measured numbers.
 * A pinned note is one that needs follow-up. With `link`, a note about a plant is a button
 * that selects it.
 */
function ParchmentNote({
  item,
  index,
  link,
  view,
}: {
  item: InsightItem;
  index: number;
  link: boolean;
  view: DashboardView;
}) {
  const plant = item.plantId ? findPlant(view.dashboard, item.plantId) : undefined;
  const slip = cn(
    "relative block w-full rotate-(--tilt) bg-grove-parchment px-4 pt-5 pb-4 text-left text-[#2b2116]",
    "shadow-[0_8px_18px_rgb(0_0_0/0.35)] transition-transform duration-200",
  );
  const body = (
    <>
      {item.needsFollowUp && (
        <svg aria-hidden="true" viewBox="-8 -8 16 16" className="absolute -top-2 left-1/2 size-4 -translate-x-1/2">
          <polygon points="0,-8 7,-2 4,7 -4,7 -7,-2" fill="#c07252" />
          <polygon points="0,-8 7,-2 0,0" fill="#e3ab76" />
        </svg>
      )}
      <span className="block font-brush text-2xl leading-none">{plant ? plant.name : "The whole garden"}</span>
      {item.needsFollowUp && <span className="sr-only"> (needs follow-up)</span>}
      <span className="mt-2 block text-sm leading-relaxed">{item.text}</span>
      {plant && link && (
        <span className="mt-3 block text-xs font-bold tracking-wide text-[#6b5a45] uppercase">
          See {plant.name}&rsquo;s readings
        </span>
      )}
    </>
  );
  const style = { "--tilt": TILTS[index % TILTS.length] } as CSSProperties;

  return plant && link ? (
    <button
      type="button"
      style={style}
      onClick={() => view.selectPlant(plant.id)}
      className={cn(
        slip,
        "cursor-pointer border-0 font-sans outline-none hover:-translate-y-0.5 hover:rotate-0",
        "focus-visible:rotate-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grove-ember-hi",
      )}
    >
      {body}
    </button>
  ) : (
    <div style={style} className={slip}>
      {body}
    </div>
  );
}

export function NoteList({
  items,
  view,
  link = true,
  className,
}: {
  items: InsightItem[];
  view: DashboardView;
  /** Whether notes about a plant lead to it. Off where that plant is already on screen. */
  link?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("m-0 grid list-none gap-5 p-0", className)}>
      {items.map((item, index) => (
        <li key={item.id}>
          <ParchmentNote item={item} index={index} link={link} view={view} />
        </li>
      ))}
    </ul>
  );
}
