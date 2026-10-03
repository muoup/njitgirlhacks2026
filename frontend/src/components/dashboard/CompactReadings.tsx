import { Cloud, Droplet, type LucideIcon, Thermometer } from "lucide-react";

import type { Reading } from "@/lib/api";
import { compactMeasurement, formatMeasurement, metricLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

// Metric names are provisional. A name not listed here is shown without an icon.
const ICONS: Record<string, LucideIcon> = {
  soil_moisture: Droplet,
  temperature: Thermometer,
  humidity: Cloud,
};

/** A reading squeezed onto one line: rounded values with an icon each. Purely visual; say the numbers in a label nearby. */
export function CompactReadings({ reading, className }: { reading: Reading | undefined; className?: string }) {
  if (!reading || reading.measurements.length === 0) {
    return <span className={cn("text-xs text-muted-foreground italic", className)}>no data</span>;
  }
  return (
    <span aria-hidden="true" className={cn("flex flex-wrap justify-center gap-x-2 text-xs tabular-nums", className)}>
      {reading.measurements.map(measurement => {
        const Icon = ICONS[measurement.metric];
        return (
          <span key={measurement.metric} title={metricLabel(measurement.metric)} className="inline-flex items-center gap-0.5">
            {Icon && <Icon className="size-3 opacity-70" />}
            {compactMeasurement(measurement)}
          </span>
        );
      })}
    </span>
  );
}

/** "Soil moisture 53.1%, temperature 23.4 °C": the same reading in words, for labels. */
export function readingInWords(reading: Reading | undefined) {
  if (!reading || reading.measurements.length === 0) return "no readings";
  return reading.measurements
    .map(measurement => `${metricLabel(measurement.metric).toLowerCase()} ${formatMeasurement(measurement)}`)
    .join(", ");
}
