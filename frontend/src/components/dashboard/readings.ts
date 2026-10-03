import { api, type Reading } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import type { ChartPoint } from "./LineChart";

const HOUR = 3_600_000;
export const RANGES = [
  { id: "24h", label: "24 hours", span: 24 * HOUR },
  { id: "7d", label: "7 days", span: 7 * 24 * HOUR },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export function rangeOf(id: RangeId) {
  return RANGES.find(range => range.id === id)!;
}

export interface Series {
  unit: string;
  points: ChartPoint[];
}

/** Splits readings into one series per metric, in the order the metrics first appear. */
export function seriesByMetric(readings: Reading[]) {
  const series = new Map<string, Series>();
  for (const reading of readings) {
    const at = Date.parse(reading.measuredAt);
    for (const { metric, unit, value } of reading.measurements) {
      const entry = series.get(metric) ?? { unit, points: [] };
      entry.points.push({ at, value });
      series.set(metric, entry);
    }
  }
  return series;
}

function mean(points: ChartPoint[]) {
  return points.reduce((sum, point) => sum + point.value, 0) / points.length;
}

/**
 * The metric whose level shifted most between the start and the end of its series, measured
 * against its own spread so that a daily cycle that returns to where it began counts as still.
 */
export function mostMoved(series: Map<string, Series>) {
  let best: { metric: string; shift: number } | undefined;
  for (const [metric, { points }] of series) {
    if (points.length < 2) continue;
    const values = points.map(point => point.value);
    const spread = Math.max(...values) - Math.min(...values);
    const edge = Math.max(Math.floor(points.length / 7), 1);
    const shift = spread > 0 ? Math.abs(mean(points.slice(-edge)) - mean(points.slice(0, edge))) / spread : 0;
    if (!best || shift > best.shift) best = { metric, shift };
  }
  return best?.metric;
}

/** A plant's readings over the given range ending now. Fetched apart from the dashboard. */
export function usePlantReadings(plantId: string, rangeId: RangeId) {
  return useResource(() => {
    const to = new Date();
    return api.getPlantReadings(plantId, new Date(to.getTime() - rangeOf(rangeId).span), to);
  }, [plantId, rangeId]);
}
