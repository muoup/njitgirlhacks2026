# bun-react-tailwind-shadcn-template

To install dependencies:

```bash
bun install
```

The frontend requires the BFF for authentication and dashboard data. Configure
its origin before starting a development server:

```bash
cp .env.example .env
bun dev
```

`BUN_PUBLIC_API_URL` must be an absolute HTTP(S) origin, such as
`http://localhost:3001`. Missing or invalid configuration fails startup and build.
Bun loads `frontend/.env` when launched from this directory. Restart the frontend
after changing the URL because it is embedded in the browser bundle.

To launch both servers from the repository root with an explicit setting:

```bash
BUN_PUBLIC_API_URL=http://localhost:3001 ./dev.sh
```

Without `DATABASE_URL`, the server seeds `demo@grove.local` / `GroveDemo2026!` in
development unless disabled and uses ephemeral auth/fixtures. With a database,
accounts, gardens, readings, memory, and insights are durable; new accounts start
empty. The frontend has no local sample-data or pretend-login path.

The dashboard loads gardens, then the selected garden's data. Plant history is
fetched separately. Response types are imported from `../server/src/schemas.ts`
using type-only imports, so server code is not included in the browser bundle.

Checks: `bun run typecheck` and `bun run build`. The build requires the same API
URL setting. OpenAPI docs are served by the BFF at `http://localhost:3001/openapi`.

The mentor page and dock share a real BFF conversation and account memory. Set
`GOOGLE_VERTEX_PROJECT` in `server/.env`, configure Google ADC, and restart the
server to enable replies. Missing
configuration is shown as an error; there is no stand-in reply path. Garden/plant
changes requested in chat appear as approval cards. They execute with database
storage; the mock adapter still returns `NOT_IMPLEMENTED` after approval.

Use **Refresh garden insights** in the conversation to force the BFF's scheduled
harness immediately. Generated overviews use the dashboard's existing renderer;
until generation succeeds it uses the initial BFF insight/plant fields. See
`../server/AGENT_PROTOCOL.md` for memory persistence and backend integration details.

To run for production:

```bash
bun start
```

To launch both services on a VM, use `./prod.sh` after completing
`server/TIGER_SETUP.md`, or `./prod.sh --demo` for the original fixture scaffold.
See [deployment instructions](../DEPLOYMENT.md). The frontend's production HTML
server automatically bundles and caches assets; `dist` is a separate static build.

This project was created using `bun init` in bun v1.4.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
