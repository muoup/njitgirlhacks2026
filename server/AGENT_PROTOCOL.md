# Backend integration handoff

The server owns Better Auth, the Gemini harness, context assembly, tool permissions,
chat approvals, and insight generation. `PostgresBackend` stores garden/plant
records, readings, firmware credentials, and account memory directly in Tiger
Cloud/PostgreSQL. All calls receive server-derived
`BackendIdentity = { version: "v1", userId, accountId }`; accountId equals the
Better Auth user ID, not the OAuth provider's account ID. No separate backend
token protocol is needed while the adapter runs inside this server process.
See [TIGER_SETUP.md](TIGER_SETUP.md) and [FIRMWARE_API.md](FIRMWARE_API.md).

## MEMORY.md

MEMORY.md is one logical Markdown document per account, not a local filesystem
path. The adapter exposes:

```ts
readMemory(identity): Promise<{
  markdown: string;
  revision: number;
  updatedAt: string | null;
  source: "mock" | "backend";
}>

writeMemory(identity, {
  markdown: string;
  expectedRevision: number;
}): Promise<MemoryDocument>
```

There is no public memory editing endpoint. A missing document returns empty Markdown, revision 0, and null
updatedAt. Writes atomically compare expectedRevision, increment the revision,
and return the committed document. Conflicts return `MEMORY_CONFLICT` (409).
The BFF adapter labels real storage as source `backend`. The Markdown limit is
16,384 characters. There is no public BFF memory editing endpoint.

With no database configured, MockBackend reads and stores documents in an account-
scoped map. It models compare-and-swap but is not durable. Its data is marked
`mock`. Both chat and scheduled runs may update memory. The memory skill guides
dated preferences, observations, care history, and open questions; it distinguishes
user statements from inferences and does not store credentials or approval grants.

## Garden/plant mutations

The adapter implements `mutate(identity, action, requestId, expectedFingerprint?)` for four actions:

- `createGarden { name }` returns `{ garden }`.
- `createPlant { gardenId, name, species }` returns `{ plant, apiKey }`.
- `removeGarden { gardenId }` returns no body; removes associated records/keys.
- `removePlant { plantId }` returns no body; removes associated records/keys.

PostgreSQL rechecks ownership and atomically deduplicates requestId. Agent
requests use the pending action ID as their idempotency key. The BFF's in-process
decision replay handling is not a durable exactly-once guarantee. Key issuance and
revocation happen in the backend; no secret is included in model tool results or
conversation history. Retry-ledger keys are encrypted too. Approval fingerprints
are rechecked inside the mutation transaction. The development mock adapter
always raises 501 NOT_IMPLEMENTED. Browser mutation endpoints also accept an
optional `Idempotency-Key` header (1–120 letters/digits, `_ . : -`).

The BFF authenticates the user, records exact proposed arguments and a target
snapshot, and executes only after a popup decision from that account. Approvals
expire after ten minutes. Missing targets, changed snapshots, cancellation, and
expired proposals cannot execute. Chat can propose one change per reply; scheduled
and forced-refresh runs cannot propose or execute mutations. Direct potting shed
operations and approved agent operations share DomainService and the backend adapter.

## Insights and scheduling

The server caches validated account-wide generations in memory and, with database
storage, saves them in `grove.agent_accounts`. Generated plant overviews contain
urgency, headline, text, evidence windows, and up to three blocks from the kit in
`src/agent/blocks.ts`: `readings`, `chart` (with up to two marked moments),
`meter`, `stat`, `steps` and `weather` (one day of the garden's forecast, by its
date). A block only chooses what to show; the page takes
every value from the plant's readings and every scale and healthy range from the
metric catalogue (`GET /api/v1/metrics`, also in the dashboard response). A garden
may carry up to two blocks of its own, each naming a plant, and a `layout`: the
order of its stops. A chat reply may carry up to two blocks, with the names of
the plants they are about.
Generation metadata separates ready/stale/refreshing/failed/unavailable states
from the existing insight status, timestamps, and items. Sensor source stays
mock/backend independently of whether Gemini generated the prose.

Generated prose is checked before it is published (`src/agent/writing.ts`):
headlines up to 60 characters, notes up to 280, and no dates, clock times, raw
counts, metric identifiers, IDs or Markdown. Output that fails this or the
structural checks is returned to the model once with what was wrong; a second
failure fails the refresh and keeps the previous insights. Blocks and layouts
are held to a different rule: the model writes them in a flat, loosely bounded
shape, and one that cannot be drawn (an unknown plant, a metric the plant has not
reported, a mark outside the chart, a step that is not plain words) is dropped on
its own, as is a weather block for a day that is not in the garden's forecast. A
layout is published only if every plant has exactly one place and the
plants that call for someone lead it, each as its own stop; otherwise the page
orders the stops itself, as it does when plants have changed since. Readings reach the
model already calibrated, with the metric catalogue from `src/metrics.ts`.
A scheduled run is given every skill in its instructions and has five steps;
chat loads skills on demand and has eight. The last step of either cannot call
a tool, so a run always ends with an answer. Chat thinks at Gemini's medium
level; a scheduled run at low, where it writes the same insights in a quarter
of the time instead of thinking through its output allowance.

With PostgreSQL, the worker rediscovers accounts active in the last 24 hours from
the database. Browser requests and device ingestion record activity. Uploads,
resource changes, and memory updates mark insights dirty; successful refreshes
save context revision, output, and freshness state. A data version prevents a
refresh from marking newer ingested data as fresh. Failures preserve the last
successful output and are retried after restart. Mock scheduling remains in memory.
Run one server process: multi-instance worker coordination and persistent approvals
are not implemented. Conversations and pending approvals expire in memory.
`POST /api/v1/insights/refresh` is already the authenticated manual entry point:
it forces all account gardens through the same scheduled harness and waits for
completion. It cannot grant mutation permissions.

Model tests inject AgentRunner; app construction and OpenAPI generation have no
scheduled or paid-model side effects. A Cloud project with Vertex AI access and
Google Application Default Credentials is needed to exercise Gemini. The harness
uses the project-scoped Vertex AI provider, not the AI Studio Developer API.
Server configuration fixes gemini-3.8-flash with medium thinking. Setup and a
manual access check are documented in [VERTEX_SETUP.md](VERTEX_SETUP.md).

## Weather

A garden may say where it is (`PATCH /api/v1/gardens/:id` with a `location` found
through `GET /api/v1/places?query=`) and whether it stands `indoors` or `outdoors`.
A garden with a location gets a seven-day `forecast` in its dashboard response
and in the agent's context: sky, high and low in °C, rain in mm and its chance,
hours of sunshine, the strongest gust, and `alerts` for the lines a day crosses
(`src/weather.ts`: frost, heat, rain, downpour, storm, wind, dull). The lines are
fixed in code, so a warning never rests on the model's reading of the numbers.

A scheduled run mentions the forecast only as a warning: when a day's alert
matters to a plant in its garden's setting it adds a sentence, raises ok to watch
at most, and may attach that day's `weather` block. A garden with a forecast
always has one `weather` stop in its layout, just ahead of the garden's notes
when the model gives it no place. Chat has the same forecast and may talk about
it freely, but draws none of it.

Forecasts and town search come from Open-Meteo, which needs no key. The only
thing sent there is the town's coordinates, kept to two decimal places. A
forecast is kept for an hour, and a garden simply has none when the service
cannot be reached. A forecast that fails is not asked for again for five
minutes, since the dashboard fetches its data every 15 seconds. Open-Meteo's data is CC BY 4.0 and its free service is for
non-commercial use; the weather stop credits it.
