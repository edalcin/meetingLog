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

echo "[entrypoint] Running database migrations..."
su-exec appuser node src/migrate.js

echo "[entrypoint] Starting application..."
exec su-exec appuser node src/server.js
