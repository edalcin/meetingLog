package server

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/edalcin/meetinglog/internal/security"
	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) handleListSharedLinks() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		links, err := store.ListShareLinks(s.db)
		if err != nil {
			log.Printf("handleListSharedLinks: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}
		for i := range links {
			links[i].URL = s.cfg.BaseURL + "p/" + links[i].Token
		}
		writeJSON(w, http.StatusOK, links)
	}
}

func (s *Server) handleCreateSharedLink() http.HandlerFunc {
	type request struct {
		FilterType  string `json:"filter_type"`
		FilterValue string `json:"filter_value"`
		Descricao   string `json:"descricao"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		if req.FilterType == "" {
			writeError(w, http.StatusBadRequest, "filter_type é obrigatório")
			return
		}

		token := security.NewHexToken(20)

		link, err := store.CreateShareLink(s.db, token, req.FilterType, req.FilterValue, req.Descricao)
		if handleStoreErr(w, err) {
			return
		}
		link.URL = s.cfg.BaseURL + "p/" + link.Token
		writeJSON(w, http.StatusCreated, link)
	}
}

func (s *Server) handleRevokeSharedLink() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		if err := store.RevokeShareLink(s.db, id); handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}
