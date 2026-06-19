//go:build ignore

// merge_import reads all batch_*.json files from a directory, merges them,
// sanitizes the HTML, and updates the SQLite database.
package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/edalcin/meetinglog/internal/security"
	_ "modernc.org/sqlite"
)

type Note struct {
	ID    int64  `json:"id"`
	Table string `json:"table"`
	HTML  string `json:"html"`
}

func main() {
	if len(os.Args) < 3 {
		log.Fatal("usage: go run merge_import.go <db-path> <reformatted-dir>")
	}
	dbPath, dir := os.Args[1], os.Args[2]

	files, err := filepath.Glob(filepath.Join(dir, "batch_*.json"))
	if err != nil || len(files) == 0 {
		log.Fatalf("no batch_*.json files in %s", dir)
	}
	sort.Strings(files)
	log.Printf("Found %d batch files", len(files))

	var all []Note
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			log.Printf("WARN: read %s: %v", f, err)
			continue
		}
		var batch []Note
		if err := json.Unmarshal(data, &batch); err != nil {
			log.Printf("WARN: parse %s: %v", f, err)
			continue
		}
		all = append(all, batch...)
	}
	log.Printf("Loaded %d notes total", len(all))

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	// Force DELETE journal mode so the result is a clean, WAL-free single file.
	// Without this, modernc.org/sqlite inherits WAL from the source DB and the
	// resulting file may be unreadable on a different OS/filesystem.
	if _, err := db.Exec("PRAGMA journal_mode = DELETE"); err != nil {
		log.Fatalf("PRAGMA journal_mode: %v", err)
	}

	allowed := map[string]bool{"reuniao": true, "projeto": true, "participante": true}
	updated, skipped, failed := 0, 0, 0
	for _, n := range all {
		if !allowed[n.Table] {
			log.Printf("SKIP id=%d: unknown table %q", n.ID, n.Table)
			skipped++
			continue
		}
		sanitized := security.SanitizeEditorHTML(n.HTML)
		if strings.TrimSpace(sanitized) == "" {
			log.Printf("SKIP %s id=%d: empty after sanitize", n.Table, n.ID)
			skipped++
			continue
		}
		if _, err := db.Exec("UPDATE "+n.Table+" SET notas = ? WHERE id = ?", sanitized, n.ID); err != nil {
			log.Printf("FAIL %s id=%d: %v", n.Table, n.ID, err)
			failed++
		} else {
			updated++
		}
	}
	log.Printf("Done. Updated=%d Skipped=%d Failed=%d", updated, skipped, failed)
}
