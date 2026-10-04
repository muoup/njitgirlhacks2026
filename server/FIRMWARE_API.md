# Firmware ingestion contract

Inspected `origin/sensor_reading_prototype` at `cabe772`. The current sketch uses
an Uno R4 WiFi and polls these values in `sensorapp/src/main.cpp`. HTTP remains
the firmware teammate's next step; this change does not alter that branch.

| Sketch value | API metric | Unit | Notes |
| --- | --- | --- | --- |
| `analogRead(A0)` | `soil_moisture_raw` | `ADC` | Raw soil reading; larger means wetter: 0 in dry air, about 500 in water |
| `aqs.getValue()` | `air_quality_raw` | `raw` | Uncalibrated air-quality value, not CO2/ppm |
| `analogRead(A2)` | `light_level_raw` | `ADC` | Raw light reading, not lux |
| `spl.readPressure()` | `pressure` | `Pa` | Pressure |
| `spl.readTemperature()` | `temperature` | `°C` | Air temperature |
| `spl.calcAltitude()` | `altitude` | `m` | Derived altitude, can be negative |

The colour sensor is not a metric. `tcs.getRawData(...)` is sent as one hex value
in the sample's `color` field, `#RRGGBB`, the value the sketch already prints:
red, green and blue each divided by clear, times 256, capped at 255 and written as
two hex digits (pad a single digit with a zero). Leave `color` out when clear is
zero or the sensor has no reading. Upper or lower case is accepted and stored in
lower case.

The prototype has no humidity sensor. Omit metrics from failed or unavailable
sensors. Any nonempty subset of the supported metrics is allowed, with or without
a colour.

## Request

```http
POST /api/v1/ingest/readings
Authorization: Bearer grove_device_...
Content-Type: application/json
```

```json
{
  "sampleId": "boot-7f3c:42",
  "color": "#3d8040",
  "measurements": [
    { "metric": "soil_moisture_raw", "value": 120, "unit": "ADC" },
    { "metric": "air_quality_raw", "value": 50, "unit": "raw" },
    { "metric": "light_level_raw", "value": 400, "unit": "ADC" },
    { "metric": "pressure", "value": 101325, "unit": "Pa" },
    { "metric": "temperature", "value": 23.4, "unit": "°C" },
    { "metric": "altitude", "value": 25, "unit": "m" }
  ]
}
```

Optional `measuredAt` is an ISO timestamp with timezone, such as
`2026-10-04T12:00:00Z`. Omit it when the board has no synchronized clock; the
first receipt time becomes measurement time. `receivedAt` is always server time.
Do not send `millis()` as an epoch timestamp. Old measurements are accepted;
measurements more than five minutes in the future are rejected.

`sampleId` must be 1–120 characters from `A-Z a-z 0-9 _ . : -`, unique across
boots for this device. Generate a new random boot ID after each restart and add
an increasing sample counter. Reuse the exact sample on retries. Rotating the
key keeps the same device/sample-ID namespace. Accounts/gardens/plants/devices
are resolved from the key; those IDs are not accepted in the request body.

## Responses and retries

New sample: 201. Identical retry: 200. Both return:

```json
{
  "accepted": true,
  "duplicate": false,
  "measuredAt": "2026-10-04T12:00:00.000Z",
  "receivedAt": "2026-10-04T12:00:00.000Z"
}
```

A retry returns `duplicate: true` and the original timestamps. JSON field order
and measurement order do not affect deduplication, nor does the case of the
colour. Reusing a sample ID with changed values or a changed colour returns 409
`SAMPLE_CONFLICT`.

- 401: missing/unknown/revoked key; obtain the current plant key.
- 400/422: malformed JSON, unsupported metric/unit/value, duplicate metric, a colour that is not `#RRGGBB`, or invalid time; fix the payload. The four `color_clear`/`color_red`/`color_green`/`color_blue` metrics are no longer accepted.
- 413: request body too large (server limit 16 KiB).
- 429: rate limit (120 requests/minute/key, including retries); respect `Retry-After`.
- 503: database ingestion isn't configured.
- Network/5xx: retry the same sample with bounded exponential backoff; never generate a new ID just because a response was lost.

Raw ADC and AQ values must be integers from 0 to 65535. Pressure is 0–200000 Pa, temperature -100–150 °C, and altitude
-2000–30000 m. These are input sanity limits, not plant-health thresholds.
NaN/Infinity and unknown fields are rejected. Each metric occurs at most once.

## Manual check

From your VM terminal, this prompts for a key without saving it in shell history:

```bash
read -rsp 'Plant API key: ' PLANT_API_KEY
echo
curl -i 'https://api.YOUR_DOMAIN/api/v1/ingest/readings' \
  -H "Authorization: Bearer $PLANT_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"sampleId":"manual-boot-1:1","measurements":[{"metric":"soil_moisture_raw","value":120,"unit":"ADC"}]}'
unset PLANT_API_KEY
```

Repeat with the same key/body to test deduplication. Firmware never needs a
Better Auth session, Google key, or database password. Ingestion stores data and
marks insights stale without invoking Gemini.

## Dashboard history

Full raw samples stay in `grove.sensor_readings`. The browser/agent history API
returns at most 361 actual samples: the last sample in each time bucket, minimum
bucket 60 seconds, with `sampling: { method: "last", bucketSeconds }`. For a
seven-day range the buckets are wider. The dashboard's latest reading is unsampled.
Agent summaries explicitly describe selected points, not all raw samples.

Storage keeps exactly what the firmware sent. On the way out, `src/metrics.ts`
turns each reading into what the dashboard and agent show: soil and light counts
become positions on a 0-100 calibration with a word (Dry, Damp, Bright), pressure
becomes hPa, and the other counts lose their unit. A sample's colour is returned
beside its measurements as the reading's `color`. Soil's end points in that file
are measured (0 in dry air, 500 in water); light's are placeholders until the
prototype's sensor is measured. The same file is the metric catalogue (label, tier, scale, healthy range) sent with the
dashboard as `metrics`.
