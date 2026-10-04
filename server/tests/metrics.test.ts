import { expect, test } from "bun:test";
import { calibrate, metricCatalogue } from "../src/metrics";
import { sensorMetrics } from "../src/ingestion";

const reading = (measurements: Array<{ metric: string; value: number; unit: string }>) =>
  calibrate({ plantId: "plant", deviceId: "device", measuredAt: "2026-10-04T12:00:00.000Z", measurements }).measurements;

test("stored counts are shown on their calibration, with a word where the metric has one", () => {
  expect(reading([
    { metric: "soil_moisture_raw", value: 810, unit: "ADC" },
    { metric: "soil_moisture_raw", value: 2000, unit: "ADC" },
    { metric: "soil_moisture_raw", value: 600, unit: "ADC" },
    { metric: "light_level_raw", value: 400, unit: "ADC" },
    { metric: "pressure", value: 101325, unit: "Pa" },
    { metric: "air_quality_raw", value: 50, unit: "raw" },
    { metric: "temperature", value: 23.4, unit: "°C" },
  ])).toEqual([
    { metric: "soil_moisture_raw", value: 9, unit: "%", word: "Dry" },
    { metric: "soil_moisture_raw", value: 0, unit: "%", word: "Dry" },
    { metric: "soil_moisture_raw", value: 56, unit: "%", word: "Damp" },
    { metric: "light_level_raw", value: 39, unit: "%", word: "Dim" },
    { metric: "pressure", value: 1013.3, unit: "hPa" },
    { metric: "air_quality_raw", value: 50, unit: "" },
    { metric: "temperature", value: 23.4, unit: "°C", word: "Mild" },
  ]);
});

test("calibrating twice changes nothing, and unknown metrics pass through", () => {
  const once = reading([{ metric: "soil_moisture_raw", value: 810, unit: "ADC" }, { metric: "sap_flow", value: 3, unit: "ml" }]);
  expect(reading(once)).toEqual(once);
  expect(once[1]).toEqual({ metric: "sap_flow", value: 3, unit: "ml" });
});

test("the catalogue covers every metric the firmware may send", () => {
  const known = new Set(metricCatalogue.map(info => info.metric));
  for (const metric of Object.keys(sensorMetrics)) expect(known.has(metric)).toBe(true);
});
