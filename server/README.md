# Grove server

Bun/Elysia application backend with Better Auth browser sessions, Tiger Cloud /
PostgreSQL storage, plant API-key sensor ingestion, and Gemini chat/scheduled
insights. Without database configuration, development still uses the original
account-scoped fixtures and in-memory auth.

## Run

```bash
cd server
bun install --frozen-lockfile
# Edit .env using .env.example; keep existing secrets/settings.
bun run dev
```

For the real VM deployment, follow [TIGER_SETUP.md](TIGER_SETUP.md), then run
`./prod.sh` from the repo root. `./prod.sh --demo` explicitly ignores DATABASE_URL
and uses fixtures. Each service loads its own environment files, not root .env.

Defaults: frontend http://localhost:3000, server http://localhost:3001.

- Interactive docs: `/openapi`.
- Live OpenAPI JSON: `/openapi/json`.
- Generate a local specification: `bun run openapi:generate` (no DB/model calls).
- Checks: `bun run typecheck`, `bun test`.
- Database setup: `bun run db:migrate`, `bun run db:check`, `bun run db:timescale`.
- Forgotten password: `bun run auth:password EMAIL` asks for a new one and stores it.

## Storage and authentication

DATABASE_URL selects `PostgresBackend` and Better Auth's PostgreSQL adapter using
one pool. Migrations isolate Better Auth tables in `auth` and application tables
in `grove`. Startup validates connectivity/schema; migrations run only when
explicitly invoked. PostgreSQL 14+ works; the manual TimescaleDB conversion makes
sensor_readings a hypertable. No local production database or MEMORY.md files
are used. New database accounts start with no gardens or plants.

BETTER_AUTH_SECRET must be stable and at least 32 characters. Database mode also
requires DEVICE_API_KEY_ENCRYPTION_KEY: 32 independent random bytes in base64.
Database URLs and firmware keys never reach the agent. Garden/plant ownership is
scoped by the Better Auth user ID in SQL; the identity comes from the session.

Set BETTER_AUTH_URL to the public API origin and FRONTEND_ORIGINS to explicit
comma-separated frontend origins. Use HTTPS and frontend/API origins under the
same domain for the current cookie setup. The frontend uses Better Auth's React
client and sends credentials with domain requests. BUN_PUBLIC_API_URL is required
in frontend/.env and is bundled into browser assets.

Google sign-in is optional and uses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET for a
Web application OAuth client. Register the public API's
`/api/auth/callback/google` URL. Gemini credentials are separate. Email/password
signup/login works without Google. Verification/password-reset email delivery is
not configured. A forgotten password is replaced from the server instead, with
`bun run auth:password EMAIL`: it needs `server/.env`, so only whoever runs the
server can use it. An account made with Google gains a password this way.

In fixture mode, auth/accounts/sessions disappear on restart. Development seeds
`demo@grove.local` / `GroveDemo2026!` unless SEED_DEMO_ACCOUNT=false. The public demo
is never seeded in database mode or ordinary production.

## Browser API

| Route | Behavior |
| --- | --- |
| GET /api/v1/me | Current user/account |
| GET /api/v1/gardens | Account gardens with plant/device counts |
| POST /api/v1/gardens | Create `{ name }`, returns 201 `{ garden }` |
| DELETE /api/v1/gardens/:id | Delete garden, plants, devices, readings, keys; 204 |
| POST /api/v1/gardens/:id/plants | Create `{ name, species }`, device and key; 201 `{ plant, apiKey }` |
| PATCH /api/v1/plants/:id | Change name and/or species; readings and key are kept; 200 |
| DELETE /api/v1/plants/:id | Delete plant/device/readings/key; 204 |
| GET /api/v1/dashboard?gardenId=... | Garden, plants/devices, latest samples, insights |
| GET /api/v1/plants/:id/readings?from=...&to=... | Inclusive ISO range, at most 7 days |
| GET /api/v1/gardens/:id/insights | Saved insight output and generation metadata |
| GET /api/v1/plants/:id/api-keys | Owner-only retrieval of recoverable encrypted key |
| POST /api/v1/plants/:id/api-keys | Rotate key; old credential stops working |

