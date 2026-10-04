# Sensor quality

Check measuredAt and lastSeenAt against observedAt. Name the age of the actual
reading rather than presenting a fresh fetch as a fresh measurement. Missing
samples mean unknown, not zero. Preserve units and distinguish metrics with
different units. Flag stale or sparse measurements and anomalous jumps.

The development source is mock: say that recommendations use sample data when
appropriate. Distinguish sensor evidence, user reports, and hypotheses. Do not
infer healthy status solely from a lack of alerts. If evidence is insufficient,
leave overview urgency null and ask for an observation or new readings.
