package server

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) handleListParticipants() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		limit := parseIntParam(r, "limit", 200, 1, 1000)

		var ativo *bool
		if raw := r.URL.Query().Get("ativo"); raw != "" {
			v := raw == "true" || raw == "1"
			ativo = &v
		}

		participants, total, err := store.ListParticipants(s.db, q, ativo, limit)
		if err != nil {
			log.Printf("handleListParticipants: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"data":  participants,
			"total": total,
		})
	}
}

func (s *Server) handleGetParticipant() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		p, err := store.GetParticipant(s.db, id)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func (s *Server) handleCreateParticipant() http.HandlerFunc {
	type request struct {
		Nome        string  `json:"nome"`
		Instituicao *string `json:"instituicao"`
		Lotacao     *string `json:"lotacao"`
		Cargo       *string `json:"cargo"`
		Email       *string `json:"email"`
		Ativo       *bool   `json:"ativo"`
		Notas       *string `json:"notas"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		if req.Nome == "" {
			writeError(w, http.StatusBadRequest, "nome é obrigatório")
			return
		}
		ativo := true
		if req.Ativo != nil {
			ativo = *req.Ativo
		}
		p, err := store.CreateParticipant(s.db, req.Nome, req.Instituicao, req.Lotacao, req.Cargo, req.Email, req.Notas, ativo)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusCreated, p)
	}
}

func (s *Server) handleUpdateParticipant() http.HandlerFunc {
	type request struct {
		Nome        string  `json:"nome"`
		Instituicao *string `json:"instituicao"`
		Lotacao     *string `json:"lotacao"`
		Cargo       *string `json:"cargo"`
		Email       *string `json:"email"`
		Ativo       *bool   `json:"ativo"`
		Notas       *string `json:"notas"`
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
		if req.Nome == "" {
			writeError(w, http.StatusBadRequest, "nome é obrigatório")
			return
		}
		ativo := true
		if req.Ativo != nil {
			ativo = *req.Ativo
		}
		p, err := store.UpdateParticipant(s.db, id, req.Nome, req.Instituicao, req.Lotacao, req.Cargo, req.Email, req.Notas, ativo)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func (s *Server) handlePatchParticipant() http.HandlerFunc {
	type request struct {
		Ativo *bool `json:"ativo"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Ativo == nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		p, err := store.PatchParticipantAtivo(s.db, id, *req.Ativo)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func (s *Server) handleDeleteParticipant() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		if err := store.DeleteParticipant(s.db, id); handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}
