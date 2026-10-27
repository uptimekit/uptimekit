#!/bin/sh
set -eu

export PATH="/usr/lib/postgresql/15/bin:$PATH"

# A fresh secret per container: the demo data is disposable, so sessions
# only need to outlive the process, and the image never ships a known secret.
if [ -z "${APP_SECRET:-}" ]; then
    APP_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
    export APP_SECRET
fi

LIVE_DB="$PGDATABASE"
NEXT_DB="${PGDATABASE}_next"
OLD_DB="${PGDATABASE}_old"
RESET_MINUTES="${DEMO_RESET_MINUTES:-30}"

log() {
    echo ">>> [$(date -u +%H:%M:%S)] $*"
}

# Local socket auth is "trust", so root can act as the postgres superuser.
sql() {
    db="$1"
    shift
    psql -v ON_ERROR_STOP=1 -qAt -h /run/postgresql -U postgres -d "$db" "$@"
}

# ---- PostgreSQL (listens on localhost only) ----
mkdir -p "$PGDATA" /run/postgresql
chown postgres:postgres "$PGDATA" /run/postgresql
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    log "Initializing PostgreSQL data directory..."
    su postgres -c "initdb -D '$PGDATA' --auth-host=scram-sha-256 --auth-local=trust" >/dev/null
    {
        echo "shared_preload_libraries = 'timescaledb'"
        echo "timescaledb.telemetry_level = off"
        # The image strips the LLVM runtime to save space.
        echo "jit = off"
    } >> "$PGDATA/postgresql.conf"
fi

log "Starting PostgreSQL..."
su postgres -c "pg_ctl -D '$PGDATA' -l /tmp/pg.log -w start" >/dev/null
if [ -z "$(sql postgres -c "SELECT 1 FROM pg_roles WHERE rolname = '$PGUSER'")" ]; then
    sql postgres -c "CREATE ROLE $PGUSER LOGIN PASSWORD '$PGPASSWORD';"
fi

# Recreate, migrate and seed a database without touching the one being served.
build_database() {
    db="$1"
    url="postgres://$PGUSER:$PGPASSWORD@localhost:5432/$db"
    sql postgres -c "DROP DATABASE IF EXISTS $db WITH (FORCE);" \
        -c "CREATE DATABASE $db OWNER $PGUSER;" &&
        sql "$db" -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" &&
        DATABASE_URL="$url" node migrate/migrate.mjs &&
        DATABASE_URL="$url" node seed/seed.mjs
}

# Blocking new connections first makes the rename race-free: neither the app
# nor the TimescaleDB scheduler can reconnect between terminate and rename.
# Connections are re-opened on the app's next query, so visitors only see
# the swap as a single slow request.
swap_in_next_database() {
    sql postgres -c "ALTER DATABASE $LIVE_DB WITH ALLOW_CONNECTIONS false;" \
        -c "ALTER DATABASE $NEXT_DB WITH ALLOW_CONNECTIONS false;" || return 1

    attempts=0
    while [ "$(sql postgres -c "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE datname IN ('$LIVE_DB', '$NEXT_DB');")" != "0" ]; do
        attempts=$((attempts + 1))
        [ "$attempts" -lt 50 ] || return 1
        sleep 0.2
    done

    sql postgres -c "DROP DATABASE IF EXISTS $OLD_DB WITH (FORCE);" \
        -c "ALTER DATABASE $LIVE_DB RENAME TO $OLD_DB;" \
        -c "ALTER DATABASE $NEXT_DB RENAME TO $LIVE_DB;" \
        -c "ALTER DATABASE $LIVE_DB WITH ALLOW_CONNECTIONS true;" \
        -c "DROP DATABASE $OLD_DB WITH (FORCE);"
}

# Best effort: whatever step failed, leave a connectable live database behind.
restore_live_database() {
    if [ -z "$(sql postgres -c "SELECT 1 FROM pg_database WHERE datname = '$LIVE_DB'")" ]; then
        sql postgres -c "ALTER DATABASE $OLD_DB RENAME TO $LIVE_DB;" || true
    fi
    sql postgres -c "ALTER DATABASE $LIVE_DB WITH ALLOW_CONNECTIONS true;" || true
    sql postgres -c "DROP DATABASE IF EXISTS $NEXT_DB WITH (FORCE);" || true
}

reset_demo() {
    log "Building fresh demo data while the current data keeps serving..."
    if ! build_database "$NEXT_DB" >/tmp/reset.log 2>&1; then
        cat /tmp/reset.log
        log "Reset failed; keeping the current data until the next cycle."
        restore_live_database
        return 0
    fi
    if ! swap_in_next_database; then
        log "Swap failed; keeping the current data until the next cycle."
        restore_live_database
        return 0
    fi
    log "Demo data reset."
}

log "Seeding demo data..."
build_database "$LIVE_DB"

log "Starting UptimeKit..."
node apps/dash/server.js &
APP_PID=$!

(
    while sleep $((RESET_MINUTES * 60)); do
        reset_demo
    done
) &
RESET_PID=$!

shutdown() {
    log "Shutting down..."
    kill "$RESET_PID" "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
    su postgres -c "pg_ctl -D '$PGDATA' -m fast -w stop" >/dev/null || true
    exit "${1:-0}"
}
trap shutdown TERM INT

cat <<EOF

  UptimeKit demo is running at ${APP_URL}
  Login:        ${DEMO_EMAIL} / ${DEMO_PASSWORD}
  Status page:  ${APP_URL}/status/${DEMO_STATUS_PAGE_SLUG} (all pages are listed above)
  Data resets every ${RESET_MINUTES} minutes.

EOF

app_status=0
wait "$APP_PID" || app_status=$?
shutdown "$app_status"
