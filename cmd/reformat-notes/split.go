//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
)

type Note struct {
	ID    int64  `json:"id"`
	Table string `json:"table"`
	HTML  string `json:"html"`
}

func main() {
	if len(os.Args) < 3 {
		log.Fatal("usage: go run split.go <input.json> <out-dir> [batch-size]")
	}
	input, outDir := os.Args[1], os.Args[2]
	batchSize := 15
	if len(os.Args) > 3 {
		fmt.Sscanf(os.Args[3], "%d", &batchSize)
	}

	f, err := os.Open(input)
	if err != nil {
		log.Fatal(err)
	}
	var notes []Note
	if err := json.NewDecoder(f).Decode(&notes); err != nil {
		log.Fatal(err)
	}
	f.Close()

	os.MkdirAll(outDir, 0755)

	n := 0
	for i := 0; i < len(notes); i += batchSize {
		end := i + batchSize
		if end > len(notes) {
			end = len(notes)
		}
		batch := notes[i:end]
		path := filepath.Join(outDir, fmt.Sprintf("batch_%03d.json", n))
		out, _ := os.Create(path)
		enc := json.NewEncoder(out)
		enc.SetIndent("", "  ")
		enc.Encode(batch)
		out.Close()
		log.Printf("batch_%03d.json: %d notes", n, len(batch))
		n++
	}
	log.Printf("Done: %d batches, %d notes total", n, len(notes))
}
