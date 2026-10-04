import type { MetricInfoData, ReadingData } from "./schemas";

// Soil is measured: the probe's ADC count in dry air and in water (a larger count is wetter).
const SOIL = { dry: 0, wet: 500 };
// PLACEHOLDER until the prototype's sensor is measured: the count covered and in full sun.
const LIGHT = { dark: 0, bright: 1023 };

interface Definition extends Omit<MetricInfoData, "metric"> {
  /** The stored unit and how a stored value becomes the one shown. Absent when they are the same. */
  stored?: { unit: string; shown: (value: number) => number };
}

/** A stored count placed between the two ends of its calibration, as 0 to 100. */
const between = (zero: number, full: number) => (value: number) =>
  Math.round(Math.min(1, Math.max(0, (value - zero) / (full - zero))) * 100);

const soil = {
  low: 0, high: 100, healthy: { from: 40, to: 70 },
  bands: [{ from: 0, word: "Dry" }, { from: 25, word: "Drying" }, { from: 40, word: "Damp" }, { from: 70, word: "Wet" }],
};

/**
 * Every metric the grove knows, in the order it shows them. Storage keeps what the monitor
 * sent; this decides what each is called, which ones a plant shows at a glance, and how a
 * raw count becomes something a gardener can read. The scaled values are positions on a
 * provisional calibration, not volumetric water content or lux.
 */
const definitions: Record<string, Definition> = {
  soil_moisture_raw: { label: "Soil", unit: "%", tier: "core", glance: "word", scale: soil,
    stored: { unit: "ADC", shown: between(SOIL.dry, SOIL.wet) } },
  // The development fixtures report soil as a percentage already.
  soil_moisture: { label: "Soil", unit: "%", tier: "core", glance: "word", scale: soil },
  light_level_raw: { label: "Light", unit: "%", tier: "core", glance: "word",
    stored: { unit: "ADC", shown: between(LIGHT.dark, LIGHT.bright) },
    scale: { low: 0, high: 100, healthy: { from: 30, to: 85 },
      bands: [{ from: 0, word: "Dark" }, { from: 15, word: "Dim" }, { from: 40, word: "Bright" }, { from: 85, word: "Glaring" }] } },
  temperature: { label: "Warmth", unit: "°C", tier: "core", glance: "value",
    scale: { low: 0, high: 40, healthy: { from: 15, to: 28 },
      bands: [{ from: 0, word: "Cold" }, { from: 10, word: "Cool" }, { from: 17, word: "Mild" }, { from: 26, word: "Warm" }, { from: 32, word: "Hot" }] } },
  // Uncalibrated: only worth comparing with the same plant's own history.
  air_quality_raw: { label: "Air quality", unit: "", tier: "core", glance: "value",
    stored: { unit: "raw", shown: value => value } },
  humidity: { label: "Air damp", unit: "%", tier: "core", glance: "value",
    scale: { low: 0, high: 100, healthy: { from: 40, to: 70 },
      bands: [{ from: 0, word: "Dry" }, { from: 40, word: "Comfortable" }, { from: 70, word: "Humid" }] } },
  pressure: { label: "Air pressure", unit: "hPa", tier: "detail", glance: "value",
    stored: { unit: "Pa", shown: value => Math.round(value / 10) / 10 } },
  altitude: { label: "Altitude", unit: "m", tier: "detail", glance: "value" },
};

export const metricCatalogue: MetricInfoData[] = Object.entries(definitions)
  .map(([metric, { stored, ...info }]) => ({ metric, ...info }));

function wordFor(scale: NonNullable<Definition["scale"]>, value: number) {
  return scale.bands.findLast(band => value >= band.from)?.word ?? scale.bands[0]!.word;
}

/**
 * A stored reading as the grove shows it: counts placed on their scale, units a gardener
 * reads, and a word wherever the metric has one. A metric the catalogue does not know, or a
 * value that is not in its stored unit, passes through unchanged, as does the reading's colour.
 */
export function calibrate(reading: ReadingData): ReadingData {
  return { ...reading, measurements: reading.measurements.map(measurement => {
    const definition = definitions[measurement.metric];
    if (!definition) return measurement;
    const stored = definition.stored?.unit === measurement.unit ? definition.stored : undefined;
    if (!stored && measurement.unit !== definition.unit) return measurement;
    const value = stored ? stored.shown(measurement.value) : measurement.value;
    return { metric: measurement.metric, value, unit: definition.unit,
      ...(definition.scale ? { word: wordFor(definition.scale, value) } : {}) };
  }) };
}
