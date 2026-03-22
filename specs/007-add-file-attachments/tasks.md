# Tasks: File Attachments for Meeting Records

**Input**: Design documents from `/specs/007-add-file-attachments/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story — each story is independently deployable and testable.
**Tests**: Not requested — no test tasks included.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no cross-dependency)
- **[Story]**: User story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New dependencies and environment configuration required by all stories.

- [x] T001 Install sharp npm package: run `npm install sharp` and commit updated `package.json` + `package-lock.json`
- [x] T002 [P] Add `poppler-utils` to `Dockerfile` apk install step (enables `pdftoppm` for PDF thumbnails)
- [x] T003 [P] Add `FILES_PATH` env var to `.env.example`; add startup bootstrap in `src/server.js` to create `$FILES_PATH/thumbnails/` directory if it does not exist (`fs.mkdirSync(..., { recursive: true })`)

**Checkpoint**: Dependencies installed, uploads dir bootstrapped on startup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core service modules that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create `migrations/011_add_arquivo.sql` — `arquivo` table with columns: `id`, `reuniao_id` (FK → `reuniao.id` CASCADE), `filename_original`, `filename_stored`, `letter` CHAR(1), `mime_type`, `file_size`, `criado_em`; UNIQUE KEY `uq_reuniao_letter (reuniao_id, letter)`; run `npm run migrate` to apply
- [x] T005 [P] Create `src/services/thumbnails.js` — export `generateThumbnail(storedPath, thumbPath, mimeType)`: for `image/*` use `sharp` resize 200×200 cover JPEG 80; for `application/pdf` use `execFile('pdftoppm', ['-singlefile','-f','1','-l','1','-jpeg', storedPath, tempBase])` then `sharp` resize + cleanup temp file
- [x] T006 [P] Create skeleton `src/routes/files.js` (ES module, exports a Hono app instance with no routes yet) and register it in `src/server.js` with `app.route('/api', filesRoute)`

**Checkpoint**: Table exists in DB, thumbnail service ready, route registered — user story implementation can begin

---

## Phase 3: User Story 1 — Upload File to Meeting (Priority: P1) 🎯 MVP

**Goal**: User can upload a PNG, JPG, or PDF (max 10 MB) to a meeting and immediately see a thumbnail in the "Arquivos" tab.

**Independent Test**: Open a meeting detail panel → upload a file → "Arquivos" tab appears with the file thumbnail. Upload a second file → both thumbnails visible with `_a`/`_b` naming.

### Implementation for User Story 1

- [x] T007 [US1] Implement `GET /api/meetings/:meetingId/files` in `src/routes/files.js` — `SELECT * FROM arquivo WHERE reuniao_id = ? ORDER BY letter ASC`; return `[]` for meetings with no files
- [x] T008 [P] [US1] Implement `GET /api/files/:fileId/thumbnail` in `src/routes/files.js` — auth check; look up `arquivo` record by id; stream `$FILES_PATH/thumbnails/<stem>.jpg` via `createReadStream` + `Readable.toWeb`; `Content-Type: image/jpeg`; return 404 if record or file missing
- [x] T009 [US1] Implement `POST /api/meetings/:meetingId/files` in `src/routes/files.js` — apply `bodyLimit` (10 MB → 413); `c.req.parseBody()` → `File`; validate `file.type` then magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, PDF `25 50 44 46`) → 400 if invalid; SELECT `data_hora` from `reuniao` → 404 if not found; compute `base = DATE_FORMAT(data_hora, '%Y-%m-%d_%Hh%i')`; `SELECT COALESCE(MAX(letter), chr(96)) FROM arquivo WHERE reuniao_id = ?` → `nextLetter`; build `filename_stored = ${base}_${nextLetter}.${ext}`; write file to `$FILES_PATH/filename_stored`; call `generateThumbnail`; INSERT into `arquivo`; return 201 with new record
- [x] T010 [US1] Add Alpine.js state and methods to `public/assets/app.js`: `meetingFiles: []`, `uploadingFile: false`, `fileUploadError: ''`; `loadFiles(meetingId)` — `GET /api/meetings/${meetingId}/files` → `this.meetingFiles = data`; `uploadFile(meetingId, inputEl)` — build `FormData`, `POST`, reload `meetingFiles`, clear input; call `loadFiles` when meeting detail panel opens
- [x] T011 [US1] Update `public/index.html` — add "Arquivos" tab button to meeting detail panel (x-show="`meetingFiles.length > 0`"); add tab content: thumbnail grid with `<img>` per file sourced from `/api/files/${file.id}/thumbnail`; add upload section: `<input type="file" accept=".png,.jpg,.jpeg,.pdf">` + upload button with `@click="uploadFile(meeting.id, $el.closest(...).querySelector('input'))"` + error display + loading state

**Checkpoint**: US1 fully functional — upload works, tab appears, thumbnails display, `_a`/`_b` naming verified

---

## Phase 4: User Story 2 — View and Download File (Priority: P2)

**Goal**: Clicking a thumbnail opens a modal showing the full image or inline PDF, with a download button.

**Independent Test**: Click a thumbnail → modal opens with correct content type; click download → file saved to device with stored filename; click outside modal or close button → modal closes.

### Implementation for User Story 2

- [x] T012 [US2] Implement `GET /api/files/:fileId/content` in `src/routes/files.js` — auth check; SELECT `arquivo` by id → 404 if not found; check file exists on disk → 404 if missing; stream `$FILES_PATH/filename_stored` via `createReadStream` + `Readable.toWeb`; `Content-Type: <mime_type>`; `Content-Disposition: inline; filename="<filename_stored>"`
- [x] T013 [US2] Add viewer state and methods to `public/assets/app.js`: `viewerFile: null`; `openViewer(file)` — sets `viewerFile = file`; `closeViewer()` — sets `viewerFile = null`; wire thumbnail `@click="openViewer(file)"` in the existing thumbnail grid data
- [x] T014 [US2] Add modal viewer to `public/index.html` — full-screen overlay (`x-show="viewerFile !== null"`, click-outside closes); `<img>` branch for `image/*` (`src="/api/files/${viewerFile.id}/content"`); `<embed>` branch for `application/pdf` (`src="/api/files/${viewerFile.id}/content" type="application/pdf"`); download `<a href="/api/files/${viewerFile?.id}/content" download="${viewerFile?.filename_stored}">` button; close (×) button

**Checkpoint**: US2 fully functional — modal opens for images and PDFs, download works, modal closes correctly

---

## Phase 5: User Story 3 — Remove File from Meeting (Priority: P3)

**Goal**: User can delete an attached file; thumbnail disappears from tab; tab hides when last file is removed.

**Independent Test**: Delete one file → thumbnail gone, other files unchanged with original letter suffixes; delete last file → "Arquivos" tab disappears.

### Implementation for User Story 3

- [x] T015 [US3] Implement `DELETE /api/files/:fileId` in `src/routes/files.js` — SELECT `arquivo` by id → 404 if not found; `unlink($FILES_PATH/filename_stored)` (log ENOENT, do not error); `unlink($FILES_PATH/thumbnails/<stem>.jpg)` (log ENOENT, do not error); `DELETE FROM arquivo WHERE id = ?`; return `{ ok: true }`
- [x] T016 [US3] Add `deleteFile(fileId)` to `public/assets/app.js` — `DELETE /api/files/${fileId}`; on success reload `meetingFiles` via `loadFiles`; tab visibility reactive via existing `x-show="meetingFiles.length > 0"`
- [x] T017 [US3] Add delete button to each thumbnail card in `public/index.html` — small × button positioned over thumbnail corner; `@click.stop="deleteFile(file.id)"`; confirm prompt optional (single-user tool, skip for simplicity)

**Checkpoint**: All three user stories functional — upload, view/download, delete all work end-to-end

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and verification across all stories.

- [x] T018 [P] Error hardening in `src/routes/files.js`: wrap thumbnail generation in try/catch — if it fails, delete the partially written stored file and return 500 with `{ error: 'Erro ao gerar thumbnail' }`; ensure `$FILES_PATH` is validated on startup (log fatal and exit if not set)
- [x] T019 [P] UX polish in `public/index.html` + `public/assets/app.js`: show upload progress indicator (`uploadingFile` flag → disabled button + spinner); display `fileUploadError` message on invalid type or size; show `filename_original` as tooltip or label below each thumbnail
- [ ] T020 Run end-to-end verification per `specs/007-add-file-attachments/quickstart.md` checklist (7 steps); confirm all acceptance scenarios from spec.md pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002 and T003 are [P]
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS all user stories; T005 and T006 are [P] with T004
- **Phase 3 (US1)**: Depends on Phase 2; T007 must complete before T009; T008 can run parallel with T007; T010 before T011
- **Phase 4 (US2)**: Depends on Phase 2; T013 depends on T010 (US1 Alpine state); T014 depends on T013
- **Phase 5 (US3)**: Depends on Phase 2; T016 depends on T010 (US1 Alpine state); T017 depends on T016
- **Phase 6 (Polish)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational phase — no dependency on US2 or US3
- **US2 (P2)**: Depends on Foundational phase — reuses Alpine state from US1 (T010) but US1 need not be "done" first; practically sequential
- **US3 (P3)**: Depends on Foundational phase — reuses Alpine state from US1 (T010); practically sequential

### Parallel Opportunities

- T002 ∥ T003 (Phase 1 — different files)
- T004 ∥ T005 ∥ T006 (Phase 2 — different files)
- T007 ∥ T008 (Phase 3 — different endpoints in same file; safely separable)
- T012 ∥ T013 (Phase 4 — backend vs. frontend)
- T015 ∥ T016 (Phase 5 — backend vs. frontend)
- T018 ∥ T019 (Phase 6 — different concerns)

---

## Parallel Example: User Story 1

```
# Phase 2 — run simultaneously:
Task T004: Create migrations/011_add_arquivo.sql + apply migration
Task T005: Create src/services/thumbnails.js
Task T006: Create src/routes/files.js skeleton + register in src/server.js

# Phase 3 — after T004/T005/T006 complete:
Task T007: GET /api/meetings/:id/files endpoint    ← do first
Task T008: GET /api/files/:id/thumbnail endpoint   ← [P] with T007
Then T009: POST upload endpoint (depends on both above)
Then T010: Alpine.js state (depends on T009)
Then T011: HTML tab + upload UI (depends on T010)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006) — **CRITICAL, blocks everything**
3. Complete Phase 3: User Story 1 (T007–T011)
4. **STOP and VALIDATE**: upload a file, see thumbnail in "Arquivos" tab, verify `_a`/`_b` naming
5. Deploy to UNRAID if ready — the app is already useful at this point

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. **US1** → upload + thumbnails → deploy (MVP)
3. **US2** → modal viewer + download → deploy
4. **US3** → delete → deploy
5. Polish → harden + verify

---

## Notes

- `[P]` tasks operate on different files or separable code blocks — no conflict risk
- Each user story checkpoint is a valid deploy point
- No automated tests — verify manually per `quickstart.md` verification steps
- `chr(96)` = `` ` `` (backtick), one below ASCII `a` (97) — used as COALESCE default so `charCode + 1 = 97 = 'a'`
- Commit after each phase or logical group of tasks