Browser routes require a session. Unknown/inaccessible resources return 404.
Resource mutations check request origin. Creation/deletion optionally accept
Idempotency-Key; account-scoped database transactions persist replay results and
reject reuse for different arguments. Secret responses use Cache-Control:no-store.
The mock adapter still returns 501 for resource/key changes.

Stored readings keep the firmware's measurement array and units; responses show
them calibrated (see `src/metrics.ts` and the Dashboard history section of
FIRMWARE_API.md).
Latest samples are unsampled. History selects at most 361 actual samples, the
last per time bucket (at least 60 seconds), and includes optional sampling
metadata. Full raw samples remain stored. Plants have no assessed status until
there is evidence; sample receipt is not a health diagnosis.

## Arduino API

`POST /api/v1/ingest/readings` accepts a plant API key in Authorization:Bearer,
without browser cookies. Keys scope uploads to their plant/device/account; body
IDs cannot redirect data. One sample per request, stable sampleId for retries,
optional measuredAt, and a bounded measurements array. New samples return 201;
identical retries 200; changed payloads with the same ID 409. Rotation/deletion
revokes credentials. Uploads store samples/device activity and dirty insights
without calling Gemini.

Supported metrics match origin/sensor_reading_prototype at cabe772: raw soil,
air-quality, light, pressure, temperature and altitude, plus one hex `color`.
See [FIRMWARE_API.md](FIRMWARE_API.md) for exact units, payloads, limits, and retries.
Bodies are limited to 16 KiB and ingestion to 120 requests/minute/key/process.

## Garden mentor

Set GOOGLE_VERTEX_PROJECT and Google Application Default Credentials; location
defaults to global. The model stays gemini-3.8-flash with medium thinking through
the Vertex AI provider. GEMINI_API_KEY / GOOGLE_VERTEX_API_KEY are ignored. See
[VERTEX_SETUP.md](VERTEX_SETUP.md); `bun run agent:check` makes one small billable
request to verify credentials. Tests and OpenAPI generation do not call Google.

| Route | Behavior |
| --- | --- |
| POST /api/v1/chat | `{message,persona,requestId,conversationId?}`; shared account context |
| POST /api/v1/chat/actions/:id/decision | Approve/cancel one exact proposed action |
| POST /api/v1/insights/refresh | Force restricted account-wide generation immediately |

All require sessions and origin checks. Agent context includes all gardens,
latest readings, bounded 7-day history summaries, and revisioned account memory.
Skills guide prescriptions. Chat can propose additions/removals; only explicit
user approval executes them. Cron/forced refresh can update memory/insights but
cannot mutate garden/plant resources. Keys never enter tool results or chat.

The worker runs every 30 minutes. Database mode rediscovers accounts active in
the last 24 hours, including firmware activity; successful insights and failure
metadata survive restart. A refresh skips unchanged fresh input, while forced
refresh always runs. New readings/resources/memory dirty results; concurrent data
changes remain stale even if generation succeeds. Saved insights survive errors.

Conversations, approvals, and concurrency controls remain process-local. Run one
backend instance. Loops keep their existing 8-step/32-tool/60-second limits and
at most 4 concurrent accounts. Retention/compression and multi-instance scheduling
are future work. See [AGENT_PROTOCOL.md](AGENT_PROTOCOL.md).

## Failure diagnostics

Server/provider/cron failures print safe BFF failure traces to stderr: codes,
HTTP status, safe Google reasons, and stack frames. Messages, request/response
bodies, database URLs, credential headers, API keys, and chat/memory are excluded.
Browser errors retain documented `{ error: { code, message } }` shapes; Better
Auth routes retain Better Auth's native error format.
