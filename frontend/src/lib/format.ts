import type { Measurement } from "@/lib/api";

/** "light_level" → "Light level": a name for a metric the garden's catalogue does not list. */
export function metricLabel(metric: string) {
  const words = metric.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "21%", "19.5 °C", "50": percent hugs the number, other units take a space, and a plain number has none. */
export function formatMeasurement({ value, unit }: Pick<Measurement, "value" | "unit">) {
  return unit === "%" || !unit ? `${formatNumber(value)}${unit}` : `${formatNumber(value)} ${unit}`;
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

/** "5 hours", "2 days": how long a stretch of readings covers, to the nearest whole unit. */
export function spanInWords(milliseconds: number) {
  const hours = Math.max(Math.round(milliseconds / 3_600_000), 1);
  if (hours < 36) return hours === 1 ? "an hour" : `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

/** "53%", "23°", "410 ppm": a whole number with the shortest unit that still reads, for tight spaces. */
export function compactMeasurement({ value, unit }: Pick<Measurement, "value" | "unit">) {
  const rounded = Math.round(value);
  if (unit === "%" || !unit) return `${rounded}${unit}`;
  return unit.startsWith("°") ? `${rounded}°` : `${rounded} ${unit}`;
}
