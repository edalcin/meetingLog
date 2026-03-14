# meetingLog Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-14

## Project Overview

Meeting log web application. Single Node.js (Hono) container serving REST API + Alpine.js frontend, backed by an external MariaDB instance. Deployed on UNRAID via Docker.

## Active Technologies

- Node.js 22 + Hono (web framework) — main feature
- mysql2 (MariaDB driver)
- Alpine.js CDN + Tailwind CSS CDN (frontend — no build step)
- Docker (node:22-alpine, multi-stage build)

## Project Structure

```text
src/           # Node.js backend (Hono server, routes, db)
migrations/    # SQL migration files
scripts/       # Utility scripts (CSV importer)
public/        # Static frontend (HTML, Alpine.js, PWA assets)
docs/          # Documentation (UNRAID install guide, source data)
.github/workflows/  # CI/CD (GHCR publish on push to main)
```

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server with hot reload
npm run migrate      # Run DB migrations
npm test             # Run unit tests
docker build .       # Build Docker image
```

## Code Style

- Node.js 22: use ES modules (`import`/`export`), async/await throughout
- No TypeScript (keep it simple, single-user tool)
- Hono: use built-in validators for request body validation
- SQL: parameterised queries only (no string interpolation)

## Environment Variables

`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `APP_PIN`, `APP_PORT` (default 3000)

## Recent Changes

- 2026-03-14: Initial project spec, research, data model, and API contract created

<!-- MANUAL ADDITIONS START -->
- este projeto deve ter apenas o main branch. Nunca criar um novo branch. Comitar sempre no main branch
<!-- MANUAL ADDITIONS END -->
