import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { checkDatabase, migrate, migrationNames } from "../src/storage/database";
import { calibrate } from "../src/metrics";
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
    const soil = { metric: "soil_moisture_raw", value: 120, unit: "ADC" };
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
    // The soil migration that follows marks every account, so Alice's is marked twice.
    expect(accounts).toEqual([
      { account_id: "alice", dirty: true, data_version: 6 },
      { account_id: "bob", dirty: true, data_version: 5 },
    ]);
    await expect(pool.query("UPDATE grove.sensor_readings SET color='#3D8040'")).rejects.toThrow();
  } finally { await pool.end(); }
}, 30_000);

test("soil counts from the old guessed scale move to the measured one, and every account's insights go stale", async () => {
  const { pool } = await postgresFixture();
  try {
    // A database as it stood before the soil migration.
    await pool.query("CREATE SCHEMA grove");
    await pool.query("CREATE TABLE grove.migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const name of migrationNames.slice(0, migrationNames.indexOf("005_soil_scale.sql"))) {
      await pool.query(await sql(name));
      await pool.query("INSERT INTO grove.migrations(name) VALUES($1)", [name]);
    }
    await pool.query(`INSERT INTO auth."user"(id,name,email) VALUES('alice','Alice','alice@fixture.example'),('bob','Bob','bob@fixture.example')`);
    await pool.query("INSERT INTO grove.gardens(id,account_id,name) VALUES('bed','alice','Bed')");
    await pool.query("INSERT INTO grove.plants(id,garden_id,name,species) VALUES('fern','bed','Fern','Fern')");
    await pool.query("INSERT INTO grove.devices(id,plant_id,name) VALUES('fern-monitor','fern','Fern monitor')");
    await pool.query("INSERT INTO grove.agent_accounts(account_id,dirty,data_version) VALUES('alice',false,4),('bob',false,7)");
    const soil = (value: number) => ({ metric: "soil_moisture_raw", value, unit: "ADC" });
    const light = { metric: "light_level_raw", value: 810, unit: "ADC" };
    const warmth = { metric: "temperature", value: 23, unit: "°C" };
    // Each stored count, and the count it should hold afterwards.
    const counts: Array<[number, number]> = [[810, 45], [600, 280], [501, 390], [850, 0], [1023, 0], [500, 500], [430, 430], [120, 120], [0, 0]];
    for (const [before] of counts) {
      await pool.query(`INSERT INTO grove.sensor_readings(plant_id,device_id,sample_id,measured_at,received_at,measurements,color)
        VALUES('fern','fern-monitor',$1,now(),now(),$2,'#3d8040')`, [`soil-${before}`, JSON.stringify([light, soil(before), warmth])]);
    }
    await pool.query(`INSERT INTO grove.sensor_readings(plant_id,device_id,sample_id,measured_at,received_at,measurements)
      VALUES('fern','fern-monitor','no-soil',now(),now(),$1),('fern','fern-monitor','empty',now(),now(),'[]')`, [JSON.stringify([light, warmth])]);

    await migrate(pool);
    expect((await checkDatabase(pool)).schemaReady).toBe(true);
    const rows = (await pool.query("SELECT sample_id,color,measurements FROM grove.sensor_readings")).rows;
    const after = Object.fromEntries(rows.map(row => [row.sample_id, row.measurements]));
    // Only the soil count changes: a light count above 500 and the order of the measurements stay.
    for (const [before, count] of counts) expect(after[`soil-${before}`]).toEqual([light, soil(count), warmth]);
    expect(after["no-soil"]).toEqual([light, warmth]);
    expect(after.empty).toEqual([]);
    expect(rows.filter(row => row.sample_id.startsWith("soil-")).every(row => row.color === "#3d8040")).toBe(true);
    // A moved count shows the percentage it showed on the old scale: 850 dry, 400 wet.
    const shown = (measurement: unknown) => calibrate({ plantId: "fern", deviceId: "fern-monitor", measuredAt: "2026-10-04T12:00:00.000Z",
      measurements: [measurement as { metric: string; value: number; unit: string }] }).measurements[0]!.value;
    for (const before of [849, 810, 733, 600, 501]) {
      const old = Math.round(Math.min(1, Math.max(0, (before - 850) / (400 - 850))) * 100);
      await pool.query("UPDATE grove.sensor_readings SET measurements=$1 WHERE sample_id='empty'", [JSON.stringify([soil(before)])]);
      await pool.query(await sql("005_soil_scale.sql"));
      expect(shown((await pool.query("SELECT measurements FROM grove.sensor_readings WHERE sample_id='empty'")).rows[0].measurements[0])).toBe(old);
    }
    const accounts = (await pool.query("SELECT account_id,dirty,data_version FROM grove.agent_accounts ORDER BY account_id")).rows;
    expect(accounts).toEqual([
      { account_id: "alice", dirty: true, data_version: 10 },
      { account_id: "bob", dirty: true, data_version: 13 },
    ]);
  } finally { await pool.end(); }
}, 30_000);
