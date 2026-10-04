-- The soil probe has been measured: its count is 0 in dry air and 500 in water, so a larger
-- count is wetter. Until now soil was shown on a guessed scale that ran the other way, from
-- 850 (dry) down to 400 (wet), and sample data was written to suit it.
SET LOCAL statement_timeout = '10min'; -- Converting a large table of samples takes a while.

-- A count above 500 cannot have come from the probe, so it is sample data on the guessed
-- scale: it moves to the count that shows the same percentage on the measured one. A count
-- of 500 or less is left as it is, since it is either the probe's own reading, which now
-- shows correctly, or sample data that was wet on the old scale and is wet on this one.
UPDATE grove.sensor_readings r SET measurements = (
  SELECT jsonb_agg(CASE
      WHEN m->>'metric'='soil_moisture_raw' AND m->>'unit'='ADC' AND (m->>'value')::numeric > 500
      THEN jsonb_set(m, '{value}', to_jsonb((5 * round(greatest(0, 850 - (m->>'value')::numeric) / 4.5))::int))
      ELSE m END ORDER BY place)
  FROM jsonb_array_elements(r.measurements) WITH ORDINALITY AS item(m, place))
WHERE jsonb_path_exists(r.measurements, '$[*] ? (@.metric == "soil_moisture_raw" && @.unit == "ADC" && @.value > 500)');

-- Every saved insight describes soil on the old scale, so each account's are written again.
UPDATE grove.agent_accounts SET dirty=true, data_version=data_version+1;
