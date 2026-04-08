#!/bin/bash
# docker-up-test-load.sh
#
# Phased startup for the test-load stack:
#
#   Phase 1 — Infrastructure
#     Brings up stateful services (postgres, redis, rabbitmq) and helpers
#     (traefik, mailpit, minio, pgadmin, redisinsight) and waits for their
#     healthchecks to pass.
#
#   Phase 2 — Migration
#     Runs the migration one-shot container (blocking). The script waits for
#     the container to exit and fails fast if the exit code is non-zero.
#     The migration container is removed immediately after completion so it
#     never appears in `docker compose ps` once the stack is live.
#
#   Phase 3 — Application services
#     Starts backend, worker-notification and frontend only AFTER the
#     migration container has been torn down. --no-deps prevents docker
#     compose from re-evaluating (and re-running) the migration service as
#     a depends_on dependency.
#
# Usage:
#   pnpm run docker:up:test-load          (called via package.json)
#   bash scripts/docker-up-test-load.sh   (directly)

set -euo pipefail

COMPOSE_FILE="docker/test-load/docker-compose-test-load.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"

# ── Phase 1: Infrastructure ──────────────────────────────────────────────────
echo "[test-load] ── Phase 1: Building images and starting infrastructure..."
$COMPOSE up -d --build \
  postgres redis rabbitmq \
  traefik mailpit minio pgadmin redisinsight

# `docker compose wait` is for one-shot containers (waits for exit).
# For long-running services we must poll docker inspect for the health status.
echo "[test-load] Waiting for infrastructure healthchecks..."
for svc in turborepo_saas_postgres_prod turborepo_saas_redis_prod turborepo_saas_rabbitmq_prod; do
  echo "[test-load]   waiting for $svc to be healthy..."
  until [ "$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null)" = "healthy" ]; do
    sleep 3
  done
  echo "[test-load]   $svc is healthy ✔"
done

# ── Phase 2: Migration ───────────────────────────────────────────────────────
echo "[test-load] ── Phase 2: Running database migrations..."
# Runs blocking (no -d). The entrypoint executes migrations then the
# container exits. set -euo pipefail + the exit-code check below ensure any
# migration failure aborts the whole script before apps are started.
$COMPOSE up --no-deps --build migration

MIGRATION_EXIT=$($COMPOSE ps --status exited --format '{{.ExitCode}}' migration 2>/dev/null | head -1 || echo "1")
if [ "$MIGRATION_EXIT" != "0" ]; then
  echo "[test-load] ERROR: Migration exited with code $MIGRATION_EXIT. Aborting."
  $COMPOSE logs migration
  exit 1
fi

echo "[test-load] Migrations completed successfully. Removing migration container..."
$COMPOSE rm -f migration
echo "[test-load] Migration container removed."

# ── Phase 3: Application services ────────────────────────────────────────────
echo "[test-load] ── Phase 3: Starting application services..."
# --no-deps: infra is already running; prevents docker compose from
# re-evaluating (and re-running) the migration service via depends_on.
$COMPOSE up -d --no-deps backend worker-notification frontend

echo "[test-load] Waiting for backend to become healthy..."
until $COMPOSE exec -T backend \
    node -e "require('http').get('http://localhost:3001/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))" \
    2>/dev/null; do
  sleep 3
done

echo "[test-load] ── Stack is ready. 🚀"
