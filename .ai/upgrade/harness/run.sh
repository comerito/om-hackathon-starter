#!/usr/bin/env bash
# One full baseline cycle: reset -> boot -> seed -> sweep -> pages -> stop.
#
#   run.sh record            capture the golden baseline (writes *.json)
#   run.sh verify <suffix>   re-run and diff against the golden baseline
#
# Always starts from the post-`initialize` snapshot so the database state is
# identical every time. The app is booted by this script and killed on exit, so a
# stale dev server can never silently serve a different build.
set -euo pipefail

MODE="${1:-record}"
SUFFIX="${2:-verify}"
PORT="${PORT:-3006}"
HARNESS=".ai/upgrade/harness"
LOGDIR="/tmp/om-upgrade-harness"
mkdir -p "$LOGDIR"

DEV_PID=""
cleanup() {
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    echo "[run] stopping app (pid $DEV_PID)"
    kill "$DEV_PID" 2>/dev/null || true
    sleep 1
  fi
  lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

echo "[run] mode=$MODE"

# 1. reset database to the post-init snapshot
bash "$HARNESS/reset.sh" restore

# 2. boot the app
lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
echo "[run] booting app on :$PORT"
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack yarn dev >"$LOGDIR/dev.log" 2>&1 &
DEV_PID=$!

for _ in $(seq 1 120); do
  if grep -qE "Ready in|Application is ready" "$LOGDIR/dev.log" 2>/dev/null; then break; fi
  if ! kill -0 "$DEV_PID" 2>/dev/null; then echo "[run] app died during boot:"; tail -30 "$LOGDIR/dev.log"; exit 1; fi
  sleep 1
done
if ! curl -sf -o /dev/null "http://localhost:$PORT/"; then
  echo "[run] app not answering on :$PORT"; tail -30 "$LOGDIR/dev.log"; exit 1
fi
echo "[run] app ready"

# Guard: background mutation must be off or two runs cannot be compared.
if grep -qi "scheduler.*started\|Polling engine started" "$LOGDIR/dev.log"; then
  echo "[run] REFUSING: scheduler is running; set AUTO_SPAWN_SCHEDULER=false in .env" >&2
  exit 1
fi

rc=0
if [ "$MODE" = "record" ]; then
  echo "[run] === seed (write baseline) ==="
  node "$HARNESS/seed.mjs" --out api-writes.json 2>&1 | tee "$LOGDIR/seed.log" | tail -5
  echo "[run] === sweep (read baseline) ==="
  node "$HARNESS/sweep.mjs" --out api-reads.json 2>&1 | tee "$LOGDIR/sweep.log" | tail -5
  echo "[run] === pages ==="
  node "$HARNESS/pages.mjs" --out pages.json 2>&1 | tee "$LOGDIR/pages.log" | tail -5
  echo "[run] baseline recorded"
else
  echo "[run] === seed (verify) ==="
  node "$HARNESS/seed.mjs"  --out "api-writes-$SUFFIX.json" --compare api-writes.json 2>&1 | tee "$LOGDIR/seed-$SUFFIX.log" | tail -20 || rc=1
  echo "[run] === sweep (verify) ==="
  node "$HARNESS/sweep.mjs" --out "api-reads-$SUFFIX.json"  --compare api-reads.json  2>&1 | tee "$LOGDIR/sweep-$SUFFIX.log" | tail -20 || rc=1
  echo "[run] === pages (verify) ==="
  node "$HARNESS/pages.mjs" --out "pages-$SUFFIX.json"      --compare pages.json      2>&1 | tee "$LOGDIR/pages-$SUFFIX.log" | tail -20 || rc=1
  if [ "$rc" = "0" ]; then echo "[run] VERIFY CLEAN — zero deltas"; else echo "[run] VERIFY FOUND DELTAS (see *-deltas.json)"; fi
fi

exit $rc
