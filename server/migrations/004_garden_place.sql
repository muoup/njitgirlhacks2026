-- Where a garden is, for its weather forecast, and whether its plants stand in the weather.
-- A garden that has not said is taken to be indoors, where a forecast changes least.
ALTER TABLE grove.gardens
  ADD COLUMN setting text NOT NULL DEFAULT 'indoors' CHECK (setting IN ('indoors','outdoors')),
  ADD COLUMN place text CHECK (length(btrim(place)) BETWEEN 1 AND 200),
  ADD COLUMN latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  ADD COLUMN longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT gardens_place_whole CHECK ((place IS NULL) = (latitude IS NULL) AND (place IS NULL) = (longitude IS NULL));
