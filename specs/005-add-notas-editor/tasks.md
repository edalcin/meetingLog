# Tasks: Add Notas Field and Text Editor

**Input**: Design documents from `/specs/005-add-notas-editor/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — manual verification via quickstart.md.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

*No project initialization required — existing Node.js/Hono project with all dependencies in place.*

- [x] T001 Verify `docs/source/scripts/` is listed in `.gitignore` (add entry if missing)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database column must exist and historical data must be loaded before any UI work can be validated.

**⚠️ CRITICAL**: All user story work depends on T002 and T004 being complete.

- [x] T002 Create `migrations/009_add_notas.sql` with `ALTER TABLE reuniao ADD COLUMN notas TEXT NULL AFTER tipo;`
- [x] T003 Apply migration: run `npm run migrate` (applies `009_add_notas.sql` to production DB at DB_HOST:3333)
- [x] T004 Create historical data migration script `docs/source/scripts/migrate_notas.js` — reads `docs/source/memoriaReunioes-Notas.csv` (tab-separated), matches each row by full datetime (`DATE_FORMAT(data_hora, '%Y-%m-%d %H:%i:%s')`), runs `UPDATE reuniao SET notas = ? WHERE DATE_FORMAT(data_hora, '%Y-%m-%d %H:%i:%s') = ?`, logs `✅ Updated` or `⚠️ No match` per row, skips empty `notasMD` rows; credentials hardcoded (host: DB_HOST, port: 3333, db: reunioes, user: root)
- [x] T005 Run historical data migration: `node docs/source/scripts/migrate_notas.js`

**Checkpoint**: `notas` column exists in `reuniao` and historical notes are loaded. All user story work can now begin.

---

## Phase 3: User Story 1 — View meeting notes in existing records (Priority: P1) 🎯 MVP

**Goal**: Users can open any migrated meeting record and read formatted notes in the view modal.

**Independent Test**: Open a migrated meeting in the info modal → notes section is visible with bullet points and headings rendered as HTML.

### Implementation for User Story 1

- [x] T006 [P] [US1] Add `notas` to SELECT query in `GET /api/meetings/:id` in `src/routes/meetings.js` — change `SELECT id, data_hora, tipo, criado_em, atualizado_em` to `SELECT id, data_hora, tipo, notas, criado_em, atualizado_em`; include `notas` in returned JSON
- [x] T007 [P] [US1] Add `notasToHtml(text)` function to `public/assets/app.js` — HTML-escapes `&`, `<`, `>`, `"`; parses line-by-line: `#### text` → `<h4>`, `  - text` (2+ spaces) → nested `<li>`, `- text` → top-level `<li>`, empty line → close open lists, other text → `<p>`; returns HTML string
- [x] T008 [US1] Add notas rendered display section to meeting view modal in `public/index.html` — positioned after pautas section; use `<template x-if="currentMeeting.notas">` wrapping a `<div x-html="notasToHtml(currentMeeting.notas)">` with heading "Notas"

**Checkpoint**: US1 complete and independently testable. Open any migrated meeting in the view modal and confirm formatted notes appear.

---

## Phase 4: User Story 2 — Edit notes on an existing meeting (Priority: P2)

**Goal**: Users can open an existing meeting for editing, modify the notes in a textarea, save, and confirm persistence.

**Independent Test**: Open an existing meeting with notes for editing → notes textarea is pre-populated → change text → save → re-open → updated text appears.

### Implementation for User Story 2

- [x] T009 [P] [US2] Add `notas` to PUT `/api/meetings/:id` in `src/routes/meetings.js` — destructure `notas = null` from body; add `notas = ?` to UPDATE query; include `notas` in the SELECT query after update; add `notas` to returned JSON
- [x] T010 [P] [US2] Add `notas` field to `formData` initial state in `public/assets/app.js` — add `notas: ''` to the formData object; pre-populate on edit with `this.formData.notas = m.notas ?? ''`; include `notas: this.formData.notas || null` in the POST/PUT request body
- [x] T011 [US2] Add notas textarea card to meeting form in `public/index.html` — positioned at the bottom of the form, after the pautas card; `<textarea x-model="formData.notas" rows="8" class="w-full text-sm font-mono border border-gray-300 rounded-lg p-2 ..." placeholder="- Item&#10;  - Sub-item&#10;#### Seção">`; wrapped in a card `<div class="bg-white rounded-xl shadow-sm p-4">` with label "Notas"

