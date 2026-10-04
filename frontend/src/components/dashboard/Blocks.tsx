import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import type { Reading } from "@/lib/api";
import { formatMeasurement, formatNumber, spanInWords } from "@/lib/format";
import { LineChart } from "./LineChart";
import { useMetrics } from "./metrics";
import type { OverviewBlock } from "./overview";
import { Skeleton } from "./Panel";
import { mostMoved, rangeOf, seriesByMetric, usePlantReadings } from "./readings";

type Of<T extends OverviewBlock["type"]> = Extract<OverviewBlock, { type: T }>;

const QUIET = "m-0 text-sm text-muted-foreground";

/**
 * The latest of the readings that stand for a plant, written large and plain. A metric read
 * as a word shows the word, with its number beside its name.
 */
function ReadingsBlock({ reading }: { reading: Reading | undefined }) {
  const metrics = useMetrics();
  const shown = reading ? metrics.core(reading.measurements) : [];
  if (shown.length === 0) return <p className={QUIET}>No readings have arrived for this plant yet.</p>;
  return (
    <dl className="m-0 flex flex-wrap gap-x-8 gap-y-3">
      {shown.map(measurement => {
        const word = metrics.info(measurement.metric)?.glance === "word" && measurement.word;
        return (
          <div key={measurement.metric}>
            <dd className="m-0 text-3xl leading-none font-bold tabular-nums">{word || formatMeasurement(measurement)}</dd>
            <dt className="mt-1 text-xs text-muted-foreground">
              {metrics.label(measurement.metric)}
              {word && ` · ${formatMeasurement(measurement)}`}
            </dt>
          </div>
        );
      })}
    </dl>
  );
}

/** One metric over a range, in the plant's urgency colour, against the stretch it is healthy in. */
function ChartBlock({ plantId, block }: { plantId: string; block: Of<"chart"> }) {
  const { resource } = usePlantReadings(plantId, block.range);
  const range = rangeOf(block.range);
  const metrics = useMetrics();

  if (resource.status === "loading") return <Skeleton className="h-36" />;
  if (resource.status === "error") return <p className={QUIET}>The history couldn&rsquo;t be loaded.</p>;

  const series = seriesByMetric(resource.data.readings);
  const metric = block.metric ?? mostMoved(series);
  const chosen = metric ? series.get(metric) : undefined;
  if (!metric || !chosen) return <p className={QUIET}>No readings in the last {range.label}.</p>;

  return (
    <LineChart
      title={`${metrics.label(metric)}, last ${range.label}`}
      unit={chosen.unit}
      points={chosen.points}
      from={Date.parse(resource.data.from)}
      to={Date.parse(resource.data.to)}
      height={132}
      band={metrics.info(metric)?.scale?.healthy}
      // Marks were chosen for one metric; they mean nothing on another.
      marks={block.metric ? block.marks?.map(mark => ({ at: Date.parse(mark.at), label: mark.label })) : undefined}
    />
  );
}

/** Where the latest value sits between the ends of its metric's scale, with the healthy stretch marked. */
function MeterBlock({ reading, block }: { reading: Reading | undefined; block: Of<"meter"> }) {
  const metrics = useMetrics();
  const label = metrics.label(block.metric);
  const scale = metrics.info(block.metric)?.scale;
  const measurement = reading?.measurements.find(item => item.metric === block.metric);
  if (!scale || !measurement) return <p className={QUIET}>No {label.toLowerCase()} reading has arrived yet.</p>;

  const place = (value: number) => Math.min(1, Math.max(0, (value - scale.low) / (scale.high - scale.low))) * 100;
  const shown = (value: number) => formatMeasurement({ value, unit: measurement.unit });
  const reads = `${measurement.word ? `${measurement.word}, ` : ""}${shown(measurement.value)}`;
  const healthy = `${formatNumber(scale.healthy.from)} to ${shown(scale.healthy.to)}`;

  return (
    <div>
      <p className="m-0 flex items-baseline justify-between gap-3">
        <span className="font-bold">{label}</span>
        <span className="text-base font-bold tabular-nums">{reads}</span>
      </p>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={scale.low}
        aria-valuemax={scale.high}
        aria-valuenow={measurement.value}
        aria-valuetext={`${reads}. Healthy from ${healthy}.`}
        className="relative mt-3.5 h-2.5 rounded-full bg-muted"
      >
        <span
          className="absolute inset-y-0 bg-grove-ok/45"
          style={{ left: `${place(scale.healthy.from)}%`, right: `${100 - place(scale.healthy.to)}%` }}
        />
        <span
          className="absolute -top-1.5 h-[22px] w-1.5 -translate-x-1/2 rounded-full bg-chart-1 shadow-[0_0_0_2px_var(--plaque-face,#14271b)]"
          style={{ left: `${place(measurement.value)}%` }}
        />
      </div>
      <p className="mt-2.5 mb-0 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{shown(scale.low)}</span>
        <span>Healthy from {healthy}</span>
        <span>{shown(scale.high)}</span>
      </p>
    </div>
  );
}

