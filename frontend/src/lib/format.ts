import type { Measurement } from "@/lib/api";

// What the grove calls the metrics it knows. Each still says plainly what was measured.
const METRIC_NAMES: Record<string, string> = {
  soil_moisture: "Soil damp",
  temperature: "Warmth",
  humidity: "Air damp",
};

/** "soil_moisture" → "Soil damp". A metric the grove has no name for is shown as the API gives it: "Light level". */
export function metricLabel(metric: string) {
  const known = METRIC_NAMES[metric];
  if (known) return known;
  const words = metric.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "21%", "19.5 °C": percent hugs the number, other units take a space. */
export function formatMeasurement({ value, unit }: Pick<Measurement, "value" | "unit">) {
  return unit === "%" ? `${formatNumber(value)}%` : `${formatNumber(value)} ${unit}`;
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "4 minutes ago", "2 hours ago", "yesterday". */
export function timeAgo(timestamp: string, now = Date.now()) {
  const seconds = Math.round((Date.parse(timestamp) - now) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  if (Math.abs(seconds) < 60) return "just now";
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

/** "53%", "23°", "410 ppm": a whole number with the shortest unit that still reads, for tight spaces. */
export function compactMeasurement({ value, unit }: Pick<Measurement, "value" | "unit">) {
  const rounded = Math.round(value);
  if (unit === "%") return `${rounded}%`;
  return unit.startsWith("°") ? `${rounded}°` : `${rounded} ${unit}`;
}
