import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";

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
// In pixels: how wide the trail is, and how round its turns are.
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

type Point = readonly [number, number];

const sideOf = (index: number) => (index % 2 === 0 ? "left" : "right");

/** The points of a curve after its first, from the first point given to the last, drawn toward those between. */
function bend(...points: Point[]): Point[] {
  return Array.from({ length: 16 }, (_, index) => {
    const t = (index + 1) / 16;
    let level = points;
    while (level.length > 1) level = level.slice(1).map(([x, y], at) => [level[at]![0] + (x - level[at]![0]) * t, level[at]![1] + (y - level[at]![1]) * t]);
    return level[0]!;
  });
}

/** One line down the gutters, crossing over between stops in the middle of the gap, with round turns. */
function wideRoute({ width, stops }: Ground): Point[][] {
  const last = stops.at(-1);
  if (!last) return [];
  const end = last.bottom - STRIP;
  const crossings = stops.map((stop, index) => ((stops[index - 1]?.bottom ?? 0) + stop.top) / 2);
  let x = width / 2;
  const line: Point[] = [[x, 0]];
  crossings.forEach((cross, index) => {
    const to = width * GUTTER[sideOf(index)];
    const way = Math.sign(to - x);
    // A turn may begin beside the stop above, where the gutter is clear, and end beside the one
    // below. Two turns share the stretch between their crossings, however short the stop is.
    const out = Math.min(TURN, index === 0 ? cross : (cross - crossings[index - 1]!) / 2);
    const back = Math.min(TURN, ((crossings[index + 1] ?? end) - cross) / (index === stops.length - 1 ? 1 : 2));
    line.push([x, cross - out], ...bend([x, cross - out], [x, cross], [x + way * out, cross]));
    line.push([to - way * back, cross], ...bend([to - way * back, cross], [to, cross], [to, cross + back]));
    x = to;
  });
  line.push([x, end]);
  return [line];
}

/** A bend in each gap, running up to the stops over their clearings and ending just short of them. */
function narrowRoute({ width, stops }: Ground): Point[][] {
  return stops.map((stop, index) => {
    const from = width * (index === 0 ? 0.5 : NARROW[(index - 1) % 2]!);
    const to = width * NARROW[index % 2]!;
    const top = (stops[index - 1]?.bottom ?? 0) + 6;
    const bottom = Math.max(top, stop.top - 6);
    const pull = (bottom - top) * 0.7;
    return [[from, top], ...bend([from, top], [from, top + pull], [to, bottom - pull], [to, bottom])];
  });
}

/** A place on the trail, and the unit vector pointing to one side of it. */
interface Step {
  x: number;
  y: number;
  sx: number;
  sy: number;
}

/** Places along a line, the same distance apart. */
function walk(line: Point[], every: number): Step[] {
  const places: Point[] = [line[0]!];
  let owed = every;
  for (let index = 1; index < line.length; index += 1) {
    const [ax, ay] = line[index - 1]!;
    const [bx, by] = line[index]!;
    const length = Math.hypot(bx - ax, by - ay);
    let done = 0;
    while (length - done >= owed) {
      done += owed;
      owed = every;
      places.push([ax + ((bx - ax) * done) / length, ay + ((by - ay) * done) / length]);
    }
    owed -= length - done;
  }
  return places.map(([x, y], index) => {
    const [ax, ay] = places[Math.max(0, index - 1)]!;
    const [bx, by] = places[Math.min(places.length - 1, index + 1)]!;
    const length = Math.hypot(bx - ax, by - ay) || 1;
    return { x, y, sx: (by - ay) / length, sy: -(bx - ax) / length };
  });
}

