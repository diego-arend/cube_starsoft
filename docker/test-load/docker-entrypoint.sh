#!/bin/sh
# docker-entrypoint.sh
#
# Runs database migrations before starting the application when
# DATABASE_MIGRATIONS_RUN=true is set in the container environment.
#
# Usage (Dockerfile):
#   ENTRYPOINT ["/entrypoint.sh"]
#   CMD ["node", "apps/backend/dist/main"]
#
# The script uses `exec "$@"` so the app process replaces the shell and
# receives OS signals (SIGTERM, etc.) correctly.

set -e

if [ "$DATABASE_MIGRATIONS_RUN" = "true" ]; then
  echo "[entrypoint] DATABASE_MIGRATIONS_RUN=true — running migrations..."
  node /app/packages/database/dist/cli/run-migrations.js
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] DATABASE_MIGRATIONS_RUN is not 'true' — skipping migrations."
fi

exec "$@"
