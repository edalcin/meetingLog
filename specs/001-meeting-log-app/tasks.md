# Tasks: Meeting Log Application

**Input**: Design documents from `specs/001-meeting-log-app/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffold, dependency init, and local dev environment

- [x] T001 Create directory structure: `src/routes/`, `migrations/`, `scripts/`, `public/assets/`, `public/icons/`, `docs/source/`, `.github/workflows/`
- [x] T002 Create `package.json` with Node.js 22, type `"module"`, scripts: `start`, `dev`, `migrate`, `test`; add dependencies: `hono`, `mysql2`; add devDependencies: `@hono/node-server`, `nodemon`
- [x] T003 [P] Create `.env.example` with all required env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `APP_PIN`, `APP_PORT=3000`
- [x] T004 [P] Create `docker-compose.yml` for local dev: `app` service (build: .) + `db` service (mariadb:11, env vars from `.env`), ports, volumes
- [x] T005 [P] Create `.gitignore` (node_modules, .env, *.log) and `.dockerignore` (node_modules, .env, .git, docs/source, specs, .specify)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, server skeleton, and DB connection — must complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create `migrations/001_init.sql` with DDL for `schema_migrations` table and `reuniao` table exactly as defined in `specs/001-meeting-log-app/data-model.md`; include indexes on `data_hora` and `projeto`
- [x] T007 Create `docker-entrypoint.sh`: (1) wait for MariaDB to accept connections (retry loop, max 30s), (2) iterate migration files in `migrations/` order and insert into `schema_migrations` only if not already applied, (3) `exec node src/server.js`; make executable (`chmod +x`)
- [x] T008 Create `src/db.js`: export a `mysql2/promise` connection pool; read `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` from `process.env`; pool size 5; on connection error log and exit process
- [x] T009 Create `src/server.js`: initialise Hono app; serve `public/` as static files at `/`; mount `/api` router (placeholder for now); start server on `process.env.APP_PORT ?? 3000`; log startup URL

**Checkpoint**: Run `docker compose up` — app should start, DB should connect, static files served at `http://localhost:3000`

---

## Phase 3: User Story 5 — Data Migration from CSV (Priority: P1) 🎯

**Goal**: Import all historical records from `memoriaReunioes-Reuniao.csv` into the `reuniao` table on initial setup; migration is idempotent (re-running does not create duplicates).

**Independent Test**: Run `node scripts/import-csv.js`; verify DB row count equals CSV data row count; run again and verify count does not increase.

- [x] T010 [US5] Create `scripts/import-csv.js`: read `docs/source/memoriaReunioes-Reuniao.csv` (delimiter `;`); parse each row mapping `data` → `data_hora` (DD/MM/YYYY HH:mm → DATETIME), `tipo`, `participantes`, `projeto`; use `INSERT IGNORE` or check-before-insert strategy to skip duplicates; log skipped rows and final insert count; exit with code 1 on fatal errors

**Checkpoint**: After `docker compose up` + `node scripts/import-csv.js`, the meetings list in the DB should contain all historical records

---

## Phase 4: User Story 1 — PIN Authentication (Priority: P1) 🎯

**Goal**: User is presented with a PIN entry screen before accessing any content. Correct PIN grants session-scoped access (sessionStorage); wrong PIN shows error and blocks access.

**Independent Test**: Deploy app with `APP_PIN=1234`; navigate to `/`; verify PIN screen is shown; enter `1234` → verify app content is accessible; close tab and reopen → verify PIN screen is shown again; enter wrong PIN → verify error message and no access.

