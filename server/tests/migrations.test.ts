import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { checkDatabase, migrate } from "../src/storage/database";
import { postgresFixture } from "./postgres-fixture";

const sql = (name: string) => readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");

test("stored colour channels become one hex value, and their accounts' insights go stale", async () => {
  const { pool } = await postgresFixture();
  try {
    // A database as it stood before the colour migration, holding samples in the old shape.
    await pool.query("CREATE SCHEMA grove");
    await pool.query("CREATE TABLE grove.migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const name of ["001_auth.sql", "002_domain.sql"]) {
      await pool.query(await sql(name));
      await pool.query("INSERT INTO grove.migrations(name) VALUES($1)", [name]);
    }
    await expect(checkDatabase(pool)).rejects.toThrow("migrations are missing");
    await pool.query(`INSERT INTO auth."user"(id,name,email) VALUES('alice','Alice','alice@fixture.example'),('bob','Bob','bob@fixture.example')`);
    await pool.query("INSERT INTO grove.gardens(id,account_id,name) VALUES('bed','alice','Bed'),('sill','bob','Sill')");
    await pool.query("INSERT INTO grove.plants(id,garden_id,name,species) VALUES('fern','bed','Fern','Fern'),('aloe','sill','Aloe','Aloe')");
    await pool.query("INSERT INTO grove.devices(id,plant_id,name) VALUES('fern-monitor','fern','Fern monitor'),('aloe-monitor','aloe','Aloe monitor')");
    await pool.query("INSERT INTO grove.agent_accounts(account_id,dirty,data_version) VALUES('alice',false,4),('bob',false,4)");
    const soil = { metric: "soil_moisture_raw", value: 810, unit: "ADC" };
    const warmth = { metric: "temperature", value: 23, unit: "°C" };
    const count = (channel: string, value: number) => ({ metric: `color_${channel}`, value, unit: "count" });
    const stored: Array<[string, string, unknown[]]> = [
      ["fern-monitor", "whole", [soil, count("clear", 1000), count("red", 240), count("green", 500), count("blue", 250), warmth]],
      ["fern-monitor", "bright", [count("clear", 100), count("red", 5), count("green", 400), count("blue", 0)]],
      ["fern-monitor", "dark", [soil, count("clear", 0), count("red", 0), count("green", 0), count("blue", 0)]],
      ["fern-monitor", "partial", [soil, count("clear", 1000), count("red", 240)]],
      ["aloe-monitor", "plain", [soil, warmth]],
    ];
    for (const [device, sample, measurements] of stored) {
      await pool.query(`INSERT INTO grove.sensor_readings(plant_id,device_id,sample_id,measured_at,received_at,measurements)
        VALUES($1,$2,$3,now(),now(),$4)`, [device === "fern-monitor" ? "fern" : "aloe", device, sample, JSON.stringify(measurements)]);
    }

    await migrate(pool);
    expect((await checkDatabase(pool)).schemaReady).toBe(true);
    const rows = (await pool.query("SELECT sample_id,color,measurements FROM grove.sensor_readings")).rows;
    const after = Object.fromEntries(rows.map(row => [row.sample_id, { color: row.color, measurements: row.measurements }]));
    expect(after).toEqual({
      whole: { color: "#3d8040", measurements: [soil, warmth] },
      // A channel brighter than clear stops at ff, and a small one keeps its leading zero.
      bright: { color: "#0cff00", measurements: [] },
      dark: { color: null, measurements: [soil] },
      partial: { color: null, measurements: [soil] },
      plain: { color: null, measurements: [soil, warmth] },
    });
    const accounts = (await pool.query("SELECT account_id,dirty,data_version FROM grove.agent_accounts ORDER BY account_id")).rows;
    expect(accounts).toEqual([
      { account_id: "alice", dirty: true, data_version: 5 },
      { account_id: "bob", dirty: false, data_version: 4 },
    ]);
    await expect(pool.query("UPDATE grove.sensor_readings SET color='#3D8040'")).rejects.toThrow();
  } finally { await pool.end(); }
}, 30_000);
