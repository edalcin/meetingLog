#!/bin/sh
set -e

# Ensure DB_PATH always has a value (use default if not set via env)
: "${DB_PATH:=/data/db/meetinglog.sqlite}"
export DB_PATH

# Create DB directory as root so appuser can write to it
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "$DB_DIR"
chown -R appuser:appgroup "$DB_DIR" 2>/dev/null || true

# Create uploads directory as root
if [ -n "$FILES_PATH" ]; then
  mkdir -p "$FILES_PATH/thumbnails"
  chown -R appuser:appgroup "$FILES_PATH" 2>/dev/null || true
fi

# Auto-migrate from MariaDB on first run:
# If MARIADB_HOST is set and the SQLite file does not yet exist,
# run the one-time data migration script.
if [ -n "$MARIADB_HOST" ] && [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] SQLite file not found and MARIADB_HOST is set — migrating data from MariaDB..."
  su-exec appuser node --no-warnings scripts/migrate-mariadb-to-sqlite.js
  echo "[entrypoint] Data migration from MariaDB complete."
fi

echo "[entrypoint] Running SQLite schema migrations..."
su-exec appuser node src/migrate.js

echo "[entrypoint] Starting application..."
exec su-exec appuser node src/server.js
