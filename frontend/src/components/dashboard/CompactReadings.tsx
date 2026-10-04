import { Cloud, Droplet, type LucideIcon, Sun, Thermometer, Wind } from "lucide-react";
import { Fragment } from "react";

import type { Reading } from "@/lib/api";
import { formatMeasurement } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type Metrics, useMetrics } from "./metrics";

// A metric not listed here is shown without an icon.
const ICONS: Record<string, LucideIcon> = {
  soil_moisture: Droplet,
  soil_moisture_raw: Droplet,
  light_level_raw: Sun,
  temperature: Thermometer,
  air_quality_raw: Wind,
  humidity: Cloud,
};

/**
 * A reading squeezed into a line or two: the metrics that stand for a plant at a glance, an
 * icon each. Purely visual; say the numbers in a label nearby.
 */
export function CompactReadings({ reading, className }: { reading: Reading | undefined; className?: string }) {
  const metrics = useMetrics();
  const shown = reading ? metrics.core(reading.measurements) : [];
  if (shown.length === 0) {
    return <span className={cn("text-xs text-muted-foreground italic", className)}>no data</span>;
  }
  return (
    // Set as words in a line, so that when they do not fit they break into even rows.
    <span aria-hidden="true" className={cn("block text-center text-xs text-balance tabular-nums", className)}>
      {shown.map(measurement => {
        const Icon = ICONS[measurement.metric];
        return (
          <Fragment key={measurement.metric}>
            <span title={metrics.label(measurement.metric)} className="mx-1 inline-flex items-center gap-0.5 align-middle">
              {Icon && <Icon className="size-3 opacity-70" />}
              {metrics.glance(measurement)}
            </span>{" "}
          </Fragment>
        );
      })}
    </span>
  );
}

/** "Soil dry, warmth 23.4 °C": the same reading in words, for labels. */
export function readingInWords(reading: Reading | undefined, metrics: Metrics) {
  const shown = reading ? metrics.core(reading.measurements) : [];
  if (shown.length === 0) return "no readings";
  return shown
    .map(measurement => {
      const read = metrics.info(measurement.metric)?.glance === "word" && measurement.word;
      return `${metrics.label(measurement.metric).toLowerCase()} ${read ? read.toLowerCase() : formatMeasurement(measurement)}`;
    })
    .join(", ");
}
