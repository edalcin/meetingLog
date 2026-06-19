//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type N struct {
	ID    int64  `json:"id"`
	Table string `json:"table"`
	HTML  string `json:"html"`
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func main() {
	f, _ := os.Open(os.Args[1])
	var notes []N
	json.NewDecoder(f).Decode(&notes)
	byTable := map[string]int{}
	maxLen, totalLen := 0, 0
	for _, n := range notes {
		byTable[n.Table]++
		totalLen += len(n.HTML)
		if len(n.HTML) > maxLen {
			maxLen = len(n.HTML)
		}
	}
	fmt.Printf("Total: %d\nPor tabela: %v\nHTML avg=%d max=%d bytes\n\nSample [0]:\n%s\n\nSample [5]:\n%s\n",
		len(notes), byTable, totalLen/len(notes), maxLen,
		notes[0].HTML[:min(400, len(notes[0].HTML))],
		notes[5].HTML[:min(400, len(notes[5].HTML))],
	)
}
