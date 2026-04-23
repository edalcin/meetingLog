#!/bin/sh
set -e

# Ensure DB directory exists and is owned by appuser
if [ -n "$DB_PATH" ]; then
  DB_DIR=$(dirname "$DB_PATH")
  mkdir -p "$DB_DIR"
  chown -R appuser:appgroup "$DB_DIR" 2>/dev/null || true
fi

# Ensure uploads directory exists and is owned by appuser
if [ -n "$FILES_PATH" ]; then
  mkdir -p "$FILES_PATH/thumbnails"
  chown -R appuser:appgroup "$FILES_PATH" 2>/dev/null || true
fi

# Auto-migrate from MariaDB on first run:
# If the SQLite file does not exist AND MariaDB credentials are provided,
# run the data migration script before starting the app.
if [ -n "$MARIADB_HOST" ] && [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] SQLite file not found and MARIADB_HOST is set — starting data migration from MariaDB..."
  su-exec appuser node --disable-warning=ExperimentalWarning scripts/migrate-mariadb-to-sqlite.js
  echo "[entrypoint] Data migration from MariaDB complete."
fi

echo "[entrypoint] Running SQLite schema migrations..."
su-exec appuser node src/migrate.js

echo "[entrypoint] Starting application..."
exec su-exec appuser node src/server.js