- [x] T011 [US1] Create `public/index.html`: full-page HTML shell with Tailwind CSS CDN, Alpine.js CDN; add iOS PWA meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`); link `manifest.json` and `sw.js`; include `<div x-data="app()">` root component with two conditional sections: PIN screen (`x-show="!authenticated"`) and main app (`x-show="authenticated"`); link `public/assets/app.js` and `public/assets/styles.css`
- [x] T012 [P] [US1] Create `public/assets/app.js`: define Alpine.js `app()` function; implement PIN gate: on init check `sessionStorage.getItem('pin_ok')`; `verifyPin(entered)` compares against value fetched from `GET /api/config/pin-hash` (or validate client-side against hashed env value — see note below); on success set `sessionStorage.setItem('pin_ok','1')` and set `authenticated = true`; on failure set `pinError = true`
  - **Note**: PIN validation approach — server exposes `GET /api/auth/check` that accepts the PIN and returns `{ok: true/false}` without exposing the PIN itself. This keeps PIN server-side.
- [x] T013 [P] [US1] Add `POST /api/auth/check` route inline in `src/server.js` (or `src/routes/auth.js`): accept `{ pin }` in body; compare against `process.env.APP_PIN`; return `{ ok: true }` or `{ ok: false }`; no rate limiting needed (LAN-only deployment)
- [x] T014 [P] [US1] Create `public/assets/styles.css`: PIN screen centred card, input field, error state; minimal overrides on top of Tailwind

**Checkpoint**: Navigate to `/`, enter PIN → should show "authenticated" placeholder message. Wrong PIN → error shown.

---

## Phase 5: User Story 2 — List and Filter Meetings (Priority: P2)

**Goal**: Authenticated user views all meetings in a sortable, filterable table ordered by date descending. Real-time text filter. Column header sort toggle.

**Independent Test**: With migrated data loaded, open app, authenticate; verify table shows meetings sorted by date descending; type "Useflora" in filter → verify only Useflora rows shown; click "Projeto" column header → verify sort direction changes.

- [x] T015 [US2] Create `src/routes/meetings.js`: implement `GET /api/meetings` with query params `q` (text filter on `projeto` and `participantes`), `sort` (allowlist: `data_hora`, `tipo`, `participantes`, `projeto`), `order` (`asc`/`desc`), `page`, `limit` (default 50, max 200); return `{ data, total, page, limit, pages }` as defined in `contracts/api.md`; use parameterised queries only
- [x] T016 [US2] Mount meetings router in `src/server.js`: `app.route('/api/meetings', meetingsRouter)`
- [x] T017 [P] [US2] Add meetings list section to `public/index.html` (inside main app area): filter input, table with headers (Data/Hora, Tipo, Participantes, Projeto) with sort-click handlers, tbody bound with `x-for`, pagination controls
- [x] T018 [US2] Implement list logic in `public/assets/app.js`: `meetings` array, `filter`, `sort`, `order`, `page`, `totalPages` reactive data; `loadMeetings()` fetches `GET /api/meetings` with current params; debounced filter watcher (300ms); sort header click toggles `order` and reloads; pagination prev/next; loading and empty state handling

**Checkpoint**: Authenticated → meetings table populated; filter works in real time; column sort works; pagination shows correct pages.

---

## Phase 6: User Story 3 — Register New Meeting (Priority: P3)

**Goal**: Authenticated user fills and submits a new meeting form (date, time, type, participants, project). Record saved and immediately visible in the list. Incomplete form shows inline validation errors.

**Independent Test**: Open form; submit empty → all required field errors shown; fill valid data and submit → record appears at top of meetings list; open form again and cancel → no record created.

- [x] T019 [US3] Add `GET /api/meetings/:id` and `POST /api/meetings` to `src/routes/meetings.js`: GET :id returns single meeting or 404; POST validates required fields (`data_hora`, `tipo`, `participantes`, `projeto`), inserts record, returns 201 with created object; validation errors return 400 with `{ error, fields }` shape from `contracts/api.md`
- [x] T020 [P] [US3] Add new meeting form to `public/index.html`: modal or slide-in panel with date input, time input, tipo dropdown (Presencial/Remota), participantes textarea, projeto text input, Save and Cancel buttons; `x-show="showForm"`
- [x] T021 [US3] Implement form logic in `public/assets/app.js`: `showForm`, `formData`, `formErrors` reactive state; `saveNewMeeting()` posts to `POST /api/meetings`, handles 201 (close form, reload list, clear errors) and 400 (populate `formErrors` per field); `cancelForm()` resets state without saving

**Checkpoint**: Submit form with valid data → new meeting appears in list. Submit empty form → per-field errors shown.

---

## Phase 7: User Story 4 — Edit Existing Meeting (Priority: P4)

**Goal**: Authenticated user clicks edit on a meeting, modifies fields, saves. Updated record visible in list. Required-field validation prevents saving with empty required fields.

**Independent Test**: Click edit on any meeting; change `projeto` value; save → updated value visible in list. Clear `projeto` field and save → error shown, record not saved.

- [x] T022 [US4] Add `PUT /api/meetings/:id` to `src/routes/meetings.js`: validate same fields as POST; update record; return 200 with updated object; return 404 if not found; return 400 on validation failure
- [x] T023 [US4] Implement edit flow in `public/assets/app.js`: `editMeeting(id)` fetches `GET /api/meetings/:id`, populates `formData`, sets `editingId`, shows form; update `saveNewMeeting()` to branch on `editingId` — if set, PUT to `/api/meetings/:id`, else POST; on success reload list and clear `editingId`
- [x] T024 [P] [US4] Update form in `public/index.html`: change form title to show "Editar Reunião" vs "Nova Reunião" based on `editingId`; add edit button in each table row (pencil icon)

**Checkpoint**: Edit a meeting → correct values pre-filled in form; save → list updated. Clear required field → error shown.

---

## Phase 8: PWA (Install Support)

**Purpose**: Make the app installable as a PWA (add to home screen) on Android and iOS

- [x] T025 [P] Create `public/manifest.json`: `name: "Meeting Log"`, `short_name: "Reuniões"`, `start_url: "/"`, `display: "standalone"`, `background_color: "#ffffff"`, `theme_color: "#1e40af"`, `icons` array with 192×192 and 512×512 entries pointing to `public/icons/`
- [x] T026 [P] Create `public/sw.js`: minimal service worker — register install event that does nothing (no cache); service worker must be valid JS and served from root scope `/sw.js`; add registration script to `public/index.html`: `navigator.serviceWorker.register('/sw.js')` guarded by feature check
- [x] T027 [P] Create PWA icon files in `public/icons/`: `icon-192.png` (192×192), `icon-512.png` (512×512), `apple-touch-icon.png` (180×180); use simple meeting/calendar icon on blue background; add `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">` to `public/index.html`
- [x] T028 [P] Verify PWA installability: ensure `public/index.html` has `<link rel="manifest" href="/manifest.json">`, `<meta name="apple-mobile-web-app-title" content="Reuniões">`, and HTTPS is used (or localhost for testing); confirm Lighthouse PWA installability criteria pass

