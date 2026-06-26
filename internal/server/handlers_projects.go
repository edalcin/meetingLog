package server

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/edalcin/meetinglog/internal/model"
	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) handleListProjects() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		limit := parseIntParam(r, "limit", 200, 1, 1000)
		activeOnly := r.URL.Query().Get("activeOnly") == "true" || r.URL.Query().Get("activeOnly") == "1"

		projects, total, err := store.ListProjects(s.db, q, activeOnly, limit)
		if err != nil {
			log.Printf("handleListProjects: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"data":  projects,
			"total": total,
		})
	}
}

func (s *Server) handleGetProjectDetail() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		p, err := store.GetProjectDetail(s.db, id)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func (s *Server) handleCreateProject() http.HandlerFunc {
	type request struct {
		Nome           string              `json:"nome"`
		Ativo          *bool               `json:"ativo"`
		Notas          *string             `json:"notas"`
		InstituicaoIDs []int64             `json:"instituicao_ids"`
		Links          []projectLinkInput  `json:"links"`
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
		links := parseProjectLinks(req.Links)
		p, _, err := store.CreateProject(s.db, req.Nome, ativo, req.Notas, req.InstituicaoIDs, links)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusCreated, p)
	}
}

func (s *Server) handleUpdateProject() http.HandlerFunc {
	type request struct {
		Nome           string             `json:"nome"`
		Ativo          *bool              `json:"ativo"`
		Notas          *string            `json:"notas"`
		InstituicaoIDs []int64            `json:"instituicao_ids"`
		Links          []projectLinkInput `json:"links"`
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
		links := parseProjectLinks(req.Links)
		p, deactivated, rejectedURLs, err := store.UpdateProject(s.db, id, req.Nome, ativo, req.Notas, req.InstituicaoIDs, links)
		if handleStoreErr(w, err) {
			return
		}
		p.DeactivatedParticipants = deactivated
		p.RejectedURLs = rejectedURLs
		writeJSON(w, http.StatusOK, p)
	}
}

func (s *Server) handlePatchProject() http.HandlerFunc {
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
		p, err := store.PatchProjectAtivo(s.db, id, *req.Ativo)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func (s *Server) handleDeleteProject() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		if err := store.DeleteProject(s.db, id); handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

// projectLinkInput is the JSON shape for incoming project link objects.
type projectLinkInput struct {
	Nome *string `json:"nome"`
	URL  string  `json:"url"`
}

// parseProjectLinks converts projectLinkInput slice to model.ProjectLink slice.
func parseProjectLinks(inputs []projectLinkInput) []model.ProjectLink {
	links := make([]model.ProjectLink, 0, len(inputs))
	for _, l := range inputs {
		links = append(links, model.ProjectLink{Nome: l.Nome, URL: l.URL})
	}
	return links
}
