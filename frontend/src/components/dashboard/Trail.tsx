import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TrailStop {
  key: string;
  /** Colour of the stone marking this stop; plain when absent. */
  color?: string;
  node: ReactNode;
}

// Where the trail runs, in percent of the width. On wide screens stops alternate sides and
// the trail passes each one in the gutter opposite; on narrow ones stops fill the width and
// the trail only shows between them.
const GUTTER = { left: 91, right: 9 };
const NARROW = [36, 64];

/** A stretch of trail: a worn strip with stepping stones along it, stretched to fill its box. */
function Stretch({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 size-full overflow-visible", className)}
    >
      <g fill="none" strokeLinecap="round">
        <path d={d} vectorEffect="non-scaling-stroke" strokeWidth="38" style={{ stroke: "var(--grove-haze)" }} />
        <path d={d} vectorEffect="non-scaling-stroke" strokeWidth="10" strokeDasharray="0.1 24" style={{ stroke: "var(--grove-mid-2)" }} />
      </g>
    </svg>
  );
}

// The clearing behind a stop: moonlit ground, cut unevenly in fixed pixels so tall stops are not more skewed.
const CLEARING = {
  background: "linear-gradient(164deg, var(--grove-clearing-hi) 42%, var(--grove-clearing) 42%)",
  clipPath:
    "polygon(14px 6px, 38% 0, calc(100% - 20px) 10px, 100% 46%, calc(100% - 8px) calc(100% - 4px), 55% 100%, 6px calc(100% - 12px), 0 40%)",
};

function curve(from: number, to: number) {
  return `M ${from} 0 C ${from} 60, ${to} 40, ${to} 100`;
}

/** The same bend, kept clear of both ends of its box so its round ends do not reach the stops. */
function shortCurve(from: number, to: number) {
  return `M ${from} 34 C ${from} 54, ${to} 46, ${to} 66`;
}

/**
 * Lays widgets out as stops along a path that winds down from the grove: the first stop is
 * the first thing reached, so the order of the list is the order of importance.
 */
export function Trail({ stops }: { stops: TrailStop[] }) {
  return (
    // Isolated so the trail can sit behind the stops without slipping behind the page.
    <div className="relative isolate">
      {stops.map((stop, index) => {
        const side = index % 2 === 0 ? "left" : "right";
        const at = GUTTER[side];
        return (
          <Fragment key={stop.key}>
            <div className="relative -z-10 h-16">
              <Stretch className="lg:hidden" d={shortCurve(index === 0 ? 50 : NARROW[(index - 1) % 2]!, NARROW[index % 2]!)} />
              <Stretch className="hidden lg:block" d={curve(index === 0 ? 50 : 100 - at, at)} />
            </div>
            <div className="group/stop relative" data-side={side}>
              <Stretch className="-z-10 hidden lg:block" d={`M ${at} 0 C ${at + 3} 30, ${at - 3} 70, ${at} 100`} />
              <svg
                aria-hidden="true"
                viewBox="-16 -16 32 32"
                className="absolute top-3 hidden size-9 -translate-x-1/2 lg:block"
                style={{ left: `${at}%`, fill: stop.color ?? "var(--grove-mist)" }}
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
          </Fragment>
        );
      })}
    </div>
  );
}
