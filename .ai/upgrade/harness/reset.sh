#!/usr/bin/env bash
# Reset the upgrade database to a known state.
#
#   reset.sh init     drop + recreate + `yarn initialize`, then snapshot as the
#                     canonical reset point (SLOW: reindexes ~165 entities)
#   reset.sh restore  restore that snapshot (FAST) — this is what you use before
#                     every baseline/verify run
#
# The snapshot is taken AFTER `initialize` and BEFORE `seed.mjs`, so the tenant
# and organization uuids stay stable across every run. Re-running `initialize`
# instead would mint fresh uuids and invalidate previously recorded baselines.
set -euo pipefail

DB="${OM_UPGRADE_DB:-om_upgrade}"
CONTAINER="${OM_PG_CONTAINER:-mercato-postgres}"
SNAPSHOT_DIR=".ai/upgrade/baseline"
SNAPSHOT="$SNAPSHOT_DIR/db-init.dump"
MODE="${1:-restore}"

guard() {
  # Refuse to touch anything that is not the dedicated upgrade database.
  if [ "$DB" != "om_upgrade" ]; then
    echo "REFUSING: OM_UPGRADE_DB is '$DB', expected 'om_upgrade'." >&2
    echo "This script drops databases. Point it only at the throwaway upgrade DB." >&2
    exit 1
  fi
  if grep -qE "^DATABASE_URL=.*/${DB}\b" .env; then :; else
    echo "REFUSING: .env DATABASE_URL does not point at '$DB'." >&2
    grep -E '^DATABASE_URL=' .env >&2 || true
    exit 1
  fi
}

drop_create() {
  docker exec "$CONTAINER" psql -U postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB' AND pid<>pg_backend_pid();" >/dev/null
  docker exec "$CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS \"$DB\";" >/dev/null
  docker exec "$CONTAINER" psql -U postgres -c "CREATE DATABASE \"$DB\";" >/dev/null
}

guard

case "$MODE" in
  init)
    echo "[reset] dropping and recreating $DB"
    drop_create
    echo "[reset] running yarn initialize (slow)"
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack yarn initialize >/tmp/reset-init.log 2>&1 || {
      echo "[reset] initialize FAILED; tail:"; tail -30 /tmp/reset-init.log; exit 1; }
    mkdir -p "$SNAPSHOT_DIR"
    echo "[reset] snapshotting to $SNAPSHOT"
    docker exec "$CONTAINER" pg_dump -U postgres -Fc "$DB" > "$SNAPSHOT"
    echo "[reset] init snapshot ready ($(du -h "$SNAPSHOT" | cut -f1))"
    ;;
  restore)
    [ -f "$SNAPSHOT" ] || { echo "[reset] no snapshot at $SNAPSHOT — run 'reset.sh init' first" >&2; exit 1; }
    echo "[reset] restoring $DB from $SNAPSHOT"
    drop_create
    docker exec -i "$CONTAINER" pg_restore -U postgres -d "$DB" --no-owner --no-acl < "$SNAPSHOT" 2>/tmp/reset-restore.log || {
      # pg_restore warns noisily about extensions it cannot recreate; only fail on real errors
      if grep -qE "^pg_restore: error:" /tmp/reset-restore.log; then
        echo "[reset] restore FAILED:"; grep -E "^pg_restore: error:" /tmp/reset-restore.log | head -20; exit 1
      fi
    }
    echo "[reset] restored"
    ;;
  *)
    echo "usage: reset.sh [init|restore]" >&2; exit 1 ;;
esac