**Checkpoint**: Open app in Chrome → install prompt appears (or "Add to Home Screen" is available). On iOS Safari, Share → "Add to Home Screen" option is available.

---

## Phase 9: Docker & CI/CD

**Purpose**: Minimal production Docker image and automated GHCR publish pipeline

- [x] T029 Create `Dockerfile`: multi-stage — Stage 1 (`node:22-alpine` as builder): `WORKDIR /app`, `COPY package*.json .`, `RUN npm ci`, `COPY . .`; Stage 2 (`node:22-alpine` as runner): `WORKDIR /app`, `COPY --from=builder /app/node_modules ./node_modules`, `COPY --from=builder /app/src ./src`, `COPY --from=builder /app/migrations ./migrations`, `COPY --from=builder /app/public ./public`, `COPY docker-entrypoint.sh .`, `EXPOSE 3000`, `ENTRYPOINT ["./docker-entrypoint.sh"]`
- [x] T030 [P] Add `GET /api/health` endpoint in `src/server.js`: attempt a lightweight DB query (`SELECT 1`); return `{ status: "ok", db: "connected" }` on success or `{ status: "error", db: "disconnected" }` with HTTP 503 on failure
- [x] T031 [P] Create `.github/workflows/docker-publish.yml`: trigger `on: push: branches: [main]`; permissions `contents: read`, `packages: write`; steps: checkout, setup-buildx, login to `ghcr.io` with `GITHUB_TOKEN`, build-push-action tagging `ghcr.io/edalcin/meetinglog:latest` and `ghcr.io/edalcin/meetinglog:sha-${{ github.sha }}`, GHA layer cache (`type=gha`)

**Checkpoint**: Push to `main` → GitHub Actions workflow runs → image available at `ghcr.io/edalcin/meetinglog:latest`.

