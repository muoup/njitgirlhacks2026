import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface TrailStop {
  key: string;
  /** Colour of the stone marking this stop; plain when absent. */
  color?: string;
  node: ReactNode;
}

// Where the trail runs, as a share of the width. On wide screens stops alternate sides and
// the trail passes each one in the gutter opposite; on narrow ones stops fill the width and
// the trail only shows between them.
const GUTTER = { left: 0.91, right: 0.09 };
const NARROW = [0.36, 0.64];
// In pixels: how wide the worn strip is, and how round the trail's turns are.
const STRIP = 34;
const TURN = 84;

// The clearing behind a stop: moonlit ground, cut unevenly in fixed pixels so tall stops are not more skewed.
const CLEARING = {
  background: "linear-gradient(164deg, var(--grove-clearing-hi) 42%, var(--grove-clearing) 42%)",
  clipPath:
    "polygon(14px 6px, 38% 0, calc(100% - 20px) 10px, 100% 46%, calc(100% - 8px) calc(100% - 4px), 55% 100%, 6px calc(100% - 12px), 0 40%)",
};

interface Ground {
  width: number;
  /** Where each stop begins and ends, down the trail. */
  stops: { top: number; bottom: number }[];
}

const sideOf = (index: number) => (index % 2 === 0 ? "left" : "right");
const n = (value: number) => value.toFixed(1);

/** One line down the gutters, crossing over between stops in the middle of the gap, with round turns. */
function widePath({ width, stops }: Ground) {
  const last = stops.at(-1);
  if (!last) return "";
  const end = last.bottom - STRIP;
  const crossings = stops.map((stop, index) => ((stops[index - 1]?.bottom ?? 0) + stop.top) / 2);
  let x = width / 2;
  let d = `M ${n(x)} 0`;
  crossings.forEach((cross, index) => {
    const to = width * GUTTER[sideOf(index)];
    const way = Math.sign(to - x);
    // A turn may begin beside the stop above, where the gutter is clear, and end beside the one
    // below. Two turns share the stretch between their crossings, however short the stop is.
    const out = Math.min(TURN, index === 0 ? cross : (cross - crossings[index - 1]!) / 2);
    const back = Math.min(TURN, ((crossings[index + 1] ?? end) - cross) / (index === stops.length - 1 ? 1 : 2));
    d += ` V ${n(cross - out)} Q ${n(x)} ${n(cross)} ${n(x + way * out)} ${n(cross)}`;
    d += ` H ${n(to - way * back)} Q ${n(to)} ${n(cross)} ${n(to)} ${n(cross + back)}`;
    x = to;
  });
  return `${d} V ${n(end)}`;
}

/** A bend in each gap, running up to the stops over their clearings with its round ends just short of them. */
function narrowPath({ width, stops }: Ground) {
  return stops
    .map((stop, index) => {
      const from = width * (index === 0 ? 0.5 : NARROW[(index - 1) % 2]!);
      const to = width * NARROW[index % 2]!;
      const inset = STRIP / 2 + 6;
      const top = (stops[index - 1]?.bottom ?? 0) + inset;
      const bottom = Math.max(top, stop.top - inset);
      const pull = (bottom - top) * 0.7;
      return `M ${n(from)} ${n(top)} C ${n(from)} ${n(top + pull)}, ${n(to)} ${n(bottom - pull)}, ${n(to)} ${n(bottom)}`;
    })
    .join(" ");
}

/** The trail itself: a worn strip with stepping stones along it. */
function Strip({ d, className }: { d: string; className?: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} strokeWidth={STRIP} style={{ stroke: "var(--grove-haze)" }} />
      <path d={d} strokeWidth="9" strokeDasharray="0.1 24" style={{ stroke: "var(--grove-mid-2)" }} />
    </g>
  );
}

/**
 * Lays widgets out as stops along a path that winds down from the grove: the first stop is
 * the first thing reached, so the order of the list is the order of importance. The path is
 * drawn as one line through wherever the stops have come to rest.
 */
export function Trail({ stops }: { stops: TrailStop[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [ground, setGround] = useState<Ground | null>(null);
  const keys = stops.map(stop => stop.key).join("\n");

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const resting = [...element.querySelectorAll<HTMLElement>(":scope > [data-side]")];
    function measure() {
      const next: Ground = {
        width: element!.clientWidth,
        stops: resting.map(stop => ({ top: stop.offsetTop, bottom: stop.offsetTop + stop.offsetHeight })),
      };
      setGround(before => (JSON.stringify(before) === JSON.stringify(next) ? before : next));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const stop of resting) observer.observe(stop);
    return () => observer.disconnect();
  }, [keys]);

  return (
    // Isolated so the trail can sit behind the stops without slipping behind the page.
    <div ref={root} className="relative isolate flex flex-col gap-24 pt-24 lg:gap-28 lg:pt-28">
      {ground && (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible">
          <Strip className="lg:hidden" d={narrowPath(ground)} />
          <Strip className="hidden lg:block" d={widePath(ground)} />
        </svg>
      )}
      {stops.map((stop, index) => {
        const side = sideOf(index);
        return (
          <div key={stop.key} className="group/stop relative" data-side={side}>
            <svg
              aria-hidden="true"
              viewBox="-16 -16 32 32"
              className="absolute top-10 hidden size-9 -translate-x-1/2 lg:block"
              style={{ left: `${GUTTER[side] * 100}%`, fill: stop.color ?? "var(--grove-mist)" }}
            >
              {stop.color && <circle className="grove-glow" r="16" fillOpacity="0.2" />}
              <polygon points="0,-10 9,-3 6,9 -6,9 -9,-3" />
              <polygon points="0,-10 9,-3 0,0" fill="rgb(255 255 255 / 0.35)" />
              <polygon points="-6,9 -9,-3 0,0" fill="rgb(0 0 0 / 0.18)" />
            </svg>
            <div className={cn("relative min-w-0 lg:w-[82%]", side === "right" && "lg:ml-auto")}>
              {/* Below the trail, so the path still runs up to the stop across it. */}
              <span aria-hidden="true" className="absolute -inset-x-4 -inset-y-5 -z-20 sm:-inset-x-6" style={CLEARING} />
              {stop.node}
            </div>
          </div>
        );
      })}
    </div>
  );
}