/** A fixed number from 0 to 1 for a place on the trail, so the trail is drawn the same way each time. */
function chance(place: number, of: number) {
  const value = Math.sin(place * 127.1 + of * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const n = (value: number) => value.toFixed(1);
const shape = (points: Point[]) => points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");

/** Ground along the steps, reaching `reach(index, side)` pixels to either side of each, with straight cuts between. */
function strip(steps: Step[], reach: (index: number, side: 1 | -1) => number) {
  const edge = (side: 1 | -1) => steps.map(({ x, y, sx, sy }, index): Point => [x + side * sx * reach(index, side), y + side * sy * reach(index, side)]);
  return shape([...edge(1), ...edge(-1).reverse()]);
}

interface Stretch {
  verge: string;
  earth: string;
  worn: string;
  stones: { body: string; lit: string }[];
  tufts: { blades: string; pale: boolean }[];
}

// In steps of FINE pixels: how far apart the trail's edge is cut.
const FINE = 6;
const CUT = 4;

/** One unbroken length of trail: bare earth with uneven edges, worn paler down the middle, stones to step on and grass at the verge. */
function stretch(line: Point[], seed: number): Stretch {
  const fine = walk(line, FINE);
  const steps = fine.filter((_, index) => index % CUT === 0 || index === fine.length - 1);
  // The trail narrows to nothing much where it begins and ends.
  const taper = (index: number) => [0.3, 0.75][Math.min(index, steps.length - 1 - index)] ?? 1;
  const half = (index: number, side: number) => (STRIP / 2) * taper(index) * (0.78 + 0.5 * chance(index, seed + side));

  const stones: Stretch["stones"] = [];
  for (let at = 5, count = 0; at < fine.length - 4; at += 6 + Math.floor(chance(count, seed + 3) * 7), count += 1) {
    const { x, y, sx, sy } = fine[at]!;
    // Mostly flat stones to step on, down the middle; now and then a pebble kicked to the side.
    const pebble = chance(count, seed + 4) < 0.3;
    const aside = (chance(count, seed + 5) - 0.5) * (pebble ? 22 : 8);
    const size = pebble ? 3 + chance(count, seed + 6) * 1.5 : 6.5 + chance(count, seed + 6) * 3.5;
    const sides = chance(count, seed + 2) < 0.5 ? 5 : 6;
    const centre: Point = [x + sx * aside, y + sy * aside];
    // The first corners face the moon, so every stone is lit from the same side.
    const corners = Array.from({ length: sides }, (_, corner): Point => {
      const turn = -2.5 + ((corner + (chance(count * sides + corner, seed + 7) - 0.5) * 0.5) / sides) * Math.PI * 2;
      const far = size * (0.8 + 0.4 * chance(count * sides + corner, seed + 8));
      return [centre[0] + Math.cos(turn) * far, centre[1] + Math.sin(turn) * far];
    });
    stones.push({ body: shape(corners), lit: shape([centre, ...corners.slice(0, 3)]) });
  }

  const tufts: Stretch["tufts"] = [];
  steps.forEach(({ x, y, sx, sy }, index) => {
    if (taper(index) < 1 || chance(index, seed + 9) > 0.3) return;
    const side = chance(index, seed + 10) < 0.5 ? 1 : -1;
    const from = half(index, side) - 2;
    const tall = 7 + chance(index, seed + 11) * 6;
    // Outward from the edge, and along it.
    const at = (out: number, along: number): Point => [x + side * sx * (from + out) - sy * along, y + side * sy * (from + out) + sx * along];
    tufts.push({
      blades: shape([at(0, -4), at(tall * 0.8, -6), at(2, -1.4), at(tall, 0.6), at(2, 1.4), at(tall * 0.7, 6), at(0, 4)]),
      pale: chance(index, seed + 12) < 0.4,
    });
  });

  return {
    verge: strip(steps, (index, side) => half(index, side) + 3 + 4 * chance(index, seed + side + 13)),
    earth: strip(steps, half),
    worn: strip(steps, (index, side) => half(index, side) * (0.3 + 0.35 * chance(index, seed + side + 15))),
    stones,
    tufts,
  };
}

/** The trail itself: a strip of bare earth trodden into the forest floor, with stepping stones along it. */
function Track({ route, className }: { route: Point[][]; className?: string }) {
  return (
    <g className={className}>
      {route.map((line, index) => {
        const { verge, earth, worn, stones, tufts } = stretch(line, index * 20);
        return (
          <g key={index}>
            <polygon points={verge} className="fill-(--grove-shade)" />
            <polygon points={earth} className="fill-(--grove-earth)" />
            <polygon points={worn} className="fill-(--grove-earth-hi)" />
            {tufts.map(({ blades, pale }) => (
              <polygon key={blades} points={blades} className={pale ? "fill-(--grove-near-1)" : "fill-(--grove-mid-1)"} />
            ))}
            {stones.map(({ body, lit }) => (
              <g key={body}>
                <polygon points={body} className="fill-(--grove-stone)" />
                <polygon points={lit} className="fill-(--grove-stone-hi)" />
              </g>
            ))}
          </g>
        );
      })}
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
  const route = useMemo(() => ground && { narrow: narrowRoute(ground), wide: wideRoute(ground) }, [ground]);

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
      {route && (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible">
          <Track className="lg:hidden" route={route.narrow} />
          <Track className="hidden lg:block" route={route.wide} />
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
