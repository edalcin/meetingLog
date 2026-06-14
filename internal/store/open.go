package store

import (
	"database/sql"
	"embed"
	"fmt"
	"log"
	"strings"

	"github.com/edalcin/meetinglog/internal/security"
	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaFS embed.FS

// Open opens the SQLite database at dbPath, applies required PRAGMAs, runs
// the embedded idempotent schema.sql, and performs any startup data migrations.
//
// The "file::memory:?cache=shared&mode=memory" URI is accepted for tests.
func Open(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("store.Open: %w", err)
	}

	// Single writer — prevents "database is locked" under WAL.
	db.SetMaxOpenConns(1)

	isMemory := strings.Contains(dbPath, ":memory:") || strings.Contains(dbPath, "mode=memory")

	if !isMemory {
		if _, err := db.Exec("PRAGMA journal_mode = WAL"); err != nil {
			db.Close()
			return nil, fmt.Errorf("store.Open pragma journal_mode: %w", err)
		}
		if _, err := db.Exec("PRAGMA synchronous = NORMAL"); err != nil {
			db.Close()
			return nil, fmt.Errorf("store.Open pragma synchronous: %w", err)
		}
	}

	for _, p := range []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
	} {
		if _, err := db.Exec(p); err != nil {
			db.Close()
			return nil, fmt.Errorf("store.Open pragma %q: %w", p, err)
		}
	}

	// Run the embedded schema in a transaction (all DDL uses IF NOT EXISTS — safe
	// to run against an already-initialised database).
	schema, err := schemaFS.ReadFile("schema.sql")
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("store.Open read schema: %w", err)
	}

	tx, err := db.Begin()
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("store.Open begin: %w", err)
	}
	if _, err := tx.Exec(string(schema)); err != nil {
		tx.Rollback()
		db.Close()
		return nil, fmt.Errorf("store.Open exec schema: %w", err)
	}
	if err := tx.Commit(); err != nil {
		db.Close()
		return nil, fmt.Errorf("store.Open commit: %w", err)
	}

	// Data migration: convert Quill Delta JSON notes to HTML for TipTap
	// compatibility. Idempotent — already-HTML values are not re-converted.
	if err := backfillDeltaToHTML(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("store.Open delta backfill: %w", err)
	}

	return db, nil
}

// backfillDeltaToHTML converts any remaining Quill Delta notes to sanitized
// HTML across the three tables that have a `notas` column: reuniao, participante,
// projeto. Called once at startup; idempotent because converted HTML will not
// re-parse as a Delta.
func backfillDeltaToHTML(db *sql.DB) error {
	tables := []string{"reuniao", "participante", "projeto"}
	total := 0

	for _, tbl := range tables {
		rows, err := db.Query(fmt.Sprintf("SELECT id, notas FROM %s WHERE notas IS NOT NULL", tbl))
		if err != nil {
			return fmt.Errorf("backfill query %s: %w", tbl, err)
		}

		type notasRow struct {
			id    int64
			notas string
		}
		var toConvert []notasRow
		for rows.Next() {
			var id int64
			var notas string
			if err := rows.Scan(&id, &notas); err != nil {
				rows.Close()
				return fmt.Errorf("backfill scan %s: %w", tbl, err)
			}
			if isDelta(notas) {
				toConvert = append(toConvert, notasRow{id, notas})
			}
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return fmt.Errorf("backfill rows %s: %w", tbl, err)
		}

		for _, r := range toConvert {
			html, err := deltaToHTML(r.notas)
			if err != nil {
				// Log and skip — don't fail startup for one bad row.
				log.Printf("warn: backfill %s id=%d: %v — storing as plain text", tbl, r.id, err)
				html = "<p>" + security.SanitizeEditorHTML(r.notas) + "</p>"
			}
			sanitized := security.SanitizeEditorHTML(html)
			if _, err := db.Exec(
				fmt.Sprintf("UPDATE %s SET notas = ? WHERE id = ?", tbl),
				sanitized, r.id,
			); err != nil {
				return fmt.Errorf("backfill update %s id=%d: %w", tbl, r.id, err)
			}
			total++
		}
	}

	if total > 0 {
		log.Printf("store: converted %d Quill Delta notes to HTML", total)
	}
	return nil
}
