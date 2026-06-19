// reformat-notes is a one-off migration tool that converts Quill Delta JSON
// notes to HTML and then uses the Claude API to reformat them for TipTap.
//
// Usage:
//
//	ANTHROPIC_API_KEY=sk-... go run ./cmd/reformat-notes --db ./data/meetinglog.sqlite
//	ANTHROPIC_API_KEY=sk-... go run ./cmd/reformat-notes --db ./data/meetinglog.sqlite --dry-run
//	ANTHROPIC_API_KEY=sk-... go run ./cmd/reformat-notes --db ./data/meetinglog.sqlite --limit 10
package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/edalcin/meetinglog/internal/security"
	"github.com/edalcin/meetinglog/internal/store"
	_ "modernc.org/sqlite"
)

const apiURL = "https://api.anthropic.com/v1/messages"
const model = "claude-haiku-4-5-20251001"

const systemPrompt = `You are a formatting assistant for meeting notes stored in a database.

Input: HTML content from a rich text editor (may be plain HTML, structured HTML, or poorly formatted).
Task: Return clean, well-structured HTML that renders beautifully in TipTap rich text editor.

Rules:
- Use <h2> or <h3> for section titles and headings (never <h1>)
- Use <ul><li> for bullet point lists
- Use <ol><li> for numbered or sequential lists
- Use <strong> for important terms
- Use <p> for regular paragraph text
- Use <blockquote> for quotes or cited content
- PRESERVE ALL CONTENT — never add, summarize, or remove any information
- Fix broken or missing structure (convert plain text that looks like a list into <ul><li>)
- Return ONLY the HTML markup — no explanation, no markdown, no code fences
- If the content is already clean and well-structured, return it with minimal changes`

type noteRow struct {
	id    int64
	notas string
	table string
}

type claudeReq struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system"`
	Messages  []msgItem `json:"messages"`
}

type msgItem struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResp struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

func callClaude(apiKey, html string) (string, error) {
	reqBody := claudeReq{
		Model:     model,
		MaxTokens: 2048,
		System:    systemPrompt,
		Messages:  []msgItem{{Role: "user", Content: html}},
	}
	body, _ := json.Marshal(reqBody)

	req, err := http.NewRequest("POST", apiURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// Retry on rate limit
	if resp.StatusCode == 429 {
		time.Sleep(5 * time.Second)
		return callClaude(apiKey, html)
	}

	respBody, _ := io.ReadAll(resp.Body)
	var cr claudeResp
	if err := json.Unmarshal(respBody, &cr); err != nil {
		return "", fmt.Errorf("decode: %w (status %d)", err, resp.StatusCode)
	}
	if cr.Error != nil {
		return "", fmt.Errorf("api %s: %s", cr.Error.Type, cr.Error.Message)
	}
	if len(cr.Content) == 0 {
		return "", fmt.Errorf("empty response (status %d)", resp.StatusCode)
	}

	return stripFences(cr.Content[0].Text), nil
}

// stripFences removes ```html ... ``` or ``` ... ``` wrappers the model might return.
func stripFences(s string) string {
	s = strings.TrimSpace(s)
	for _, prefix := range []string{"```html\n", "```html", "```\n", "```"} {
		if strings.HasPrefix(s, prefix) {
			s = strings.TrimPrefix(s, prefix)
			s = strings.TrimSuffix(s, "```")
			return strings.TrimSpace(s)
		}
	}
	return s
}

func collectRows(db *sql.DB, table string) ([]noteRow, error) {
	rows, err := db.Query(
		"SELECT id, notas FROM "+table+" WHERE notas IS NOT NULL AND notas != ''",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []noteRow
	for rows.Next() {
		var r noteRow
		r.table = table
		if err := rows.Scan(&r.id, &r.notas); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func main() {
	dbPath := flag.String("db", "", "SQLite database path (required)")
	dryRun := flag.Bool("dry-run", false, "Print changes without writing to DB")
	limit := flag.Int("limit", 0, "Process only first N notes (0 = all)")
	flag.Parse()

	if *dbPath == "" {
		log.Fatal("--db is required")
	}
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		log.Fatal("ANTHROPIC_API_KEY env var not set")
	}

	db, err := sql.Open("sqlite", *dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	// Collect notes from all tables that have a notas column
	var all []noteRow
	for _, tbl := range []string{"reuniao", "projeto", "participante"} {
		rows, err := collectRows(db, tbl)
		if err != nil {
			log.Printf("warn: collect %s: %v", tbl, err)
			continue
		}
		all = append(all, rows...)
	}

	if *limit > 0 && *limit < len(all) {
		all = all[:*limit]
	}

	log.Printf("Processing %d notes (dry-run=%v)", len(all), *dryRun)

	var updated, skipped, failed int

	for i, row := range all {
		prefix := fmt.Sprintf("[%d/%d] %s id=%d", i+1, len(all), row.table, row.id)

		// Step 1: Delta → HTML if needed
		html := row.notas
		if store.IsDelta(html) {
			converted, err := store.DeltaToHTML(html)
			if err != nil {
				log.Printf("%s: delta conversion failed: %v — skipping", prefix, err)
				failed++
				continue
			}
			html = converted
		}

		// Step 2: skip truly empty content
		plain := security.ExtractPlainText(html)
		if strings.TrimSpace(plain) == "" {
			log.Printf("%s: empty content — skipping", prefix)
			skipped++
			continue
		}

		// Step 3: AI reformat
		reformatted, err := callClaude(apiKey, html)
		if err != nil {
			log.Printf("%s: AI error: %v — saving mechanical HTML only", prefix, err)
			if !*dryRun && row.notas != html {
				db.Exec("UPDATE "+row.table+" SET notas = ? WHERE id = ?", html, row.id)
				updated++
			}
			failed++
			time.Sleep(500 * time.Millisecond)
			continue
		}

		// Step 4: sanitize AI output
		sanitized := security.SanitizeEditorHTML(reformatted)
		if strings.TrimSpace(sanitized) == "" {
			log.Printf("%s: AI returned empty after sanitize — skipping", prefix)
			skipped++
			continue
		}

		if *dryRun {
			preview := sanitized
			if len(preview) > 300 {
				preview = preview[:300] + "..."
			}
			fmt.Printf("\n%s\nBEFORE: %s\nAFTER:  %s\n",
				prefix,
				row.notas[:min(120, len(row.notas))],
				preview,
			)
		} else {
			if _, err := db.Exec(
				"UPDATE "+row.table+" SET notas = ? WHERE id = ?",
				sanitized, row.id,
			); err != nil {
				log.Printf("%s: db update failed: %v", prefix, err)
				failed++
			} else {
				log.Printf("%s: OK", prefix)
				updated++
			}
		}

		// Polite rate limiting
		time.Sleep(120 * time.Millisecond)
	}

	log.Printf("\nDone. Updated=%d Skipped=%d Failed=%d", updated, skipped, failed)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
