CREATE TABLE grove.gardens (
  id text PRIMARY KEY, account_id text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gardens_account_idx ON grove.gardens(account_id);
CREATE TABLE grove.plants (
  id text PRIMARY KEY, garden_id text NOT NULL REFERENCES grove.gardens(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  species text NOT NULL CHECK (length(btrim(species)) BETWEEN 1 AND 200), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plants_garden_idx ON grove.plants(garden_id);
CREATE TABLE grove.devices (
  id text PRIMARY KEY, plant_id text NOT NULL UNIQUE REFERENCES grove.plants(id) ON DELETE CASCADE,
  name text NOT NULL, last_seen_at timestamptz
);
CREATE TABLE grove.device_keys (
  plant_id text PRIMARY KEY REFERENCES grove.plants(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE, encrypted_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE grove.sensor_readings (
  plant_id text NOT NULL REFERENCES grove.plants(id) ON DELETE CASCADE,
  device_id text NOT NULL REFERENCES grove.devices(id) ON DELETE CASCADE,
  sample_id text NOT NULL, measured_at timestamptz NOT NULL, received_at timestamptz NOT NULL,
  measurements jsonb NOT NULL CHECK (jsonb_typeof(measurements)='array'),
  PRIMARY KEY (device_id, sample_id, measured_at)
);
CREATE INDEX readings_plant_time_idx ON grove.sensor_readings(plant_id, measured_at DESC);
-- Regular table: uniqueness across all time partitions, including clockless retries.
CREATE TABLE grove.ingest_receipts (
  device_id text NOT NULL REFERENCES grove.devices(id) ON DELETE CASCADE,
  sample_id text NOT NULL, body_hash text NOT NULL, measured_at timestamptz NOT NULL, received_at timestamptz NOT NULL,
  PRIMARY KEY(device_id, sample_id)
);
CREATE TABLE grove.memories (
  account_id text PRIMARY KEY REFERENCES auth."user"(id) ON DELETE CASCADE,
  markdown text NOT NULL DEFAULT '' CHECK (length(markdown)<=16384), revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz
);
CREATE TABLE grove.agent_accounts (
  account_id text PRIMARY KEY REFERENCES auth."user"(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(), data_version integer NOT NULL DEFAULT 0,
  dirty boolean NOT NULL DEFAULT true, snapshot jsonb, last_attempt_at timestamptz, failure jsonb
);
CREATE TABLE grove.mutations (
  account_id text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  request_id text NOT NULL, body_hash text NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id, request_id)
);
