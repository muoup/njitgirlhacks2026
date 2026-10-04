-- A sample's colour is one hex value in place of four raw channel counts.
SET LOCAL statement_timeout = '10min'; -- Converting a large table of samples takes a while.
ALTER TABLE grove.sensor_readings ADD COLUMN color text CHECK (color ~ '^#[0-9a-f]{6}$');

-- Stored samples: red, green and blue become shares of clear, as the monitor's sketch scales
-- them. A sample missing a channel, or with nothing on clear, keeps no colour. Either way its
-- four counts leave the measurements, and its account's insights are written again.
WITH channels AS (
  SELECT r.device_id, r.sample_id, r.measured_at,
    max((m->>'value')::numeric) FILTER (WHERE m->>'metric'='color_clear') AS clear,
    max((m->>'value')::numeric) FILTER (WHERE m->>'metric'='color_red') AS red,
    max((m->>'value')::numeric) FILTER (WHERE m->>'metric'='color_green') AS green,
    max((m->>'value')::numeric) FILTER (WHERE m->>'metric'='color_blue') AS blue
  FROM grove.sensor_readings r CROSS JOIN LATERAL jsonb_array_elements(r.measurements) AS m
  WHERE m->>'metric' IN ('color_clear','color_red','color_green','color_blue')
  GROUP BY r.device_id, r.sample_id, r.measured_at
), changed AS (
  UPDATE grove.sensor_readings r SET
    color = CASE WHEN c.clear > 0 AND c.red IS NOT NULL AND c.green IS NOT NULL AND c.blue IS NOT NULL THEN '#'
      || lpad(to_hex(least(255, floor(c.red * 256 / c.clear))::int), 2, '0')
      || lpad(to_hex(least(255, floor(c.green * 256 / c.clear))::int), 2, '0')
      || lpad(to_hex(least(255, floor(c.blue * 256 / c.clear))::int), 2, '0') END,
    measurements = COALESCE((SELECT jsonb_agg(kept.m ORDER BY kept.place)
      FROM jsonb_array_elements(r.measurements) WITH ORDINALITY AS kept(m, place)
      WHERE kept.m->>'metric' NOT IN ('color_clear','color_red','color_green','color_blue')), '[]'::jsonb)
  FROM channels c
  WHERE r.device_id=c.device_id AND r.sample_id=c.sample_id AND r.measured_at=c.measured_at
  RETURNING r.plant_id
)
UPDATE grove.agent_accounts a SET dirty=true, data_version=a.data_version+1
WHERE a.account_id IN (SELECT g.account_id FROM changed JOIN grove.plants p ON p.id=changed.plant_id
  JOIN grove.gardens g ON g.id=p.garden_id);
