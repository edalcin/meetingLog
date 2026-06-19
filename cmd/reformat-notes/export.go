//go:build ignore

package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"

	"github.com/edalcin/meetinglog/internal/store"
	_ "modernc.org/sqlite"
)

type ExportNote struct {
	ID    int64  `json:"id"`
	Table string `json:"table"`
	HTML  string `json:"html"`
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: go run export.go <db-path>")
	}
	db, err := sql.Open("sqlite", os.Args[1])
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	var notes []ExportNote
	for _, tbl := range []string{"reuniao", "projeto", "participante"} {
		rows, err := db.Query("SELECT id, notas FROM " + tbl + " WHERE notas IS NOT NULL AND TRIM(notas) != ''")
		if err != nil {
			log.Printf("warn: %s: %v", tbl, err)
			continue
		}
		for rows.Next() {
			var n ExportNote
			var raw string
			if err := rows.Scan(&n.ID, &raw); err != nil {
				continue
			}
			n.Table = tbl
			if store.IsDelta(raw) {
				html, err := store.DeltaToHTML(raw)
				if err != nil {
					n.HTML = "<p>" + raw + "</p>"
				} else {
					n.HTML = html
				}
			} else {
				n.HTML = raw
			}
			notes = append(notes, n)
		}
		rows.Close()
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.Encode(notes)
	log.Printf("Exported %d notes", len(notes))
}
