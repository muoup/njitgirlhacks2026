# Grove BFF v0

A standalone Bun/Elysia server for frontend development. Better Auth owns browser
authentication. An injected backend adapter hydrates dashboard data; the default
adapter generates deterministic, account-scoped fixtures. No domain database,
SQLite, Arduino ingestion, cache policy, or Gemini scheduler is implemented.

## Run

```sh
cd server
bun install
cp .env.example .env
bun run dev
```

Defaults: frontend `http://localhost:3000`, BFF `http://localhost:3001`.

- Interactive OpenAPI docs: `http://localhost:3001/openapi`
- Live JSON specification: `http://localhost:3001/openapi/json`
- Checked-in specification: `openapi.json`; regenerate with `bun run openapi:generate`.
- Checks: `bun run typecheck` and `bun test`.

`FRONTEND_ORIGINS` accepts comma-separated, explicit origins. Configure
`BETTER_AUTH_URL` to the BFF origin and set `BETTER_AUTH_SECRET` to a high-entropy
value of at least 32 characters. Bun loads `.env` automatically.

## Authentication

The v0 uses Better Auth's **development-only in-memory adapter**. Signup, login,
session validation, and logout work, but accounts and sessions disappear when
the process restarts. By default, startup seeds `demo@grove.local` with password
`GroveDemo2026!`. Disable that account with `SEED_DEMO_ACCOUNT=false`.

For Google login, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register
`http://localhost:3001/api/auth/callback/google` as the local OAuth redirect URI.
Google login is unavailable until those credentials are configured. Email
verification and password-recovery delivery are outside this scaffold.

Use Better Auth's React client in the frontend:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ baseURL: "http://localhost:3001" });

await authClient.signIn.email({ email, password });
await authClient.signUp.email({ name, email, password });
await authClient.signIn.social({ provider: "google", callbackURL: "http://localhost:3000/dashboard" });
await authClient.signOut();
```

The frontend already uses Better Auth's React client. Its required
`BUN_PUBLIC_API_URL` setting selects this BFF's origin. For domain requests, send
`credentials: "include"`; do not store or manually forward the session token.
The BFF's auth records remain separate from backend domain data.

## Hydration contract

1. Read the signed-in account with `GET /api/v1/me`.
2. Fetch `GET /api/v1/gardens` and choose a returned garden ID.
3. Fetch `GET /api/v1/dashboard?gardenId=...` for that garden's plants, devices,
   latest readings, and existing insights.
4. Fetch graph history separately using
   `GET /api/v1/plants/:id/readings?from=<ISO timestamp>&to=<ISO timestamp>`.
   Ranges are inclusive and limited to seven days; fixture points are hourly.
5. Fetch existing insights with `GET /api/v1/gardens/:id/insights`.

Domain responses mark `meta.source` as `mock` and include `meta.hydratedAt`.
The mock adapter supplies three gardens and seven plants, with healthy plants,
a plant needing care, a plant without readings or assessed health, an unheard-
from device, and an empty garden. These fixtures live entirely in the BFF.

`Plant.status` is optional (`healthy` or `needs_care`); omission means unassessed.
Each insight has an explicit `needsFollowUp` boolean. Insights are plain text,
never generated markup. The empty garden returns `status: "unavailable"`,
`generatedAt: null`, and an empty item list. Sensor names and units are provisional.

Mock monitors report on UTC hour boundaries with a four-minute delay. Latest
readings and history share one value generator, so values at the same timestamp
agree across requests. Histories exclude samples that have not reported yet.
The adapter captures a trend reference time on startup and accepts an injectable
clock for tests. Mock insights are timestamped two hours before that reference;
their age does not trigger generation. The frontend imports response types from
`src/schemas.ts` with type-only imports.

Domain errors have shape `{ "error": { "code": "...", "message": "..." } }`.
Malformed schemas return 422, invalid time ranges 400, absent sessions 401, and
missing or inaccessible resources 404. Better Auth endpoints retain Better Auth's
native error format, which is included in the merged OpenAPI document.

## Backend and firmware protocol boundary

Implement `BackendAdapter` in `src/backend.ts` once the teammate's API exists,
then pass it to `createApp({ backend })`. Every adapter call receives a server-
derived `{ version: "v1", userId, accountId }`. For now the account ID equals the
Better Auth user ID. This is internal identity context, **not an auth token**.
The future backend must verify an agreed signed/service credential before
trusting identity and use the stable account ID to scope its data. Token claims,
signing keys, issuer, audience, expiry, and transport are TBD. Browser session
tokens are not assumed to be backend tokens.

The potting shed routes are authenticated placeholders. Valid requests return
501 `NOT_IMPLEMENTED` without changing fixtures or issuing keys. Resource routes
first check account ownership (missing or inaccessible IDs return 404); creation
bodies require nonblank names and species. The frontend shares these types from
`src/schemas.ts` and already handles 501 as waiting for the backend.

| Route | Request | Future success |
| --- | --- | --- |
| `POST /api/v1/gardens` | `{ name }` | 201 `{ garden }` |
| `DELETE /api/v1/gardens/:id` | — | 204, no body |
| `POST /api/v1/gardens/:id/plants` | `{ name, species }` | 201 `{ plant, apiKey }` |
| `DELETE /api/v1/plants/:id` | — | 204, no body |
| `GET /api/v1/plants/:id/api-keys` | — | 200 `{ apiKey }` |
| `POST /api/v1/plants/:id/api-keys` | — | 200 `{ apiKey }` |

The proposed `apiKey` shape is `{ key, createdAt }`, with an ISO timestamp. Key
responses use `Cache-Control: no-store`. The backend owns firmware key issuance,
storage, rotation, and upload authentication. Retrieving existing secrets is
provisional until the backend confirms its storage protocol. Replacement is
intended to invalidate the previous key; garden removal is intended to cascade
to plants, readings, and keys. None of these actions occur in this v0. Browser
CORS allows GET, POST, DELETE, and OPTIONS from the configured frontend origins.

For durable authentication, inject a supported Better Auth database adapter via
`createApp({ authDatabase, backend })`. No database technology has been selected.
The default entry point refuses production execution until real backend and auth
storage adapters have been configured. Demo seeding is disabled in production.

See `../docs/FRONTEND_HANDOFF.md` for the frontend agent handoff written before
implementation. Caching, Gemini scheduling, implementing resource mutations, and dynamic UI
generation remain later work.
