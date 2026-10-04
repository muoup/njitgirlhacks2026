import { createContext, useContext, useMemo } from "react";

import { api, type Measurement, type MetricInfo } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { compactMeasurement, metricLabel } from "@/lib/format";

/** The metric catalogue the garden on screen came with. Give it the dashboard's `metrics`. */
export const MetricCatalogue = createContext<MetricInfo[]>([]);

/** What the catalogue says about metrics: their names, and which ones stand for a plant at a glance. */
export interface Metrics {
  info: (metric: string) => MetricInfo | undefined;
  label: (metric: string) => string;
  /** The measurements a plant shows at a glance, in the catalogue's order. */
  core: (measurements: Measurement[]) => Measurement[];
  isCore: (metric: string) => boolean;
  /** Sorts metrics into the catalogue's order, with any it does not list last. */
  inOrder: (a: string, b: string) => number;
  /** A measurement in the least room it will fit: its word where the metric is read that way, or a rounded number. */
  glance: (measurement: Measurement) => string;
}

export function metricsFrom(catalogue: MetricInfo[]): Metrics {
  const known = new Map(catalogue.map((info, index) => [info.metric, { info, index }]));
  const isCore = (metric: string) => known.get(metric)?.info.tier === "core";
  const inOrder = (a: string, b: string) => (known.get(a)?.index ?? catalogue.length) - (known.get(b)?.index ?? catalogue.length);
  return {
    info: metric => known.get(metric)?.info,
    label: metric => known.get(metric)?.info.label ?? metricLabel(metric),
    isCore,
    inOrder,
    core: measurements => measurements.filter(measurement => isCore(measurement.metric)).sort((a, b) => inOrder(a.metric, b.metric)),
    glance: measurement =>
      known.get(measurement.metric)?.info.glance === "word" && measurement.word ? measurement.word : compactMeasurement(measurement),
  };
}

export function useMetrics() {
  const catalogue = useContext(MetricCatalogue);
  return useMemo(() => metricsFrom(catalogue), [catalogue]);
}

const NONE: MetricInfo[] = [];
let asked: Promise<MetricInfo[]> | undefined;

/** The catalogue for places with no dashboard to take it from. It is asked for once and kept. */
export function useFetchedCatalogue() {
  const { resource } = useResource(() => {
    asked ??= api.listMetrics().then(response => response.metrics);
    // A failure is not kept, so the next thing to need the catalogue asks again.
    asked.catch(() => (asked = undefined));
    return asked;
  }, []);
  return resource.status === "ready" ? resource.data : NONE;
}
