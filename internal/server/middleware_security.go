package server

import "net/http"

// SecurityHeaders adds standard hardening headers to every response.
// The SPA CSP allows no CDN; all assets are bundled and served from self.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Permissions-Policy", "interest-cohort=()")
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		h.Set("Content-Security-Policy", cspSPA)
		next.ServeHTTP(w, r)
	})
}

// PublicShareCSP overrides the CSP with the stricter public-share policy.
func PublicShareCSP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", cspPublicShare)
		next.ServeHTTP(w, r)
	})
}

// FileContentCSP allows the file content to be embedded in an iframe on the
// same origin. Applied only to GET /api/files/{id}/content.
func FileContentCSP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Content-Security-Policy", cspFileContent)
		next.ServeHTTP(w, r)
	})
}

const cspSPA = "default-src 'self'; " +
	"script-src 'self'; " +
	"img-src 'self' data: blob:; " +
	"style-src 'self' 'unsafe-inline'; " +
	"connect-src 'self'; " +
	"font-src 'self'; " +
	"object-src 'self'; " +
	"frame-src 'self'; " +
	"frame-ancestors 'none'; " +
	"base-uri 'self'; " +
	"form-action 'self'"

// cspFileContent loosens frame-ancestors for the inline file viewer.
const cspFileContent = "default-src 'none'; " +
	"img-src 'self'; " +
	"style-src 'self' 'unsafe-inline'; " +
	"frame-ancestors 'self'"

const cspPublicShare = "default-src 'none'; " +
	"script-src 'none'; " +
	"img-src 'self' data:; " +
	"style-src 'unsafe-inline'; " +
	"frame-ancestors 'none'; " +
	"base-uri 'none'"
