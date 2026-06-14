package server

import (
	"log"
	"net/http"

	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) handleDashboardOptions() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		opts, err := store.GetDashboardOptions(s.db)
		if err != nil {
			log.Printf("handleDashboardOptions: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}
		writeJSON(w, http.StatusOK, opts)
	}
}

func (s *Server) handleDashboard() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter := r.URL.Query().Get("filter")
		value := r.URL.Query().Get("value")

		data, err := store.GetDashboardData(s.db, filter, value)
		if err != nil {
			log.Printf("handleDashboard: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}
		writeJSON(w, http.StatusOK, data)
	}
}
