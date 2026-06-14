package security

import (
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

var (
	editorPolicy      *bluemonday.Policy
	publicSharePolicy *bluemonday.Policy
)

func init() {
	// EditorPolicy: generous set for the rich editor — headings, lists,
	// bold/italic, blockquote. Matches the subset produced by TipTap starter-kit.
	editorPolicy = bluemonday.NewPolicy()
	editorPolicy.AllowElements(
		"h1", "h2", "h3", "h4",
		"p", "br", "hr",
		"strong", "em", "u", "s",
		"ul", "ol", "li",
		"blockquote",
		"pre", "code",
		"figure", "figcaption",
		"div", "span",
	)
	editorPolicy.AllowAttrs("href", "rel", "target").OnElements("a")
	editorPolicy.AllowURLSchemes("http", "https", "mailto")
	editorPolicy.AllowRelativeURLs(true)
	editorPolicy.AllowAttrs("src", "alt", "width", "height").OnElements("img")
	editorPolicy.AllowAttrs("class").OnElements("code", "pre", "span", "div")
	editorPolicy.AllowStyles("width", "height").
		Matching(regexp.MustCompile(`^\d+(%|px|em|rem|vw|vh)?$`)).
		OnElements("img", "figure")

	// PublicSharePolicy: tighter — no event handlers, no JS hrefs,
	// no style attributes, no data attributes.
	publicSharePolicy = bluemonday.NewPolicy()
	publicSharePolicy.AllowElements(
		"h1", "h2", "h3", "h4",
		"p", "br", "hr",
		"strong", "em", "u", "s",
		"ul", "ol", "li",
		"blockquote",
		"pre", "code",
	)
	publicSharePolicy.AllowAttrs("href", "rel").OnElements("a")
	publicSharePolicy.AllowURLSchemes("http", "https", "mailto")
	publicSharePolicy.AllowRelativeURLs(true)
	publicSharePolicy.AllowAttrs("src", "alt").OnElements("img")
}

// SanitizeEditorHTML sanitizes HTML from the TipTap editor before storing.
func SanitizeEditorHTML(html string) string {
	return editorPolicy.Sanitize(html)
}

// SanitizePublicHTML sanitizes HTML for the public share view.
func SanitizePublicHTML(html string) string {
	return publicSharePolicy.Sanitize(html)
}

// ExtractPlainText strips all HTML tags and returns plain text.
func ExtractPlainText(html string) string {
	stripped := bluemonday.StrictPolicy().Sanitize(html)
	parts := strings.Fields(stripped)
	return strings.Join(parts, " ")
}
