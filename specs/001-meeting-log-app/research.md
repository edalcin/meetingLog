# Research: Meeting Log Application

**Phase**: 0 — Outline & Research
**Date**: 2026-03-14
**Spec**: [spec.md](spec.md)

---

## Decision 1: Backend Framework

**Decision**: Hono on Node.js 22

**Rationale**: Hono has the smallest dependency footprint (~35 MB) among Node.js web frameworks while providing a modern, TypeScript-friendly API. It handles both REST routes and static file serving in a single process — ideal for a single-container deployment. Fastify was a close second; Express was ruled out due to larger footprint and slower performance.

**Alternatives considered**:
- Express: Mature but largest footprint (~50–80 MB), slowest of the three.
- Fastify: Excellent choice (~40–50 MB), but Hono edges it out on size and modernity.
- Python/FastAPI: Requires a separate frontend build step and heavier runtime; ruled out in favour of a single-language Node.js stack.

---

## Decision 2: Frontend Approach

**Decision**: Vanilla HTML + Alpine.js (CDN) + Tailwind CSS (CDN)

**Rationale**: The app is a personal tool with a single authenticated user. There is no need for a full SPA build step (no Webpack/Vite, no React/Vue compilation). Alpine.js (~15 kB) provides reactive data binding for table sorting/filtering without a build pipeline. Tailwind CSS CDN provides the modern, responsive look. Both are loaded from CDN at runtime — the Docker image contains only static HTML/JS files with no frontend build artefacts.

**Alternatives considered**:
- React/Vue with Vite build: Adds build complexity and ~100 MB of dev dependencies to the Docker build stage; overkill for a simple CRUD interface.
- Pure vanilla JS (no Alpine): Viable but more verbose for reactive table filtering.

---

## Decision 3: Docker Base Image

**Decision**: `node:22-alpine` (multi-stage: builder → runtime)

**Rationale**: Alpine gives ~181 MB base vs ~1.1 GB for standard Node. Chainguard distroless (~145 MB) would be smaller but lacks a shell, which prevents using an `entrypoint.sh` script for migration execution. Alpine is the practical minimum for a container that needs shell-based startup orchestration. Multi-stage build (builder installs deps, runtime copies only production deps) reduces the final image to ~120–170 MB.

**Alternatives considered**:
- `node:22-slim` (~220 MB): Larger than Alpine, no benefit over Alpine for this use case.
- Chainguard distroless: Smallest, but incompatible with shell-based entrypoint migration pattern.
- Single-stage build: Would include devDependencies in final image, adding ~50–100 MB.

---

## Decision 4: Database Migration Strategy

**Decision**: Entrypoint shell script runs SQL migrations before the Node.js process starts.

**Rationale**: A single container is simpler to manage on UNRAID than an init-container or separate migration job. The entrypoint script: (1) waits for MariaDB to be reachable, (2) applies schema SQL using the `mysql` CLI included in Alpine, (3) executes `exec node server.js` to replace the shell with the application process (proper signal handling). A `schema_migrations` table tracks applied migrations to make the script idempotent.

**Alternatives considered**:
- Separate migration container: Requires `depends_on` orchestration; unnecessary complexity for a single-user tool.
- ORM-managed migrations (Knex, Sequelize): Adds significant dependency weight; raw SQL is simpler and transparent.
- Run migrations from application code at startup: Harder to separate concerns; errors harder to surface.

---

## Decision 5: PWA Implementation

**Decision**: `manifest.json` + minimal `sw.js` (registration only, no caching) + iOS meta tags.

**Rationale**: The clarified requirement is PWA install only (add to home screen), with no offline data access. The minimum viable PWA requires: a linked `manifest.json` with `name`, `start_url`, `display: standalone`, and `icons`; a registered service worker (even an empty one satisfies the browser's installability check); and `apple-touch-icon` for iOS home screen icon quality. The `apple-mobile-web-app-capable` meta tag provides backward compatibility with older iOS versions.

**Alternatives considered**:
- Full offline cache strategy: Ruled out in clarification session (Option C chosen).
- No service worker: App would not pass browser installability criteria.

---

## Decision 6: GitHub Actions / GHCR Publishing

**Decision**: `docker/build-push-action@v5` triggered on push to `main`, using `GITHUB_TOKEN` and GitHub Actions Cache (GHA) for layer caching.

**Rationale**: `GITHUB_TOKEN` has built-in `packages: write` scope — no additional secrets required. GHA cache (`type=gha`) is the simplest caching strategy requiring zero extra configuration. Image tagged as both `:latest` and `:sha-<7-char-SHA>` for traceability.

**Alternatives considered**:
- Registry-based cache (inline): More persistent across branches but requires extra GHCR tag slot; unnecessary for a simple main-branch workflow.
- Manual `docker push`: No caching, slower builds; inferior to the action.

---

## Decision 7: Application Architecture

**Decision**: Single container, single Node.js process. Hono serves both the REST API (`/api/*`) and static files (`/`, `/assets/*`).

**Rationale**: Eliminates nginx as a reverse proxy, saving ~10–20 MB and reducing operational complexity. Hono's static file middleware handles this natively. No separate processes or supervisors needed.

**Alternatives considered**:
- nginx + Node.js in same container: Additional process, additional image weight, no meaningful performance benefit for a personal tool.
- nginx + Node.js as separate containers: Proper for large-scale apps; overkill for single-user UNRAID deployment.
