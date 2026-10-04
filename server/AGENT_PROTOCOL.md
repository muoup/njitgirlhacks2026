# Backend integration handoff

The BFF owns Better Auth, the Gemini harness, context assembly, tool permissions,
chat approvals, and insight generation. The teammate backend owns garden/plant
records, readings, firmware credentials, and persistent account memory. All calls
receive server-derived `BackendIdentity = { version: "v1", userId, accountId }`.
An agreed service credential must authenticate that identity; browser cookies are
not the backend protocol. No backend URLs or credentials have been selected.

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

Proposed HTTP equivalents, to be agreed: `GET /accounts/:accountId/memory` and
`PUT /accounts/:accountId/memory`. The backend verifies the authenticated account
scope on both. A missing document returns empty Markdown, revision 0, and null
updatedAt. Writes atomically compare expectedRevision, increment the revision,
and return the committed document. Conflicts return `MEMORY_CONFLICT` (409).
The BFF adapter labels real storage as source `backend`. The Markdown limit is
16,384 characters. There is no public BFF memory editing endpoint.

Until that service exists, MockBackend reads and stores documents in an account-
scoped map. It models compare-and-swap but is not durable. Its data is marked
`mock`. Both chat and scheduled runs may update memory. The memory skill guides
dated preferences, observations, care history, and open questions; it distinguishes
user statements from inferences and does not store credentials or approval grants.

## Garden/plant mutations

The adapter reserves `mutate(identity, action, requestId)` for four actions:

- `createGarden { name }` returns `{ garden }`.
- `createPlant { gardenId, name, species }` returns `{ plant, apiKey }`.
- `removeGarden { gardenId }` returns no body; removes associated records/keys.
- `removePlant { plantId }` returns no body; removes associated records/keys.

The backend must recheck ownership and atomically deduplicate requestId. Agent
requests use the pending action ID as their idempotency key. The BFF's in-process
decision replay handling is not a durable exactly-once guarantee. Key issuance and
revocation happen in the backend; no secret is included in model tool results or
conversation history. The development adapter always raises 501 NOT_IMPLEMENTED.

The BFF authenticates the user, records exact proposed arguments and a target
snapshot, and executes only after a popup decision from that account. Approvals
expire after ten minutes. Missing targets, changed snapshots, cancellation, and
expired proposals cannot execute. Chat can propose one change per reply; scheduled
and forced-refresh runs cannot propose or execute mutations. Direct potting shed
operations and approved agent operations share DomainService and the backend adapter.

## Insights and scheduling

The BFF currently caches validated account-wide generations in memory and decorates
the existing per-garden/dashboard responses. Generated plant overviews contain
urgency, headline, text, permitted readings/chart blocks, and evidence windows.
Generation metadata separates ready/stale/refreshing/failed/unavailable states
from the existing insight status, timestamps, and items. Sensor source stays
mock/backend independently of whether Gemini generated the prose.

The periodic worker only knows accounts encountered by this process in the last
24 hours. Future offline scheduling requires an authenticated backend method to
enumerate eligible account identities and durable job coordination. Persistent
insight/cache storage can be introduced behind a store adapter once agreed.
`POST /api/v1/insights/refresh` is already the authenticated manual entry point:
it forces all account gardens through the same scheduled harness and waits for
completion. It cannot grant mutation permissions.

Model tests inject AgentRunner; app construction and OpenAPI generation have no
scheduled or paid-model side effects. A live provider key is needed to exercise
Gemini. Server configuration fixes gemini-3.8-flash with medium thinking.
