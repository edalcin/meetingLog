package store

import (
	"encoding/json"
	"fmt"
	"strings"
)

// quillOp represents one Quill Delta op: {insert: string, attributes?: {...}}
type quillOp struct {
	Insert     string         `json:"insert"`
	Attributes map[string]any `json:"attributes,omitempty"`
}

type quillDelta struct {
	Ops []quillOp `json:"ops"`
}

// isDelta reports whether s looks like a Quill Delta JSON string.
// Idempotent check: converted HTML will not re-parse as a delta.
func isDelta(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) < 2 || s[0] != '{' {
		return false
	}
	var d quillDelta
	if err := json.Unmarshal([]byte(s), &d); err != nil {
		return false
	}
	return d.Ops != nil
}

// deltaToHTML converts a Quill Delta JSON string to HTML.
// Only the attribute subset used in meetingLog data is handled:
//   - header: 1..4          → <h1>…</h4>
//   - list: "bullet"        → <li> inside <ul>
//   - list: "ordered"       → <li> inside <ol>
//   - indent: 1             → nested <ul> (one level, bullet only)
//   - bold: true            → <strong>
//   - italic: true          → <em>
//
// For any unrecognised attribute, the text is emitted as a plain paragraph
// so data is never silently dropped.
func deltaToHTML(deltaJSON string) (string, error) {
	var d quillDelta
	if err := json.Unmarshal([]byte(deltaJSON), &d); err != nil {
		return "", fmt.Errorf("quilldelta: unmarshal: %w", err)
	}

	// Split the op stream into logical lines. Each newline op that carries
	// block-level attributes (header, list) terminates one block. Plain text
	// accumulates across ops until the next newline.
	type line struct {
		text  string // inline HTML fragments
		attrs map[string]any
	}

	var lines []line
	var buf strings.Builder // collects inline content for the current line

	for _, op := range d.Ops {
		// Only string inserts are meaningful (no embed ops in this data).
		text := op.Insert
		if text == "" {
			continue
		}

		// Walk through the insert character by character, splitting on '\n'.
		// Each '\n' that the op itself contains can also carry block attributes.
		parts := strings.Split(text, "\n")
		for i, part := range parts {
			if i > 0 {
				// The '\n' between parts[i-1] and parts[i] is an implicit newline
				// op. Since it's mid-insert (no attributes), treat as paragraph end.
				lines = append(lines, line{text: buf.String(), attrs: nil})
				buf.Reset()
			}
			// Wrap inline text with bold/italic if set.
			if part != "" {
				buf.WriteString(inlineWrap(htmlEsc(part), op.Attributes))
			}
		}

		// If the op's own text ends with a newline (len(parts)-1 segments), the
		// last split part is "" and we already emitted a line above. But if the
		// op carries block attributes (header/list) AND ends with "\n", we need
		// to finalize that line with those block attrs. The tricky case: Quill
		// always emits the block attrs on the '\n' op AFTER the text ops. So
		// check: does this op end in "\n" and carry block attrs?
		if strings.HasSuffix(text, "\n") && len(op.Attributes) > 0 {
			// Override the last emitted line's attrs with this op's block attrs.
			if len(lines) > 0 {
				lines[len(lines)-1].attrs = op.Attributes
			}
		}
	}

	// Flush any trailing content that didn't end with '\n'.
	if buf.Len() > 0 {
		lines = append(lines, line{text: buf.String(), attrs: nil})
	}

	// Render lines to HTML, grouping consecutive list items under <ul>/<ol>.
	var sb strings.Builder
	i := 0
	for i < len(lines) {
		l := lines[i]
		listType, isList := listTag(l.attrs)

		if isList {
			// Open the list wrapper and collect consecutive same-type items.
			sb.WriteString("<" + listType + ">")
			for i < len(lines) {
				cl := lines[i]
				clType, clIsList := listTag(cl.attrs)
				if !clIsList || clType != listType {
					break
				}
				indent := intAttr(cl.attrs, "indent")
				if indent > 0 {
					sb.WriteString("<li><ul><li>")
					sb.WriteString(cl.text)
					sb.WriteString("</li></ul></li>")
				} else {
					sb.WriteString("<li>")
					sb.WriteString(cl.text)
					sb.WriteString("</li>")
				}
				i++
			}
			sb.WriteString("</" + listType + ">")
			continue
		}

		if h := headerLevel(l.attrs); h > 0 {
			fmt.Fprintf(&sb, "<h%d>%s</h%d>", h, l.text, h)
		} else if l.text == "" {
			// Blank line becomes a paragraph with &nbsp; to preserve spacing.
			sb.WriteString("<p></p>")
		} else {
			sb.WriteString("<p>")
			sb.WriteString(l.text)
			sb.WriteString("</p>")
		}
		i++
	}

	return sb.String(), nil
}

// inlineWrap wraps text with inline HTML tags based on attributes.
func inlineWrap(text string, attrs map[string]any) string {
	if len(attrs) == 0 {
		return text
	}
	if b, _ := attrs["bold"].(bool); b {
		text = "<strong>" + text + "</strong>"
	}
	if it, _ := attrs["italic"].(bool); it {
		text = "<em>" + text + "</em>"
	}
	return text
}

func headerLevel(attrs map[string]any) int {
	if attrs == nil {
		return 0
	}
	v, ok := attrs["header"]
	if !ok {
		return 0
	}
	switch t := v.(type) {
	case float64:
		n := int(t)
		if n >= 1 && n <= 4 {
			return n
		}
	case int:
		if t >= 1 && t <= 4 {
			return t
		}
	}
	return 0
}

func listTag(attrs map[string]any) (string, bool) {
	if attrs == nil {
		return "", false
	}
	v, ok := attrs["list"]
	if !ok {
		return "", false
	}
	s, _ := v.(string)
	switch s {
	case "ordered":
		return "ol", true
	case "bullet":
		return "ul", true
	}
	return "", false
}

func intAttr(attrs map[string]any, key string) int {
	if attrs == nil {
		return 0
	}
	v, ok := attrs[key]
	if !ok {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	}
	return 0
}

func htmlEsc(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	return s
}
