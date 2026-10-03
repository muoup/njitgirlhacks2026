import type { Measurement } from "@/lib/api";

/** "soil_moisture" → "Soil moisture". Metric names come from the API and are shown as given. */
export function metricLabel(metric: string) {
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
