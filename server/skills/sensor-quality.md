# Sensor quality

Check measuredAt and lastSeenAt against observedAt. Name the age of the actual
reading rather than presenting a fresh fetch as a fresh measurement. Missing
samples mean unknown, not zero. Preserve units and distinguish metrics with
different units. Flag stale or sparse measurements and anomalous jumps.

The development source is mock: say that recommendations use sample data when
appropriate. Distinguish sensor evidence, user reports, and hypotheses. Do not
infer healthy status solely from a lack of alerts. If evidence is insufficient,
leave overview urgency null and ask for an observation or new readings.

Soil and light arrive already placed on the grove's 0-100 calibration, each with a
word such as Dry, Damp or Bright. The calibration is provisional: prefer the word to
the number, compare against the healthy range in the metric catalogue, and never
present either as volumetric water content or lux. Air quality is an uncalibrated
number and the colour channels are raw 16-bit counts: compare them only with the
same plant's own history, and never call them CO2 concentrations, ppm, calibrated
RGB or a plant-health diagnosis. Pressure is in hPa, temperature in °C, and
altitude in m. The current prototype has no humidity sensor. Omitted/unavailable
sensor fields remain unknown, never zero.

History with sampling.method=last contains one actual sample per time bucket.
Summary counts, averages, extrema, and changes describe those selected points,
not every raw reading collected within the interval. Explain that limitation.
