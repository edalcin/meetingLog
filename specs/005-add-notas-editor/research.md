# Research: Add Notas Field — Feature 005

**Generated**: 2026-03-19
**Feature**: 005-add-notas-editor

## Decision Log

### D-001: Migration approach — Node.js script vs SQL UPDATE

**Decision**: Node.js script (`migrate_notas.js`) using `mysql2/promise`

**Rationale**: The CSV requires parsing (tab-separated, double-quote wrapping, escaped `""` inside quotes). A SQL-only `LOAD DATA INFILE` cannot handle this reliably without pre-processing. A Node.js script already has access to the database pool pattern established in this project and handles string edge cases cleanly.

**Alternatives considered**:
- Pure SQL `LOAD DATA INFILE`: Rejected — cannot handle the quoted multiline text or the per-row matching logic.
- Python/pandas script: Rejected — no Python toolchain exists in this project; adding one violates the simplicity principle.

---

### D-002: CSV format confirmation

**Decision**: Tab-separated (`\t`), **not** semicolon-separated as the project constitution standard (§III.1).

**Rationale**: Direct inspection of `docs/source/memoriaReunioes-Notas.csv` confirms two tab-separated columns: `data` and `notasMD`. This file predates the `;` convention. The migration script must use `\t` as the delimiter.

**Note for constitution**: The `memoriaReunioes-Notas.csv` file is a non-conformant legacy source. No corrective action needed — it is a one-time migration source.

---

### D-003: Datetime matching format in MariaDB

**Decision**: Use `DATE_FORMAT(data_hora, '%Y-%m-%d %H:%i:%s')` (space separator, matching CSV format) for the SQL WHERE clause in the migration script.

**Rationale**: The CSV `data` values use format `2026-03-10 15:00:00` (space, not `T`). The constitution §II.4 mentions `DATE_FORMAT(data_hora,'%Y-%m-%dT%H:%i:%s')` but that uses an ISO `T` separator which would not match. The space format aligns with both the CSV source and standard `DATETIME` display in MariaDB.

**Alternatives considered**:
- Strip/replace in JavaScript: Parse `data_hora` in JS and construct a WHERE clause using parameterized `BETWEEN`. Rejected — unnecessary complexity; MariaDB `DATE_FORMAT` is cleaner.

---

### D-004: Client-side markdown-to-HTML rendering

**Decision**: Custom lightweight `notasToHtml()` function in `public/assets/app.js` — no external library.

**Rationale**: The note format is minimal and well-defined: only `#### headings`, `- bullet items`, and indented `  - sub-items`. A 20-line parser handles 100% of the historical data without adding dependencies. Constitution §I.2 prohibits any npm install for frontend.

**Supported transformations**:
- `#### text` → `<h4>text</h4>`
- `- text` (zero indent) → top-level `<li>` inside `<ul>`
- `  - text` (2-space indent) → nested `<li>` inside child `<ul>`
- Empty line → visual spacing between sections
- All other text → wrapped in `<p>`

**XSS note**: The `notas` content comes from the application's own database, authored by the single authenticated user. Simple HTML escaping of `&`, `<`, `>`, `"` before parsing is sufficient.

---

### D-005: No new associated table needed

**Decision**: Add `notas TEXT NULL` directly to `reuniao`. No junction table, no new route file.

**Rationale**: Notes belong exclusively to one meeting (1:1). There is no requirement to share or reuse notes across meetings. A direct column is the simplest correct solution (constitution §I.1).

---

### D-006: Migration number

**Decision**: Next migration is `009_add_notas.sql`.

**Rationale**: Last existing migration is `008_add_pauta.sql`. No "drop column" follow-up is needed since `notas` is a new column (nothing to remove).