---

## Phase 10: Polish & Documentation

**Purpose**: Operator documentation and final validation

- [x] T032 [P] Create `docs/unraid-install.md`: step-by-step guide for UNRAID Docker Add UI (`Docker → Add Container`); include: Container Name, Repository (`ghcr.io/edalcin/meetinglog:latest`), Network Type, Port mapping (`APP_PORT:3000`), all 7 env var entries with labels and descriptions, WebUI field, Icon URL suggestion; include a troubleshooting section (DB connection errors, PIN forgotten)
- [x] T033 [P] Create `README.md`: one-paragraph overview; prerequisites; quick-start with `docker run` command; env vars table; link to `docs/unraid-install.md`; link to `docs/source/memoriaReunioes-Reuniao.csv` import instructions
- [x] T034 Full smoke test: `docker compose up`; run `node scripts/import-csv.js`; open `http://localhost:3000`; enter PIN; verify list loaded with historical data; create new meeting; edit it; verify PWA manifest loads (`/manifest.json`); verify `/api/health` returns `ok`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all user stories
- **Phase 3 (US5 - CSV Migration)**: Depends on Phase 2 (needs DB schema)
- **Phase 4 (US1 - PIN Auth)**: Depends on Phase 2 (needs Hono server)
- **Phase 5 (US2 - List)**: Depends on Phase 2 + Phase 3 (needs DB data + API routes)
- **Phase 6 (US3 - Register)**: Depends on Phase 5 (form extends list UI)
- **Phase 7 (US4 - Edit)**: Depends on Phase 6 (edit extends register form)
- **Phase 8 (PWA)**: Depends on Phase 4 (needs `index.html` to exist)
- **Phase 9 (Docker)**: Depends on Phase 2 (needs `server.js` + `entrypoint.sh`)
- **Phase 10 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US5 (P1 - CSV Migration)**: Start after Phase 2 — no dependency on other user stories
- **US1 (P1 - PIN Auth)**: Start after Phase 2 — no dependency on other user stories; can run in parallel with US5
- **US2 (P2 - List)**: Start after Phase 2 + US5 recommended (need data to test filtering)
- **US3 (P3 - Register)**: Start after US2 (form integrates into list view)
- **US4 (P4 - Edit)**: Start after US3 (edit reuses register form)

### Parallel Opportunities Within Phases

Phase 1: T003, T004, T005 can all run in parallel after T001–T002
Phase 4 (US1): T012, T013, T014 can run in parallel after T011
Phase 5 (US2): T017 can run in parallel with T015
Phase 9: T030, T031 can run in parallel with T029

---

## Parallel Example: User Story 2

```
After T015 (API route) is complete:
  → Task T017: Add table HTML to index.html  (frontend — no conflict)
  → Task T018: Add list logic to app.js      (depends on T017 + T015)
```

---

## Implementation Strategy

### MVP First (US5 + US1 + US2 — minimal usable app)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3 (US5): Import historical data
4. Complete Phase 4 (US1): PIN authentication
5. Complete Phase 5 (US2): View and filter meetings
6. **STOP AND VALIDATE** — at this point the app has its full historical dataset, PIN protection, and a usable read-only interface
7. Continue with US3, US4, PWA, Docker as desired

### Incremental Delivery

1. Setup + Foundational → server starts, DB connected
2. + US5 → historical data loaded
3. + US1 → app is protected
4. + US2 → meetings visible and searchable (MVP!)
5. + US3 → new meetings can be registered
6. + US4 → meetings can be corrected
7. + PWA → installable on mobile
8. + Docker/CI → automated deployment pipeline live

---

## Notes

- All tasks use ES module syntax (`import`/`export`) — `"type": "module"` in `package.json`
- SQL queries must use parameterised form (`?` placeholders with mysql2) — no string interpolation
- Alpine.js and Tailwind are CDN-loaded — no frontend build step, no `npm run build`
- `scripts/import-csv.js` is a one-off operator tool, not part of the Docker image startup
- `[P]` tasks operate on different files with no shared state — safe to implement concurrently
- Commit after each phase checkpoint to keep `main` in a working state at all times
