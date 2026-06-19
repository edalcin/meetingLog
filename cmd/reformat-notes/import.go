//go:build ignore

package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"strings"

	"github.com/edalcin/meetinglog/internal/security"
	_ "modernc.org/sqlite"
)

type ImportNote struct {
	ID    int64  `json:"id"`
	Table string `json:"table"`
	HTML  string `json:"html"`
}

func main() {
	if len(os.Args) < 3 {
		log.Fatal("usage: go run import.go <db-path> <reformatted-json>")
	}
	db, err := sql.Open("sqlite", os.Args[1])
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	f, err := os.Open(os.Args[2])
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	var notes []ImportNote
	if err := json.NewDecoder(f).Decode(&notes); err != nil {
		log.Fatal(err)
	}

	updated, skipped, failed := 0, 0, 0
	for _, n := range notes {
		sanitized := security.SanitizeEditorHTML(n.HTML)
		if strings.TrimSpace(sanitized) == "" {
			log.Printf("SKIP %s id=%d: empty after sanitize", n.Table, n.ID)
			skipped++
			continue
		}
		allowed := map[string]bool{"reuniao": true, "projeto": true, "participante": true}
		if !allowed[n.Table] {
			log.Printf("SKIP id=%d: unknown table %q", n.ID, n.Table)
			skipped++
			continue
		}
		_, err := db.Exec("UPDATE "+n.Table+" SET notas = ? WHERE id = ?", sanitized, n.ID)
		if err != nil {
			log.Printf("FAIL %s id=%d: %v", n.Table, n.ID, err)
			failed++
		} else {
			updated++
		}
	}
	log.Printf("Done. Updated=%d Skipped=%d Failed=%d", updated, skipped, failed)
}