/** The latest value of one metric, and how far it has moved across the readings in the range. */
function StatBlock({ plantId, block }: { plantId: string; block: Of<"stat"> }) {
  const { resource } = usePlantReadings(plantId, block.range);
  const range = rangeOf(block.range);
  const metrics = useMetrics();
  const label = metrics.label(block.metric);

  if (resource.status === "loading") return <Skeleton className="h-14 w-40" />;
  if (resource.status === "error") return <p className={QUIET}>The history couldn&rsquo;t be loaded.</p>;

  const series = seriesByMetric(resource.data.readings).get(block.metric);
  const last = series?.points.at(-1);
  if (!series || !last) return <p className={QUIET}>No {label.toLowerCase()} readings in the last {range.label}.</p>;

  const first = series.points[0]!;
  const change = last.value - first.value;
  const scale = metrics.info(block.metric)?.scale;
  // A fiftieth of the scale, or of the value itself, is too little to call a change.
  const steady = Math.abs(change) < (scale ? (scale.high - scale.low) / 50 : Math.max(Math.abs(first.value) / 50, 0.05));
  const over = spanInWords(last.at - first.at);
  // A change in a percentage is counted in points, so it cannot be read as a share of the value.
  const amount = series.unit === "%" ? `${formatNumber(Math.abs(change))} points` : formatMeasurement({ value: Math.abs(change), unit: series.unit });
  const Icon = series.points.length < 2 || steady ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const moved =
    series.points.length < 2
      ? `one reading in the last ${range.label}`
      : steady
        ? `steady over ${over}`
        : `${change > 0 ? "up" : "down"} ${amount} over ${over}`;

  return (
    <div>
      <p className="m-0 text-3xl leading-none font-bold tabular-nums">{formatMeasurement({ value: last.value, unit: series.unit })}</p>
      <p className="mt-1.5 mb-0 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-chart-1" />
        <span>
          {label} · {moved}
        </span>
      </p>
    </div>
  );
}

function StepsBlock({ block }: { block: Of<"steps"> }) {
  return (
    <div>
      <h3 className="m-0 text-base font-bold">What to do</h3>
      <ol role="list" className="m-0 mt-2 grid list-none gap-2 p-0">
        {block.items.map((item, index) => (
          <li key={index} className="flex gap-2.5 leading-snug">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-chart-1/20 text-xs font-bold tabular-nums">{index + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Whether a block wants a column's width, rather than a place on a line with others. */
export function isWide(block: OverviewBlock) {
  return block.type === "chart" || block.type === "meter";
}

/**
 * Draws one block of the kit about one plant. The block only says what to show: the values
 * come from the plant's readings and the scales from the metric catalogue. `subject` names
 * the plant above the block, for places that are not already about it.
 */
export function BlockView({ block, plantId, reading, subject }: {
  block: OverviewBlock;
  plantId: string;
  /** The plant's latest reading, for the blocks that show where it stands now. */
  reading: Reading | undefined;
  subject?: string;
}) {
  const drawn =
    block.type === "readings" ? <ReadingsBlock reading={reading} />
    : block.type === "chart" ? <ChartBlock plantId={plantId} block={block} />
    : block.type === "meter" ? <MeterBlock reading={reading} block={block} />
    : block.type === "stat" ? <StatBlock plantId={plantId} block={block} />
    : <StepsBlock block={block} />;
  if (!subject || block.type === "steps") return drawn;
  return (
    <div className="min-w-0">
      <p className="mt-0 mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{subject}</p>
      {drawn}
    </div>
  );
}

/** For places with no dashboard to hand: finds a plant's latest reading in its last week. */
export function LatestReading({ plantId, children }: { plantId: string; children: (reading: Reading | undefined) => ReactNode }) {
  const { resource } = usePlantReadings(plantId, "7d");
  if (resource.status === "loading") return <Skeleton className="h-14" />;
  const readings = resource.status === "ready" ? resource.data.readings : [];
  return children(readings.reduce<Reading | undefined>((latest, reading) => (!latest || reading.measuredAt > latest.measuredAt ? reading : latest), undefined));
}
