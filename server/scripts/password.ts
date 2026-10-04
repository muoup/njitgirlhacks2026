import { loadConfig } from "../src/config";
import { createAuth, setPassword } from "../src/auth";
import { authDatabase, createPool } from "../src/storage/database";

// bun run auth:password you@example.com — asks for the new password, so it stays out of the
// shell's history. Works on the stored accounts only: fixture accounts live in a running server.
const email = process.argv[2];
const config = loadConfig();
if (!email) throw new Error("Use: bun run auth:password EMAIL");
if (!config.database) throw new Error("Set DATABASE_URL, BETTER_AUTH_SECRET, and DEVICE_API_KEY_ENCRYPTION_KEY in server/.env first.");
const pool = createPool(config.database);
try {
  const password = prompt(`New password for ${email}:`);
  if (!password) throw new Error("No password given; nothing was changed.");
  await setPassword(createAuth(config, authDatabase(pool)), email, password);
  console.log(`${email} now signs in with the new password.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally { await pool.end(); }