**Checkpoint**: US2 complete. Edit an existing meeting's notes, save, re-open — confirms persistence. View modal (US1) continues to work.

---

## Phase 5: User Story 3 — Add notes when creating a new meeting (Priority: P3)

**Goal**: Users can fill in notes when creating a new meeting; notes are saved and visible in the view modal after creation.

**Independent Test**: Create a new meeting with notes → save → open the record in view modal → notes appear formatted.

**Note**: The frontend textarea (T010, T011) and `formData.notas` state (T010) are shared between create and edit forms — no additional frontend work needed. Only the POST route requires updating.

### Implementation for User Story 3

- [x] T012 [US3] Add `notas` to POST `/api/meetings` in `src/routes/meetings.js` — destructure `notas = null` from body; add `notas` to the `INSERT INTO reuniao (data_hora, tipo, notas)` query; include `notas` in the SELECT query after insert; add `notas` to returned JSON

**Checkpoint**: US3 complete. Create a new meeting with notes → confirm notes appear in the view modal.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T013 [P] Update `GET /api/meetings/:id` response to reset form `notas` to empty string on `openForm()` (new meeting) to avoid stale data from previous edit — verify `formData.notas` is cleared in `public/assets/app.js`
- [x] T014 Run full quickstart.md validation: apply migration, run data script, verify view/edit/create in `npm run dev`
- [x] T015 Commit: `git add migrations/009_add_notas.sql src/routes/meetings.js public/index.html public/assets/app.js && git commit -m "feat(notas): add notas column, migration, and text editor UI"`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion (T003 + T005)
- **US2 (Phase 4)**: Depends on Phase 2 completion; T009 and T010 can start in parallel with US1
- **US3 (Phase 5)**: Depends on T010 + T011 (US2 frontend tasks); T012 can run in parallel with US2 backend (T009)
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 completion

### User Story Dependencies

- **US1 (P1)**: Independent — only needs the DB column (T003) and data (T005)
- **US2 (P2)**: Independent backend (T009); frontend textarea (T010, T011) shared with US3
- **US3 (P3)**: Backend only (T012); frontend reuses US2's textarea — soft dependency on T010+T011

### Within Each User Story

- T006 and T007 (US1 backend + frontend function) can run in parallel
- T008 (US1 HTML) depends on T007 (needs `notasToHtml` function defined first)
- T009 and T010 (US2 backend + frontend state) can run in parallel
- T011 (US2 HTML) can run in parallel with T009 and T010
- T012 (US3 backend) can run in parallel with T009-T011

### Parallel Opportunities

- T006 (backend GET/:id), T007 (notasToHtml function): parallel
- T009 (backend PUT), T010 (formData state), T011 (textarea HTML): parallel
- T012 (backend POST) can start alongside T009-T011

---

## Parallel Example: User Story 1

```
# These two tasks can run simultaneously:
T006: Add notas to GET /:id SELECT in src/routes/meetings.js
T007: Add notasToHtml() function to public/assets/app.js

# Then, once T007 is complete:
T008: Add notas display section to view modal in public/index.html
```

## Parallel Example: User Story 2 + 3

```
# All three US2 tasks can run simultaneously:
T009: Add notas to PUT /:id in src/routes/meetings.js
T010: Add notas to formData in public/assets/app.js
T011: Add textarea card to form in public/index.html

# US3 backend can also run at the same time:
T012: Add notas to POST / in src/routes/meetings.js
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001) + Phase 2 (T002–T005)
2. Complete Phase 3 (T006–T008)
3. **STOP and VALIDATE**: Open a migrated meeting — formatted notes visible in view modal
4. Historical data is immediately accessible to user

### Incremental Delivery

1. Phase 1 + 2 → DB column exists, historical data loaded
2. Phase 3 (US1) → Users can view notes → **Demo-ready MVP**
3. Phase 4 (US2) → Users can edit notes
4. Phase 5 (US3) → Users can add notes to new meetings
5. Phase 6 (Polish) → Commit, push, deploy

---

## Notes

- `docs/source/scripts/migrate_notas.js` is **never committed** — gitignored
- No new route file needed — all changes are in `src/routes/meetings.js`
- No new npm packages needed — vanilla JS renderer, no external markdown library
- `notas` is intentionally excluded from `GET /api/meetings` list endpoint — only in `GET /:id`
- The form textarea is shared between create and edit — build once in US2, used for free in US3
