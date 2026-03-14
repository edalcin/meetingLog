# Quickstart: Meeting Log Application

**Phase**: 1 — Design
**Date**: 2026-03-14

---

## Prerequisites

- Docker 24+
- A running MariaDB instance reachable from your machine (or use the dev compose file below)
- Node.js 22+ (for local development without Docker)

---

## Run with Docker (production-like)

```bash
docker run -d \
  --name meetinglog \
  -p 3000:3000 \
  -e DB_HOST=your-mariadb-host \
  -e DB_PORT=3306 \
  -e DB_NAME=reunioes \
  -e DB_USER=your-db-user \
  -e DB_PASSWORD=your-db-password \
  -e APP_PIN=1234 \
  ghcr.io/edalcin/meetinglog:latest
```

Open `http://localhost:3000` in your browser.

---

## Run with Docker Compose (local development)

```bash
# Start MariaDB + app
docker compose up

# Or in detached mode
docker compose up -d
```

A `docker-compose.yml` at the repository root spins up a local MariaDB container alongside the app. Environment variables are read from `.env` (copy from `.env.example`).

---

## Local Development (no Docker)

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your local DB credentials and PIN

# Run database migrations
npm run migrate

# Start development server (with hot reload)
npm run dev
```

The app runs at `http://localhost:3000`.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | — | MariaDB host |
| `DB_PORT` | Yes | — | MariaDB port |
| `DB_NAME` | Yes | — | Database name |
| `DB_USER` | Yes | — | Database user |
| `DB_PASSWORD` | Yes | — | Database password |
| `APP_PIN` | Yes | — | Access PIN (digits) |
| `APP_PORT` | No | `3000` | Port the app listens on |

---

## CSV Data Migration

Run once after initial setup to import historical meeting data:

```bash
# Inside the container
docker exec meetinglog node scripts/import-csv.js

# Or locally
node scripts/import-csv.js
```

The script reads `docs/source/memoriaReunioes-Reuniao.csv`, parses each row, and inserts records into the `reuniao` table. Already-imported records are skipped (upsert on date+tipo+participantes+projeto composite).

---

## Building the Docker Image

```bash
# Build locally
docker build -t meetinglog .

# Build and push to GHCR (handled automatically by GitHub Actions on push to main)
docker build -t ghcr.io/edalcin/meetinglog:latest .
docker push ghcr.io/edalcin/meetinglog:latest
```

---

## Project Structure

```text
.
├── src/
│   ├── server.js          # Hono app entry point + static file serving
│   ├── db.js              # mysql2 connection pool
│   └── routes/
│       └── meetings.js    # CRUD route handlers
├── migrations/
│   ├── 001_init.sql       # Schema creation (reuniao + schema_migrations tables)
│   └── 002_seed.sql       # (empty — data loaded via import-csv.js, not SQL seed)
├── scripts/
│   └── import-csv.js      # One-time CSV → DB importer
├── public/
│   ├── index.html         # Single-page app shell
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Minimal service worker (registration only)
│   ├── icons/             # PWA icons (192x192, 512x512, apple-touch-icon 180x180)
│   └── assets/
│       ├── app.js         # Alpine.js reactive logic
│       └── styles.css     # Custom styles (minimal, extends Tailwind CDN)
├── docker-entrypoint.sh   # Runs migrations then exec node src/server.js
├── Dockerfile             # Multi-stage: node:22-alpine builder → runner
├── .dockerignore
├── docker-compose.yml     # Local dev: app + MariaDB
├── .env.example
├── package.json
├── .github/
│   └── workflows/
│       └── docker-publish.yml   # Build & push to GHCR on push to main
└── docs/
    ├── unraid-install.md         # UNRAID installation instructions
    └── source/
        └── memoriaReunioes-Reuniao.csv
```
