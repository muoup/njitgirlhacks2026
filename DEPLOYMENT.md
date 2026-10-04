# VM launcher

Install Bun and the dependencies once on the VM:

```bash
(cd frontend && bun install --frozen-lockfile)
(cd server && bun install --frozen-lockfile)
```

Configure `frontend/.env` and `server/.env` on the VM. The launcher changes into
each service's directory so Bun loads its own environment files. Google ADC
must be available to the Linux user running the launcher; see
[server/VERTEX_SETUP.md](server/VERTEX_SETUP.md).

The frontend's `BUN_PUBLIC_API_URL` must be the BFF URL reachable by the user's
browser. The BFF's `BETTER_AUTH_URL` must match that URL, and `FRONTEND_ORIGINS`
must include the frontend's public origin. `localhost` in a browser refers to
the user's computer, not the VM. For example, behind an HTTPS reverse proxy:

```dotenv
# frontend/.env
BUN_PUBLIC_API_URL=https://api.grove.example
```

```dotenv
# server/.env — keep your Google project and other existing settings too
PORT=3001
BETTER_AUTH_URL=https://api.grove.example
FRONTEND_ORIGINS=https://grove.example
BETTER_AUTH_SECRET=YOUR_GENERATED_SECRET
```

Generate a secret with `openssl rand -base64 32`; paste it into `server/.env`.
It remains required in both deployment modes.

For the current hackathon scaffold, run from the repository root:

```bash
./prod.sh --demo
```

This explicitly allows fixture data and in-memory authentication while keeping
`NODE_ENV=production`. Accounts, sessions, memory, conversations, and insights
disappear on restart. The usual demo account is seeded unless
`SEED_DEMO_ACCOUNT=false` is set. Garden/plant mutations remain unimplemented.

Once durable auth and a real backend adapter are wired into `server/src/index.ts`,
use `./prod.sh` without `--demo`. That mode retains the checks requiring those
adapters and disables demo seeding. The current entry point will refuse it.

The frontend listens on port 3000 by default; the BFF uses `server/.env`'s `PORT`
(default 3001). Override them independently if needed:

```bash
FRONTEND_PORT=8080 BFF_PORT=8081 ./prod.sh --demo
```

Both services run without hot reload. The frontend's existing Bun HTML server
bundles and minifies browser assets on first request and caches them until
restart; this launcher does not use `frontend/dist`. Restart after changing the
frontend API URL. See [Bun's production mode](https://bun.com/docs/bundler/fullstack#runtime-bundling).

Logs go to the terminal. Ctrl+C or SIGTERM stops both process groups; if either
service exits, the launcher stops the other and returns the first exit status.
Keep it in the foreground of a service manager such as systemd for automatic
startup and restart. It does not configure DNS, TLS, Azure firewall rules, or a
reverse proxy.
