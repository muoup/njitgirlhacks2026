#!/usr/bin/env bash
set -euo pipefail

# Separate process groups let cleanup stop Bun and any children it starts.
set -m

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
frontend_pid=""
bff_pid=""

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required to launch the frontend and BFF." >&2
  exit 1
fi

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

echo "Starting frontend and BFF. Press Ctrl+C to stop both."

(
  cd "$project_dir/frontend"
  exec bun run dev
) &
frontend_pid=$!

(
  cd "$project_dir/server"
  exec bun run dev
) &
bff_pid=$!

# Stop the other server if either exits, preserving the first exit status.
exit_status=0
wait -n "$frontend_pid" "$bff_pid" || exit_status=$?
exit "$exit_status"
