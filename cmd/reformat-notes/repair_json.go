//go:build ignore

// repair_json fixes JSON files with unescaped double-quotes or literal control chars
// inside string values, writing the corrected file to <input>.fixed.json
package main

import (
	"bytes"
	"encoding/json"
	"log"
	"os"
	"unicode"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: go run repair_json.go <file.json>")
	}
	for _, path := range os.Args[1:] {
		fixed, err := repairJSON(path)
		if err != nil {
			log.Printf("FAIL %s: %v", path, err)
			continue
		}
		out := path[:len(path)-len(".json")] + ".fixed.json"
		if err := os.WriteFile(out, fixed, 0644); err != nil {
			log.Printf("FAIL write %s: %v", out, err)
			continue
		}
		var v interface{}
		if err := json.Unmarshal(fixed, &v); err != nil {
			log.Printf("WARN %s: still invalid after repair: %v", path, err)
		} else {
			log.Printf("OK %s -> %s", path, out)
		}
	}
}

// repairJSON scans raw JSON bytes and fixes two classes of bugs inside string literals:
//
//  1. Literal control characters (newline, CR, tab) — replace with JSON escape sequences.
//
//  2. Unescaped double-quote inside a string value — detected via lookahead:
//     after a `"` that would "close" the string, if the next non-whitespace byte
//     is NOT a valid JSON structural character (`,` `}` `]` `:`) we treat the quote
//     as HTML content and emit `&quot;` instead of closing the string.
func repairJSON(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var out bytes.Buffer
	out.Grow(len(data) + 1024)

	i := 0
	inString := false
	escaped := false

	for i < len(data) {
		b := data[i]

		if escaped {
			out.WriteByte(b)
			escaped = false
			i++
			continue
		}

		if b == '\\' {
			out.WriteByte(b)
			if inString {
				escaped = true
			}
			i++
			continue
		}

		if b == '"' {
			if !inString {
				inString = true
				out.WriteByte(b)
				i++
				continue
			}
			// Potentially closing the string — peek ahead.
			next := nextNonSpace(data, i+1)
			if isJSONStructural(next) {
				// Normal close.
				inString = false
				out.WriteByte(b)
				i++
				continue
			}
			// Unescaped quote inside HTML content — emit as &quot;
			out.WriteString("&quot;")
			i++
			continue
		}

		if inString {
			switch b {
			case 0x0A:
				out.WriteString(`\n`)
			case 0x0D:
				out.WriteString(`\r`)
			case 0x09:
				out.WriteString(`\t`)
			default:
				out.WriteByte(b)
			}
		} else {
			out.WriteByte(b)
		}
		i++
	}

	return out.Bytes(), nil
}

// nextNonSpace returns the first non-whitespace byte after position start, or 0.
func nextNonSpace(data []byte, start int) byte {
	for i := start; i < len(data); i++ {
		if !unicode.IsSpace(rune(data[i])) {
			return data[i]
		}
	}
	return 0
}

// isJSONStructural returns true for bytes that can legally follow a closed string value.
func isJSONStructural(b byte) bool {
	return b == ',' || b == '}' || b == ']' || b == ':' || b == 0
}
