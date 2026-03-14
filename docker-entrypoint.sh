#!/bin/sh
set -e

echo "[entrypoint] Waiting for MariaDB to be ready..."
RETRIES=30
until mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT 1" > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -eq 0 ]; then
    echo "[entrypoint] ERROR: Could not connect to MariaDB. Aborting."
    exit 1
  fi
  echo "[entrypoint] Waiting for DB... ($RETRIES retries left)"
  sleep 2
done

echo "[entrypoint] Running database migrations..."
for f in migrations/*.sql; do
  filename=$(basename "$f")
  APPLIED=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
    -sN -e "SELECT COUNT(*) FROM schema_migrations WHERE filename='$filename' LIMIT 1" 2>/dev/null || echo "0")
  if [ "$APPLIED" = "0" ]; then
    echo "[entrypoint] Applying migration: $filename"
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$f"
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
      -e "INSERT INTO schema_migrations (filename) VALUES ('$filename')"
  else
    echo "[entrypoint] Skipping already applied migration: $filename"
  fi
done

echo "[entrypoint] Migrations complete. Starting application..."
exec node src/server.js
