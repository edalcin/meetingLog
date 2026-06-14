package server

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) handleGetPublicLink() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := chi.URLParam(r, "token")
		if token == "" {
			writeError(w, http.StatusBadRequest, "token inválido")
			return
		}

		link, err := store.GetShareLinkByToken(s.db, token)
		if handleStoreErr(w, err) {
			return
		}
		if link.Revogado {
			writeError(w, http.StatusNotFound, "link revogado ou não encontrado")
			return
		}

		link.URL = s.cfg.BaseURL + "p/" + link.Token
		writeJSON(w, http.StatusOK, link)
	}
}

func (s *Server) handlePublicMeetings() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := chi.URLParam(r, "token")
		if token == "" {
			writeError(w, http.StatusBadRequest, "token inválido")
			return
		}

		link, err := store.GetShareLinkByToken(s.db, token)
		if handleStoreErr(w, err) {
			return
		}
		if link.Revogado {
			writeError(w, http.StatusNotFound, "link revogado ou não encontrado")
			return
		}

		// Resolve the filter from the share link into participant/project ID lists.
		var partIDs, projIDs []int64
		switch link.FilterType {
		case "participant":
			ids := parseIDList(link.FilterValue)
			partIDs = ids
		case "project":
			ids := parseIDList(link.FilterValue)
			projIDs = ids
		}

		meetings, total, err := store.ListMeetings(s.db, partIDs, projIDs, "data_hora", "DESC", 1, 200)
		if err != nil {
			log.Printf("handlePublicMeetings ListMeetings: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"data":  meetings,
			"total": total,
		})
	}
}
