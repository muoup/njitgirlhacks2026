import { type PointerEvent, useEffect, useRef, useState } from "react";

import { formatMeasurement, formatNumber } from "@/lib/format";

export interface ChartPoint {
  at: number;
  value: number;
}

const HEIGHT = 156;
const MARGIN = { top: 10, right: 10, bottom: 24, left: 40 };
const HOUR = 3_600_000;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry ? entry.contentRect.width : 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round axis values (1, 2 or 5 times a power of ten) covering the data with a little room. */
function yAxis(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rough = Math.max(max - min, 0.4) / 2;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].find(n => n * power >= rough)! * power;
  const low = Math.floor(min / step) * step;
  const high = Math.max(Math.ceil(max / step) * step, low + step);
  const ticks: number[] = [];
  for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(Math.round(tick * 100) / 100);
  return { low, high, ticks };
}

const clock = new Intl.DateTimeFormat("en", { hour: "numeric" });
const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

/** Time labels on round local hours or midnights, spaced so that at most `room` of them fit. */
function timeAxis(from: number, to: number, room: number) {
  const hours = [1, 2, 3, 6, 12, 24, 48, 72].find(step => (to - from) / (step * HOUR) <= room) ?? 168;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const ticks: number[] = [];
  while (cursor.getTime() <= to) {
    if (cursor.getTime() >= from) ticks.push(cursor.getTime());
    // Whole days are stepped by date so a clock change does not shift the labels off midnight.
    if (hours >= 24) cursor.setDate(cursor.getDate() + hours / 24);
    else cursor.setHours(cursor.getHours() + hours);
  }
  return { ticks, label: hours >= 24 ? date : clock };
}
const moment = new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit" });

/** One metric over time. Hover or drag to read a point; the latest value shows otherwise. */
export function LineChart({
  title,
  unit,
  points,
  from,
  to,
}: {
  title: string;
  unit: string;
  points: ChartPoint[];
  from: number;
  to: number;
}) {
  const [ref, width] = useWidth();
  const [hovered, setHovered] = useState<number | null>(null);

  const last = points.at(-1);
  const shown = (hovered !== null ? points[hovered] : undefined) ?? last;
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  let plot = null;
  if (last && width > 0) {
    const values = points.map(point => point.value);
    const { low, high, ticks } = yAxis(values);
    const x = (at: number) => MARGIN.left + ((at - from) / (to - from)) * innerWidth;
    const y = (value: number) => MARGIN.top + (1 - (value - low) / (high - low)) * innerHeight;
    const line = points.map(point => `${x(point.at).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
    const floor = MARGIN.top + innerHeight;
    const first = points[0]!;

    const time = timeAxis(from, to, Math.max(Math.floor(innerWidth / 64), 2));

    function track(event: PointerEvent<SVGSVGElement>) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const at = from + ((event.clientX - bounds.left - MARGIN.left) / innerWidth) * (to - from);
      let nearest = 0;
      points.forEach((point, index) => {
        if (Math.abs(point.at - at) < Math.abs(points[nearest]!.at - at)) nearest = index;
      });
      setHovered(nearest);
    }

    plot = (
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${title} from ${moment.format(first.at)} to ${moment.format(last.at)}: lowest ${formatMeasurement({ value: Math.min(...values), unit })}, highest ${formatMeasurement({ value: Math.max(...values), unit })}, latest ${formatMeasurement({ value: last.value, unit })}.`}
        className="block touch-pan-y"
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={() => setHovered(null)}
      >
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} className="stroke-border/70" />
            <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px]">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        {time.ticks.map(tick => (
          <text
            key={tick}
            x={x(tick)}
            y={HEIGHT - 6}
            // A label at the right-hand edge would be cut off if it were centred.
            textAnchor={x(tick) > width - 24 ? "end" : "middle"}
            className="fill-muted-foreground text-[11px]"
          >
            {time.label.format(tick)}
          </text>
        ))}
        <polygon
          points={`${x(first.at).toFixed(1)},${floor} ${line} ${x(last.at).toFixed(1)},${floor}`}
          className="fill-chart-1/15"
        />
        <polyline points={line} fill="none" strokeWidth="2" strokeLinejoin="round" className="stroke-chart-1" />
        {shown && (
          <g>
            {hovered !== null && (
              <line x1={x(shown.at)} x2={x(shown.at)} y1={MARGIN.top} y2={floor} className="stroke-grove-mist/50" />
            )}
            <circle cx={x(shown.at)} cy={y(shown.value)} r="4" className="fill-chart-1 stroke-card" strokeWidth="2" />
          </g>
        )}
      </svg>
    );
  }

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-bold">{title}</span>
        {shown && (
          <span className="text-right text-sm text-muted-foreground">
            <span className="text-base font-bold text-foreground tabular-nums">{formatMeasurement({ value: shown.value, unit })}</span>{" "}
            {moment.format(shown.at)}
          </span>
        )}
      </figcaption>
      <div ref={ref} style={{ height: HEIGHT }}>
        {last ? (
          plot
        ) : (
          <p className="m-0 grid h-full place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No readings in this range.
          </p>
        )}
      </div>
    </figure>
  );
}
