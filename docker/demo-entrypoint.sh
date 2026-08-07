#!/bin/sh
set -e

export PATH="/usr/lib/postgresql/15/bin:$PATH"

run_as_postgres() {
    su postgres -c "$*"
}

# ---- PostgreSQL ----
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo ">>> Initializing PostgreSQL data directory..."
    run_as_postgres "initdb -D '$PGDATA' --auth-host=scram-sha-256 --auth-local=trust"

    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"

    cat >> "$PGDATA/pg_hba.conf" <<EOF
host all all 0.0.0.0/0 scram-sha-256
host all all ::0/0 scram-sha-256
EOF

    mkdir -p /run/postgresql
    chown postgres:postgres /run/postgresql

    echo ">>> Starting temporary PostgreSQL to create database..."
    run_as_postgres "pg_ctl -D '$PGDATA' -l /tmp/pg_init.log -w start"

    run_as_postgres "psql -U postgres -d postgres -c \"CREATE USER $PGUSER WITH PASSWORD '$PGPASSWORD';\"" 2>/dev/null || true
    run_as_postgres "createdb -U postgres -O '$PGUSER' '$PGDATABASE'" 2>/dev/null || true

    echo "shared_preload_libraries = 'timescaledb'" >> "$PGDATA/postgresql.conf"

    run_as_postgres "pg_ctl -D '$PGDATA' -w restart"

    run_as_postgres "psql -U postgres -d '$PGDATABASE' -c 'CREATE EXTENSION IF NOT EXISTS timescaledb;'"

    run_as_postgres "pg_ctl -D '$PGDATA' -w stop"
else
    echo ">>> PostgreSQL data directory exists, skipping init."
fi

echo ">>> Starting PostgreSQL..."
run_as_postgres "pg_ctl -D '$PGDATA' -l /tmp/pg.log -w start"

echo ">>> Starting Redis..."
redis-server --daemonize yes --loglevel warning

# ---- Migrations ----
echo ">>> Running database migrations..."
./node_modules/.bin/tsx packages/db/src/migrate.ts

# ---- Seed ----
echo ">>> Seeding demo data..."
./node_modules/.bin/tsx scripts/seed-db.ts

reset_demo() {
    echo ">>> [$(date -u +%H:%M:%S)] Resetting demo database (15-min cycle)..."
    run_as_postgres "psql -U postgres -d postgres -c 'DROP DATABASE IF EXISTS $PGDATABASE WITH (FORCE);'" 2>/dev/null || true
    run_as_postgres "psql -U postgres -d postgres -c \"CREATE DATABASE $PGDATABASE OWNER $PGUSER;\"" 2>/dev/null || true
    run_as_postgres "psql -U postgres -d '$PGDATABASE' -c 'CREATE EXTENSION IF NOT EXISTS timescaledb;'" 2>/dev/null || true
    ./node_modules/.bin/tsx packages/db/src/migrate.ts
    ./node_modules/.bin/tsx scripts/seed-db.ts
    echo ">>> [$(date -u +%H:%M:%S)] Demo reset complete."
}

# ---- Auto-reset every 15 minutes ----
(
    while true; do
        sleep 900
        reset_demo || echo ">>> Reset failed, will retry next cycle"
    done
) &

echo ">>> Starting UptimeKit..."
echo ">>> Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}"
echo ">>> Status page: http://localhost:${PORT}/status/${DEMO_STATUS_PAGE_SLUG}"
echo ">>> Demo auto-resets every 15 minutes."
echo ""

exec node apps/dash/server.js
