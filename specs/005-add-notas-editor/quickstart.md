# Quickstart: Add Notas Field — Feature 005

**⚠️ Execution order is critical. Follow exactly.**

---

## Step 1 — Apply database migration

```bash
npm run migrate
```

This applies `009_add_notas.sql` which adds the `notas TEXT NULL` column to `reuniao`.

**Expected output**: `Applied: 009_add_notas.sql`

---

## Step 2 — Run the historical data migration script

```bash
node docs/source/scripts/migrate_notas.js
```

This reads `docs/source/memoriaReunioes-Notas.csv`, matches each row to a `reuniao` record by full datetime, and runs `UPDATE reuniao SET notas = ? WHERE ...`.

**Expected output**: A line per processed row: `✅ Updated: 2026-03-13 14:00:00` or `⚠️ No match: 2026-03-10 10:00:00`

---

## Step 3 — Verify in the application

1. Start dev server: `npm run dev`
2. Open a meeting that had notes in the CSV
3. Confirm notes are displayed formatted in the view modal
4. Create a new meeting with notes — confirm they save and display correctly
5. Edit an existing meeting's notes — confirm update persists

---

## Notes

- The migration script in `docs/source/scripts/` is **never committed** (directory is in `.gitignore`).
- There is **no "drop column" follow-up migration** — `notas` is a new column, nothing to remove.
- If the migration script needs to be re-run (idempotent: UPDATE is safe to repeat — it overwrites with the same value), just run Step 2 again.
