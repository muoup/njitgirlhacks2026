import { t, type Static } from "elysia";
import { ApiError } from "./errors";

// Raw ADC values are deliberately not labelled as percentages, lux, or ppm.
export const sensorMetrics = {
  soil_moisture_raw: { unit: "ADC", min: 0, max: 65535, integer: true },
  air_quality_raw: { unit: "raw", min: 0, max: 65535, integer: true },
  light_level_raw: { unit: "ADC", min: 0, max: 65535, integer: true },
  pressure: { unit: "Pa", min: 0, max: 200000 },
  temperature: { unit: "°C", min: -100, max: 150 },
  altitude: { unit: "m", min: -2000, max: 30000 },
  color_clear: { unit: "count", min: 0, max: 65535, integer: true },
  color_red: { unit: "count", min: 0, max: 65535, integer: true },
  color_green: { unit: "count", min: 0, max: 65535, integer: true },
  color_blue: { unit: "count", min: 0, max: 65535, integer: true },
} as const;
const SensorMeasurement = t.Union(Object.entries(sensorMetrics).map(([metric, definition]) => t.Object({
  metric: t.Literal(metric), unit: t.Literal(definition.unit),
  value: "integer" in definition
    ? t.Integer({ minimum: definition.min, maximum: definition.max })
    : t.Number({ minimum: definition.min, maximum: definition.max }),
}, { additionalProperties: false })));
export const IngestRequest = t.Object({
  sampleId: t.String({ minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9_.:-]+$",
    description: "Unique boot ID plus sample counter; reuse unchanged on retries." }),
  measuredAt: t.Optional(t.String({ format: "date-time", description: "Omit if no synchronized clock; first receipt time is used." })),
  measurements: t.Array(SensorMeasurement, { minItems: 1, maxItems: 10 }),
}, { additionalProperties: false });
export const IngestResponse = t.Object({
  accepted: t.Literal(true), duplicate: t.Boolean(),
  measuredAt: t.String({ format: "date-time" }), receivedAt: t.String({ format: "date-time" }),
});
export type IngestData = Static<typeof IngestRequest>;
export type IngestResult = Static<typeof IngestResponse>;

export function validateSample(input: IngestData, now = Date.now()) {
  if (new Set(input.measurements.map(item => item.metric)).size !== input.measurements.length) {
    throw new ApiError(422, "INVALID_READING", "Each metric may appear only once per sample.");
  }
  if (input.measuredAt && (!Number.isFinite(Date.parse(input.measuredAt)) || Date.parse(input.measuredAt) > now + 5 * 60_000)) {
    throw new ApiError(422, "INVALID_READING", "measuredAt must be a valid timestamp no more than five minutes in the future.");
  }
  for (const item of input.measurements) {
    const definition = sensorMetrics[item.metric as keyof typeof sensorMetrics];
    if (!definition || !Number.isFinite(item.value) || item.unit !== definition.unit || item.value < definition.min || item.value > definition.max ||
      ("integer" in definition && !Number.isInteger(item.value))) {
      throw new ApiError(422, "INVALID_READING", "A measurement has an unsupported value or unit.");
    }
  }
}
