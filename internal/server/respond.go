package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/edalcin/meetinglog/internal/store"
)

// writeJSON writes v as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// parseID parses a chi URL param named "id" as a positive int64.
// Returns (0, false) and writes a 400 response if invalid.
func parseID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	raw := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "ID inválido")
		return 0, false
	}
	return id, true
}

// parseIntParam parses a named query param as int. Returns def if missing/invalid.
func parseIntParam(r *http.Request, name string, def, min, max int) int {
	v := r.URL.Query().Get(name)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	if n < min {
		return min
	}
	if n > max {
		return max
	}
	return n
}

// parseIDList parses a comma-separated list of positive int64s.
func parseIDList(raw string) []int64 {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	var ids []int64
	for _, p := range parts {
		n, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64)
		if err != nil || n <= 0 {
			continue
		}
		ids = append(ids, n)
	}
	return ids
}

// handleStoreErr translates store sentinel errors to HTTP responses.
// Returns true if the error was handled (caller should return); false if err is nil.
func handleStoreErr(w http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "não encontrado")
		return true
	}
	if errors.Is(err, store.ErrConflict) {
		writeError(w, http.StatusConflict, err.Error())
		return true
	}
	if errors.Is(err, store.ErrLinked) {
		writeError(w, http.StatusConflict, err.Error())
		return true
	}
	http.Error(w, "erro interno", http.StatusInternalServerError)
	return true
}
