# Data Model: Add Notas Field — Feature 005

**Generated**: 2026-03-19

## Schema Change

### `reuniao` table — new column

```sql
ALTER TABLE reuniao
  ADD COLUMN notas TEXT NULL AFTER tipo;
```

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `notas` | `TEXT` | YES | NULL | Plain text with markdown-style markers. Optional. |

**No new tables. No new junction tables. No column drops.**

---

## Data Flow

### Migration source

| Field in CSV | Format | Maps to |
|---|---|---|
| `data` | `YYYY-MM-DD HH:MM:SS` (tab-sep column 1) | `DATE_FORMAT(reuniao.data_hora, '%Y-%m-%d %H:%i:%s')` |
| `notasMD` | plain text, possibly double-quoted | `reuniao.notas` |

**Matching key**: exact full datetime string (`YYYY-MM-DD HH:MM:SS`).

**Conflict rule**: If two CSV rows have the exact same datetime, the first row is applied and subsequent duplicates are skipped with a log warning.

**No-match rule**: If a CSV row's datetime has no corresponding `reuniao` record, skip and log a warning. Do not fail.

---

## API Impact

| Endpoint | Change |
|----------|--------|
| `GET /api/meetings` (list) | `notas` NOT included (bandwidth concern for large text in paginated list) |
| `GET /api/meetings/:id` | Add `notas` to SELECT and response |
| `POST /api/meetings` | Accept optional `notas` string in request body; include in INSERT |
| `PUT /api/meetings/:id` | Accept optional `notas` string in request body; include in UPDATE |

---

## Validation Rules

- `notas` is optional (`null` / empty string both accepted)
- No max length enforced at application level (TEXT type allows ~64KB; LONGTEXT would allow more, but TEXT is sufficient for meeting notes)
- No format validation — free-form text

---

## Rendering Contract (Frontend)

The `notasToHtml(text)` function must convert stored plain text to safe HTML for display in the view modal:

| Input pattern | Output |
|---|---|
| `#### heading text` | `<h4>heading text</h4>` |
| `- top-level item` | `<li>` in outer `<ul>` |
| `  - indented item` (2+ spaces) | `<li>` in nested `<ul>` |
| Empty line | Close current list; start new block |
| Other text | `<p>text</p>` |
| `&`, `<`, `>`, `"` | HTML-escaped before parsing |
