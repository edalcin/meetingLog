package server

import (
	"net/http"
	"strings"
	"time"

	"github.com/edalcin/meetinglog/internal/security"
)

const (
	csrfCookieName = "meetinglog_csrf"
	csrfHeaderName = "X-CSRF-Token"
)

// CSRF implements the double-submit cookie pattern.
// GET/HEAD/OPTIONS: set the csrf cookie if absent.
// Mutating methods: X-CSRF-Token header must match the cookie.
func CSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
			next.ServeHTTP(w, r)
			return
		}
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			ensureCSRFCookie(w, r)
			next.ServeHTTP(w, r)
		default:
			cookie, err := r.Cookie(csrfCookieName)
			if err != nil {
				http.Error(w, "missing CSRF cookie", http.StatusForbidden)
				return
			}
			header := r.Header.Get(csrfHeaderName)
			if !security.ConstantTimeEqual(cookie.Value, header) {
				http.Error(w, "CSRF token mismatch", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		}
	})
}

func ensureCSRFCookie(w http.ResponseWriter, r *http.Request) {
	if _, err := r.Cookie(csrfCookieName); err == nil {
		return
	}
	token := security.NewCSRFToken()
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: false, // JS must read this to put it in the header
		Secure:   false, // enforced by reverse proxy in production
		SameSite: http.SameSiteStrictMode,
		Expires:  time.Now().Add(24 * time.Hour),
	})
}
