#!/usr/bin/env bash
set -euo pipefail

# Separate process groups let cleanup stop Bun and any children it starts.
set -m

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
frontend_pid=""
bff_pid=""
export NODE_ENV=production
export ALLOW_DEMO_IN_PRODUCTION=false

usage() {
  cat <<'EOF'
Usage: ./prod.sh [--demo]

Launch the frontend and BFF without hot reload. Each service loads its own .env.
--demo explicitly allows fixture data and in-memory auth on the deployed VM.
Accounts, sessions, memory, and insights in demo mode disappear on restart.

Optional: FRONTEND_PORT (default 80), BFF_PORT (otherwise server/.env PORT).
EOF
}

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 2
fi
case "${1:-}" in
  "") ;;
  --demo) export ALLOW_DEMO_IN_PRODUCTION=true; export DATABASE_URL="" ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required to launch the frontend and BFF." >&2
  exit 1
fi
frontend_port="${FRONTEND_PORT:-80}"

# A port below 1024 is refused unless the Bun binary has been allowed to bind it.
if ! refused="$(PORT="$frontend_port" bun -e 'try { Bun.serve({ port: Number(process.env.PORT), fetch: () => new Response() }).stop(true); }
  catch (error) { console.log(error.code ?? error.message); process.exit(1); }')"; then
  echo "The frontend cannot listen on port $frontend_port ($refused)." >&2
  if [[ "$refused" == EACCES ]]; then
    cat >&2 <<'HINT'
Allow Bun to bind ports below 1024, once and again after each Bun upgrade:
  sudo setcap cap_net_bind_service=+ep "$(readlink -f "$(command -v bun)")"
or choose another port: FRONTEND_PORT=3000 ./prod.sh
HINT
  fi
  exit 1
fi

# Validate environment settings before launching either service. Bun loads .env
# relative to each working directory; don't source credential files as shell code.
(
  cd "$project_dir/frontend"
  PORT="$frontend_port" bun src/lib/config.ts
)
(
  cd "$project_dir/server"
  if [[ -n "${BFF_PORT:-}" ]]; then export PORT="$BFF_PORT"; fi
  bun -e 'import { loadConfig } from "./src/config"; loadConfig();'
)

cleanup() {
  trap - EXIT INT TERM
  for pid in "$frontend_pid" "$bff_pid"; do
    if [[ -n "$pid" ]]; then
      kill -TERM -- "-$pid" 2>/dev/null || true
    fi
  done
  for pid in "$frontend_pid" "$bff_pid"; do
    if [[ -n "$pid" ]]; then
      wait "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ "$ALLOW_DEMO_IN_PRODUCTION" == true ]]; then
  echo "Demo deployment: fixture data and auth are ephemeral."
fi
echo "Starting frontend and BFF in production mode. Press Ctrl+C to stop both."

(
  cd "$project_dir/frontend"
  export PORT="$frontend_port"
  # Bun's HTML server bundles, minifies, and caches assets in production mode.
  exec bun run start
) &
frontend_pid=$!

(
  cd "$project_dir/server"
  if [[ -n "${BFF_PORT:-}" ]]; then export PORT="$BFF_PORT"; fi
  exec bun run start
) &
bff_pid=$!

# Stop the other server if either exits, preserving the first exit status.
exit_status=0
wait -n "$frontend_pid" "$bff_pid" || exit_status=$?
exit "$exit_status"
