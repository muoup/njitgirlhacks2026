import { loadConfig } from "../src/config";
import { createPool, migrate, checkDatabase } from "../src/storage/database";
import { logFailure } from "../src/diagnostics";

const command = process.argv[2];
const config = loadConfig();
if (!config.database) throw new Error("Set DATABASE_URL, BETTER_AUTH_SECRET, and DEVICE_API_KEY_ENCRYPTION_KEY in server/.env first.");
const pool = createPool(config.database);
try {
  if (command === "migrate") await migrate(pool);
  else if (command === "check") console.log(JSON.stringify(await checkDatabase(pool)));
  else if (command === "timescale") {
    await checkDatabase(pool);
    if (!(await pool.query("SELECT 1 FROM pg_extension WHERE extname='timescaledb'")).rowCount) {
      throw new Error("TimescaleDB is not enabled on this database. Select a Tiger Cloud service with TimescaleDB.");
    }
    // Explicit command, never a startup mutation. Run before the first upload.
    await pool.query("SELECT create_hypertable('grove.sensor_readings', 'measured_at', if_not_exists => true, migrate_data => true)");
    console.log("grove.sensor_readings is a TimescaleDB hypertable.");
  } else throw new Error("Use migrate, check, or timescale.");
} catch (error) {
  logFailure(error, { scope: `database-${command}` });
  console.error(command === "timescale" ? "Check the selected database's TimescaleDB extension and table permissions."
    : "Check DATABASE_URL, TLS/CA settings, VM network access, and migration/schema permissions. See TIGER_SETUP.md.");
  process.exitCode = 1;
} finally { await pool.end(); }
