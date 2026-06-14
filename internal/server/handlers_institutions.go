package server

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) handleListInstitutions() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		limit := parseIntParam(r, "limit", 200, 1, 1000)

		institutions, total, err := store.ListInstitutions(s.db, q, limit)
		if err != nil {
			log.Printf("handleListInstitutions: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"data":  institutions,
			"total": total,
		})
	}
}

func (s *Server) handleGetInstitution() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		inst, err := store.GetInstitution(s.db, id)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, inst)
	}
}

func (s *Server) handleCreateInstitution() http.HandlerFunc {
	type request struct {
		Sigla string  `json:"sigla"`
		Nome  *string `json:"nome"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		if req.Sigla == "" {
			writeError(w, http.StatusBadRequest, "sigla é obrigatória")
			return
		}
		inst, err := store.CreateInstitution(s.db, req.Sigla, req.Nome)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusCreated, inst)
	}
}

func (s *Server) handleUpdateInstitution() http.HandlerFunc {
	type request struct {
		Sigla string  `json:"sigla"`
		Nome  *string `json:"nome"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		if req.Sigla == "" {
			writeError(w, http.StatusBadRequest, "sigla é obrigatória")
			return
		}
		inst, oldSigla, err := store.UpdateInstitution(s.db, id, req.Sigla, req.Nome)
		if handleStoreErr(w, err) {
			return
		}
		inst.OldSigla = oldSigla
		writeJSON(w, http.StatusOK, inst)
	}
}

func (s *Server) handleDeleteInstitution() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		if err := store.DeleteInstitution(s.db, id); handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}
