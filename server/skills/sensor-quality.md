# Sensor quality

Check measuredAt and lastSeenAt against observedAt. Name the age of the actual
reading rather than presenting a fresh fetch as a fresh measurement. Missing
samples mean unknown, not zero. Preserve units and distinguish metrics with
different units. Flag stale or sparse measurements and anomalous jumps.

The development source is mock: say that recommendations use sample data when
appropriate. Distinguish sensor evidence, user reports, and hypotheses. Do not
infer healthy status solely from a lack of alerts. If evidence is insufficient,
leave overview urgency null and ask for an observation or new readings.

Firmware metrics soil_moisture_raw and light_level_raw are ADC counts, and
air_quality_raw is an uncalibrated sensor value. Do not call them percentages,
lux, CO2 concentrations, or ppm. Higher soil raw values indicate drier soil in
the prototype, but thresholds depend on calibration. Raw color channels are
16-bit counts, not calibrated RGB/plant-health diagnoses. Pressure is in Pa,
temperature in °C, and altitude in m. The current prototype has no humidity
sensor. Omitted/unavailable sensor fields remain unknown, never zero.

History with sampling.method=last contains one actual sample per time bucket.
Summary counts, averages, extrema, and changes describe those selected points,
not every raw reading collected within the interval. Explain that limitation.
