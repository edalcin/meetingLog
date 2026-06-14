package server

import (
	"context"
	"net/http"
	"strings"

	"github.com/edalcin/meetinglog/internal/sessions"
)

type contextKey int

const sessionKey contextKey = iota

const sessionCookieName = "meetinglog_session"

// AuthRequired is middleware that enforces authentication.
// On failure it returns 401 for /api/* routes and redirects to / otherwise.
func AuthRequired(store *sessions.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(sessionCookieName)
			if err != nil {
				respondUnauth(w, r)
				return
			}
			sess, ok := store.Get(cookie.Value)
			if !ok {
				respondUnauth(w, r)
				return
			}
			store.Touch(sess.ID)
			ctx := context.WithValue(r.Context(), sessionKey, sess)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// SessionFromContext returns the session stored in the context, or nil.
func SessionFromContext(ctx context.Context) *sessions.Session {
	sess, _ := ctx.Value(sessionKey).(*sessions.Session)
	return sess
}

func respondUnauth(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api") {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	http.Redirect(w, r, "/", http.StatusFound)
}
