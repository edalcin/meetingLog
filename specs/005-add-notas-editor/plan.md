# Implementation Plan: Add Notas Field and Text Editor

**Branch**: `005-add-notas-editor` | **Date**: 2026-03-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-add-notas-editor/spec.md`

## Summary

Add a `notas TEXT NULL` column to the `reuniao` table, migrate historical notes from `memoriaReunioes-Notas.csv` via a Node.js script, and expose the field in all three forms (create, edit, view) with a plain-text `<textarea>` for input and a client-side markdown-to-HTML renderer for display.

## Technical Context

**Language/Version**: Node.js 22, ES modules
**Primary Dependencies**: Hono (web framework), mysql2/promise (DB), Alpine.js CDN, Tailwind CSS CDN
**Storage**: MariaDB — `reunioes` database, `reuniao` table — adding column `notas TEXT NULL`
**Testing**: Manual (single-user tool, no automated test suite)
**Target Platform**: Docker on UNRAID (Linux); dev on Windows
**Project Type**: Web service (API + Alpine.js frontend, no build step)
**Performance Goals**: Single-user tool — no performance targets beyond standard web responsiveness
**Constraints**: No build step; no new npm packages; credentials never in repo; parameterized SQL only
**Scale/Scope**: ~100 meeting records; notes range from 1 line to ~50 lines

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Rule | Status | Notes |
|------|--------|-------|
| §I.1 Simplicidade | ✅ Pass | Direct column on `reuniao`; no new table; no new route file |
| §I.2 No build step | ✅ Pass | Renderer is vanilla JS; no new npm dependencies |
| §I.3 SQL parametrizado | ✅ Pass | All queries will use `?` placeholders |
| §I.4 Credenciais fora do repo | ✅ Pass | Migration script in `docs/source/scripts/` (gitignored) |
| §I.5 Migrations imutáveis | ✅ Pass | Single new file `009_add_notas.sql`; no edits to existing migrations |
| §II.1 Processo canônico | ✅ N/A | Not a new associated table — direct column addition |
| §III.1 CSV format note | ⚠️ Note | `memoriaReunioes-Notas.csv` is **tab-separated**, not `;` as convention. Script handles this. |

No violations. No complexity tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/005-add-notas-editor/
├── plan.md              ← this file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── meetings-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             ← created by /speckit.tasks
```

### Source Code (changes required)

```text
migrations/
└── 009_add_notas.sql              ← NEW: ALTER TABLE reuniao ADD COLUMN notas

docs/source/scripts/               ← gitignored
└── migrate_notas.js               ← NEW: CSV → DB migration script

src/routes/
└── meetings.js                    ← MODIFY: include notas in SELECT/INSERT/UPDATE

public/
├── index.html                     ← MODIFY: add textarea to form; add notas display to view modal
└── assets/app.js                  ← MODIFY: formData.notas field; notasToHtml() renderer
```

## Implementation Phases

### Phase 1A — Database

**Task**: Create `migrations/009_add_notas.sql`

```sql
ALTER TABLE reuniao
  ADD COLUMN notas TEXT NULL AFTER tipo;
```

Run: `npm run migrate`

---

### Phase 1B — Historical data migration script

**Task**: Create `docs/source/scripts/migrate_notas.js`

Logic:
1. Read `docs/source/memoriaReunioes-Notas.csv` (tab-separated, UTF-8)
2. Parse each row: `data` (col 0) + `notasMD` (col 1, strip outer double-quotes, unescape `""` → `"`)
3. Skip rows with empty `notasMD`
4. For each row: `UPDATE reuniao SET notas = ? WHERE DATE_FORMAT(data_hora, '%Y-%m-%d %H:%i:%s') = ?`
5. Log result per row: `✅ Updated: <datetime>` or `⚠️ No match: <datetime>`
6. Use env vars from `.env` or hardcoded root credentials (file never committed)

Credentials in script (supplied via environment variables, file is gitignored):
```
DB_HOST=<db-host>
DB_PORT=<db-port>
DB_NAME=reunioes
DB_USER=<db-user>
DB_PASSWORD=<db-password>
```

Run: `node docs/source/scripts/migrate_notas.js`

---

### Phase 1C — Backend: `src/routes/meetings.js`

Three modifications:

**1. GET /api/meetings/:id** — add `notas` to SELECT:
```js
'SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao WHERE id = ?'
```
Include `notas` in the returned JSON object.

**2. POST /api/meetings** — accept and insert `notas`:
```js
const { data_hora, tipo, notas = null, participante_ids, projeto_ids = [], pautas = [] } = body
// INSERT INTO reuniao (data_hora, tipo, notas) VALUES (?, ?, ?)
```
Update the SELECT after insert to include `notas`.

**3. PUT /api/meetings/:id** — accept and update `notas`:
```js
const { data_hora, tipo, notas = null, participante_ids, projeto_ids = [], pautas = [] } = body
// UPDATE reuniao SET data_hora = ?, tipo = ?, notas = ? WHERE id = ?
```
Update the SELECT after update to include `notas`.

No validation rule needed for `notas` — it is free-form optional text.

---

### Phase 1D — Frontend: `public/assets/app.js`

**1. Add `notas` to `formData`**:
```js
formData: { data_hora: '', tipo: '', notas: '', participante_ids: [], ... }
```

**2. Pre-populate on edit**:
```js
this.formData.notas = m.notas ?? ''
```

**3. Include in POST/PUT body**:
```js
notas: this.formData.notas || null
```

**4. Add `notasToHtml(text)` function**:

Converts stored plain text to safe HTML. Algorithm:
- HTML-escape `&`, `<`, `>`, `"` in the raw text
- Split into lines
- State machine: track whether inside a `<ul>` (top-level or nested)
- `#### text` → close any open list → `<h4>text</h4>`
- `  - text` (2+ spaces before `-`) → open nested `<ul>` if not open → `<li>text</li>`
- `- text` → close nested `<ul>` if open → open top `<ul>` if not open → `<li>text</li>`
- empty line → close any open lists
- other text → close any open lists → `<p>text</p>`

Return full HTML string. Bind to view modal via `x-html="notasToHtml(currentMeeting.notas)"`.

---

### Phase 1E — Frontend: `public/index.html`

**1. Meeting form (create + edit modal)** — add after pautas card:

```html
<!-- Notas -->
<div class="bg-white rounded-xl shadow-sm p-4">
  <h3 class="text-sm font-medium text-gray-700 mb-2">Notas</h3>
  <textarea
    x-model="formData.notas"
    rows="8"
    class="w-full text-sm font-mono border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    placeholder="- Item&#10;  - Sub-item&#10;#### Seção"
  ></textarea>
</div>
```

**2. Meeting view modal (info modal)** — add notas section after pautas display:

```html
<!-- Notas -->
<template x-if="currentMeeting.notas">
  <div>
    <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notas</h3>
    <div class="prose prose-sm max-w-none text-gray-700"
         x-html="notasToHtml(currentMeeting.notas)">
    </div>
  </div>
</template>
```

---

## Execution Order (from quickstart.md)

1. `npm run migrate` — applies `009_add_notas.sql`
2. `node docs/source/scripts/migrate_notas.js` — migrates CSV data
3. Implement backend changes (`meetings.js`)
4. Implement frontend changes (`app.js`, `index.html`)
5. Manual verification: view, edit, create
6. `git add` relevant files + `git commit` + `git push origin main`

**⚠️ Do NOT run `npm run migrate` again after the data script** — there is no follow-up drop-column migration for this feature.
