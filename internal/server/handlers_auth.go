package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/edalcin/meetinglog/internal/security"
)

const sessionCookieMaxAge = 86400 * 30 // 30 days

func (s *Server) handleLogin() http.HandlerFunc {
	type request struct {
		PIN string `json:"pin"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.throttle.Allow(r) {
			ThrottleHeader(w, s.throttle.RetryAfter(r))
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad request")
			return
		}

		if !security.VerifyMaster(req.PIN, s.cfg.PIN) {
			s.throttle.RecordFailure(r)
			writeError(w, http.StatusUnauthorized, "PIN incorreto")
			return
		}

		s.throttle.RecordSuccess(r)

		sess := s.sessions.Create(r.RemoteAddr)
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    sess.ID,
			Path:     "/",
			HttpOnly: true,
			Secure:   false, // enforced by reverse proxy in production
			SameSite: http.SameSiteStrictMode,
			Expires:  time.Now().Add(sessionCookieMaxAge * time.Second),
			MaxAge:   sessionCookieMaxAge,
		})
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err == nil {
			s.sessions.Delete(cookie.Value)
		}
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Path:     "/",
			HttpOnly: true,
			MaxAge:   -1,
		})
		w.WriteHeader(http.StatusNoContent)
	}
}
