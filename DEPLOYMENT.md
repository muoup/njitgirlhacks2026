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

For the database-backed deployment, complete [Tiger setup](server/TIGER_SETUP.md),
then run from the repository root:

```bash
./prod.sh
```

`DATABASE_URL` selects the PostgreSQL domain adapter and durable Better Auth
storage. Both secrets and applied migrations are required; startup refuses a
missing/unreachable schema. New real accounts start with empty gardens.

For the original hackathon fixtures, run:

```bash
./prod.sh --demo
```

This explicitly ignores `DATABASE_URL` and allows fixture data and in-memory authentication while keeping
`NODE_ENV=production`. Accounts, sessions, memory, conversations, and insights
disappear on restart. The usual demo account is seeded unless
`SEED_DEMO_ACCOUNT=false` is set. Garden/plant mutations remain unimplemented.

Plain `./prod.sh` keeps the real-storage checks and disables demo seeding.

The frontend listens on port 80, the standard HTTP port, so its address needs no
port; the BFF uses `server/.env`'s `PORT` (default 3001). Linux refuses ports
below 1024 to ordinary users, so allow the Bun binary to bind them, once and
again after each Bun upgrade:

```bash
sudo setcap cap_net_bind_service=+ep "$(readlink -f "$(command -v bun)")"
```

The launcher checks the port before starting anything and prints that command
when it is refused. Without a reverse proxy the settings then read as follows,
the frontend's origin carrying no port:

```dotenv
# frontend/.env
BUN_PUBLIC_API_URL=http://YOUR_VM_ADDRESS:3001
```

```dotenv
# server/.env
BETTER_AUTH_URL=http://YOUR_VM_ADDRESS:3001
FRONTEND_ORIGINS=http://YOUR_VM_ADDRESS
```

Ports 80 and 3001 must be open in the VM's firewall. Override either port if
needed, for instance behind a reverse proxy that takes port 80 itself:

```bash
FRONTEND_PORT=3000 BFF_PORT=8081 ./prod.sh --demo
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

Chat and forced insight refreshes can spend up to 60 seconds in Gemini. The BFF
allows 90 seconds of connection inactivity so it can return a reply or a JSON
timeout error. If you use a reverse proxy, set its response/read timeout to at
least 90 seconds as well (for example, `proxy_read_timeout 90s;` in Nginx).
