# Connect Grove to Tiger Cloud

The server now owns authentication, garden/plant records, firmware keys, readings,
account memory, and saved insights. `PostgresBackend` uses PostgreSQL SQL and
works with Tiger Data/Tiger Cloud (TimescaleDB). No separate teammate HTTP API
or account-token exchange is needed for this deployment.

Domain/auth integration is tested against embedded PostgreSQL in the test suite.
The embedded engine is a development dependency used only for tests, never for
application storage. Your managed Tiger connection, TLS, TimescaleDB conversion,
and Google OAuth still need verification on your VM.

## 1. Create/select the database service

In Tiger Cloud, create or select a PostgreSQL service with TimescaleDB enabled.
Choose a region convenient to your Azure VM and copy its **PostgreSQL connection
details**: host, port, database, username, password, and TLS/CA settings. This is
not the Tiger console/management API key. See [Tiger Data docs](https://www.tigerdata.com/docs)
and the [service connection example](https://www.tigerdata.com/docs/learn/tutorials/create-services-with-terraform).

Use an empty database or one with no existing `auth`/`grove` schemas. The migrations
create those schemas; they never drop or replace existing tables. If those names
already belong to another application, stop and reconcile its schema first.

If you enable database IP restrictions, allow the Azure VM's outbound public IP.
Use the database service's port for outbound traffic; the firmware and browser
connect to Grove's HTTPS API, not the database.

## 2. Update the code and install dependencies on the VM

Get these changes onto the VM using your normal Git workflow, then from the repo:

```bash
(cd server && bun install --frozen-lockfile)
(cd frontend && bun install --frozen-lockfile)
```

## 3. Configure the server environment

Generate **two different** secrets:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Edit `server/.env` without overwriting your existing Google/Vertex settings:

```dotenv
DATABASE_URL=postgresql://DB_USER:URL_ENCODED_PASSWORD@DB_HOST:DB_PORT/DB_NAME?sslmode=verify-full
BETTER_AUTH_SECRET=FIRST_GENERATED_SECRET
DEVICE_API_KEY_ENCRYPTION_KEY=SECOND_GENERATED_SECRET
PORT=3001
BETTER_AUTH_URL=https://api.YOUR_DOMAIN
FRONTEND_ORIGINS=https://YOUR_DOMAIN
SEED_DEMO_ACCOUNT=false
```

Prefer the provider's copied URL, updating SSL mode to `verify-full`. Preserve
other connection parameters and URL-encode special characters in credentials.
If verification needs the provider CA, obtain it using its documented process
and add `&sslrootcert=/absolute/path/to/provider-ca.pem`. The `pg` driver honors
connection-string TLS parameters; do not substitute `rejectUnauthorized:false`.
See [node-postgres TLS configuration](https://node-postgres.com/features/ssl).

Keep both secrets stable across restarts and backed up outside Git. Changing
the encryption secret without re-encrypting stored keys makes existing keys
unreadable. The key hash still verifies ingestion, but owner retrieval fails
until credentials are rotated with the new encryption secret. Changing the auth
secret can invalidate sessions and OAuth state. New database-backed accounts
start empty; the previous in-memory demo accounts are not migrated.

`DATABASE_URL` selects real storage in both dev and production. Connection/schema
errors stop startup instead of falling back to mock data. Google Gemini credentials
remain as described in [VERTEX_SETUP.md](VERTEX_SETUP.md).

## 4. Create the tables and enable time partitioning

From `server/` on the VM:

```bash
bun run db:connect
bun run db:migrate
bun run db:check
bun run db:timescale
bun run db:check
```

Run each command separately and stop on failure. `db:connect` runs only `SELECT 1`
and prints `{"connected":true}`; it does not create tables or require migrations.
If it fails, resolve connection/authentication/TLS first. Database diagnostics
classify common uncoded driver errors (missing password, timeout, closed connection)
and show SQL/network codes without printing credentials or raw error messages.
If it passes but `db:migrate` fails, investigate migration/schema permissions
using the reported code. A copied service URL may omit the password; include it
and URL-encode special characters before setting `DATABASE_URL`.

`db:migrate` applies the checked-in auth/domain SQL once, in a transaction with a
migration lock. The database role needs permissions to create the `auth`/`grove`
schemas and tables. Migrations never run automatically on application startup.
After pulling a version that adds a migration, stop the server, run `bun run
db:migrate` again and start it: startup refuses a database that is behind.
`003_reading_color.sql` turns each stored sample's four colour channel counts
into one hex `color` and marks the affected accounts' insights stale.
`005_soil_scale.sql` follows the soil probe's measured scale (0 dry, 500 in
water): a stored soil count above 500, which only sample data on the old guessed
scale can be, moves to the count that shows the same percentage; counts of 500
or less are kept; every account's insights are marked stale.

`db:check` is read-only and prints `connected`, `schemaReady`, and the TimescaleDB
extension version. `db:timescale` explicitly converts `grove.sensor_readings` into
a time-partitioned hypertable. Run it **before uploading readings** and with the
server stopped; converting an existing populated table can take time/locks.
The uniqueness key includes measurement time; a separate normal receipt table
deduplicates sample IDs across partitions and clockless retries. Other tables,
especially Better Auth tables, remain ordinary PostgreSQL tables.

The application also works with ordinary PostgreSQL 14+ if you skip
`db:timescale`. Time partitioning is the only part requiring TimescaleDB.
Compression and retention policies are deliberately left for a later pass.

## 5. Configure browser URLs, HTTPS, and optional Google login

Set the public API origin in `frontend/.env`:

```dotenv
BUN_PUBLIC_API_URL=https://api.YOUR_DOMAIN
```

Configure your reverse proxy/TLS so those two domains reach frontend port 3000
and backend port 3001, and launch with `FRONTEND_PORT=3000 ./prod.sh` so the
frontend leaves port 80 to the proxy. Using frontend/API subdomains under the same domain keeps
browser session handling aligned with this configuration. `localhost` in a
remote user's browser would target their computer. No proxy or DNS configuration
is performed by the launcher.

Email/password signup works with the database and stable auth secret; Google is
optional. For Google sign-in, create a **Web application OAuth client** in Google
Cloud, configure its consent screen/audience, and set:

```dotenv
GOOGLE_CLIENT_ID=YOUR_OAUTH_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_OAUTH_CLIENT_SECRET
```

Register exactly `https://api.YOUR_DOMAIN/api/auth/callback/google` as an authorized
redirect URI. In testing, configure access for your presentation users as required
by the Google OAuth audience settings. These credentials are separate from the
Vertex ADC used for Gemini. See [Better Auth's Google setup](https://better-auth.com/docs/authentication/google)
and [Google OAuth setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
Email verification and password-reset delivery are not wired; enabling them needs
an email delivery provider and Better Auth callbacks.

## 6. Launch and provision a plant

From the repo root:

```bash
./prod.sh
```

Sign up, open the potting shed, create a garden, and add a plant. Each plant gets
one monitor/device and a credential. Show/copy the key into the firmware's private
configuration. Creating/rotating keys returns them only to an authenticated owner,
with `Cache-Control: no-store`; database storage holds a SHA-256 verification hash
and an AES-256-GCM encrypted recoverable key. The model never receives keys.

`./prod.sh --demo` explicitly ignores `DATABASE_URL` and runs the old ephemeral
fixture scaffold. It does not implement device uploads. Use plain `./prod.sh`
for the real database-backed deployment.

## 7. Implement the firmware HTTP request

The inspected branch is `origin/sensor_reading_prototype`, commit `cabe772`.
Its `sensorapp/src/main.cpp` polls about once a second and currently prints
readings to serial; it has no outbound HTTP request yet. See the full request,
metric mapping, retry rules, and cURL example in [FIRMWARE_API.md](FIRMWARE_API.md).

Use HTTPS `POST /api/v1/ingest/readings`, JSON, and
`Authorization: Bearer PLANT_API_KEY`. Generate a unique boot ID at startup and
append an increasing sample counter. On a retry, reuse both sample ID and body.
Omit `measuredAt` until the board has a synchronized UTC clock. Never invent zero
values for unavailable sensors. Validate the server TLS certificate using the
firmware HTTPS client's trust configuration.

## 8. Verify the complete flow

1. Open `/openapi` on the API host; inspect **submitSensorReading**.
2. Submit the documented sample with a real plant key; expect 201. Repeat it
   unchanged; expect 200 with `duplicate: true`.
3. Open the plant dashboard/history and confirm all submitted metrics, units,
   and monitor activity. Soil and light show on the 0-100 calibration
   in `src/metrics.ts`; storage keeps the raw counts.
4. Restart the server and confirm account login, gardens, key retrieval, readings,
   and previously generated insights still work.
5. Rotate the plant key and confirm the old key returns 401.
6. Run `cd server` then `bun run agent:check` under the same Linux user as the
   server. Use **Refresh garden insights** to exercise the real agent tools.
7. The worker runs every 30 minutes for accounts active in the past 24 hours,
   including accounts made active by firmware ingestion. It loads all their
   gardens and saves successful results. Uploading a reading never calls Gemini.

This v0 runs one backend process. Conversation history and pending approvals are
temporary; permanent mutations and retry receipts are durable. Multi-instance
agent scheduling/approval coordination remains future work. Raw readings and
receipt/idempotency records currently have no automatic expiration.

If a check fails, the terminal prints safe `BFF failure` diagnostics. DNS/timeouts
usually point to URL/network access; PostgreSQL 28P01 indicates database login,
42501 permissions, and 42P01/3F000 missing relations/schema. TLS failures need the
correct provider CA/hostname. No keys or database URLs are logged, and no request bodies
except the start of a device submission that was refused (`Ingest failure`).
