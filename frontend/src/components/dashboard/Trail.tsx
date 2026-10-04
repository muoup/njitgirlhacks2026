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
// In pixels: how wide a stepping stone is, how far it is from one to the next, and how round the trail's turns are.
const STONE = 40;
const STRIDE = 60;
const TURN = 96;
// Where a stop's marker lies below the top of the stop, in pixels.
const MARKER = 58;

// The clearing behind a stop: a patch of short grass, rounded unevenly in fixed pixels so tall stops are not more skewed.
const CLEARING = {
  background: "var(--grove-clearing)",
  borderRadius: "44px 56px 48px 52px / 52px 44px 56px 46px",
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
  const end = last.bottom - STONE;
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
function along(line: Point[], every: number): Point[] {
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
  return places;
}

/** Each place with the side of the way through it. */
function sided(places: Point[]): Step[] {
  return places.map(([x, y], index) => {
    const [ax, ay] = places[Math.max(0, index - 1)]!;
    const [bx, by] = places[Math.min(places.length - 1, index + 1)]!;
    const length = Math.hypot(bx - ax, by - ay) || 1;
    return { x, y, sx: (by - ay) / length, sy: -(bx - ax) / length };
  });
}

// In pixels: how far apart the places on the trail are, and how far it strays to either side of its line.
const FINE = 6;
const SWAY = 15;

/** The same line as feet would wear it: straying a little to one side and then the other, between ends that stay put. */
function wander(line: Point[], seed: number): Step[] {
  const straight = sided(along(line, FINE));
  return sided(
    straight.map(({ x, y, sx, sy }, index) => {
      const settled = Math.min(1, index / 14, (straight.length - 1 - index) / 14);
      const off = SWAY * settled * (0.6 * Math.sin((index * FINE) / 46 + seed) + 0.4 * Math.sin((index * FINE) / 21 + seed * 2.3));
      return [x + sx * off, y + sy * off];
    }),
  );
}

/** A fixed number from 0 to 1 for a place on the trail, so the trail is drawn the same way each time. */
function chance(place: number, of: number) {
  const value = Math.sin(place * 127.1 + of * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const n = (value: number) => value.toFixed(1);

/** A flat stone, lying whichever way it fell: a closed curve through corners set unevenly around its middle. */
function stone({ x, y }: Step, count: number, seed: number) {
  const tilt = chance(count, seed + 4) * Math.PI;
  const reach = (STONE / 2) * (0.88 + 0.26 * chance(count, seed + 5));
  const corners = Array.from({ length: 7 }, (_, corner): Point => {
    const turn = ((corner + (chance(count * 7 + corner, seed + 6) - 0.5) * 0.4) / 7) * Math.PI * 2;
    const far = reach * (0.88 + 0.24 * chance(count * 7 + corner, seed + 7));
    // A little longer one way than the other, then turned.
    const [long, short] = [Math.cos(turn) * far, Math.sin(turn) * far * 0.8];
    return [x + long * Math.cos(tilt) - short * Math.sin(tilt), y + long * Math.sin(tilt) + short * Math.cos(tilt)];
  });
  const between = (corner: number): Point => {
    const [ax, ay] = corners[corner % 7]!;
    const [bx, by] = corners[(corner + 1) % 7]!;
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  const [fx, fy] = between(6);
  return `M ${n(fx)} ${n(fy)} ${corners.map(([cx, cy], corner) => `Q ${n(cx)} ${n(cy)} ${n(between(corner)[0])} ${n(between(corner)[1])}`).join(" ")} Z`;
}

/** The stones of one unbroken length of trail, a stride apart, leaving room wherever a stop's marker lies. */
function stretch(line: Point[], markers: Point[], seed: number) {
  const places = wander(line, seed);
  const stride = (places.length - 1) / Math.max(1, Math.round(((places.length - 1) * FINE) / STRIDE));
  const stones: string[] = [];
  for (let count = 0; (count + 0.5) * stride < places.length - 1; count += 1) {
    const place = places[Math.round((count + 0.35 + 0.3 * chance(count, seed + 3)) * stride)]!;
    if (markers.some(([x, y]) => Math.hypot(place.x - x, place.y - y) < STONE * 0.8)) continue;
    stones.push(stone(place, count, seed));
  }
  return stones;
}

/** The trail itself: stepping stones set in the grass, each with the dark of its own edge under it. */
function Track({ route, markers = [], className }: { route: Point[][]; markers?: Point[]; className?: string }) {
  return (
    <g className={className}>
      {route.flatMap((line, index) =>
        stretch(line, markers, index * 20).map(d => (
          <g key={d}>
            <path d={d} transform="translate(0 3)" className="fill-(--grove-shade)" />
            <path d={d} className="fill-(--grove-stone)" />
          </g>
        )),
      )}
    </g>
  );
}

/**
 * Lays widgets out as stops along a path that winds down from the grove: the first stop is
 * the first thing reached, so the order of the list is the order of importance. The path is
 * laid as one line of stepping stones through wherever the stops have come to rest.
 */
export function Trail({ stops }: { stops: TrailStop[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [ground, setGround] = useState<Ground | null>(null);
  const keys = stops.map(stop => stop.key).join("\n");
  const route = useMemo(
    () =>
      ground && {
        narrow: narrowRoute(ground),
        wide: wideRoute(ground),
        markers: ground.stops.map(({ top }, index): Point => [ground.width * GUTTER[sideOf(index)], top + MARKER]),
      },
    [ground],
  );

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
          <Track className="hidden lg:block" route={route.wide} markers={route.markers} />
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
