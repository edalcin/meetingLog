package server

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/edalcin/meetinglog/internal/model"
	"github.com/edalcin/meetinglog/internal/store"
)

var allowedSort = map[string]bool{
	"data_hora":          true,
	"tipo":               true,
	"participantes_nomes": true,
	"projeto_nomes":      true,
}

var allowedTipo = map[string]bool{
	"Presencial": true,
	"Remota":     true,
	"Hibrida":    true,
	"Telefone":   true,
}

func (s *Server) handleListMeetings() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		partIDs := parseIDList(q.Get("part_ids"))
		projIDs := parseIDList(q.Get("proj_ids"))

		sort := q.Get("sort")
		if !allowedSort[sort] {
			sort = "data_hora"
		}
		order := strings.ToUpper(q.Get("order"))
		if order != "ASC" && order != "DESC" {
			order = "DESC"
		}

		page := parseIntParam(r, "page", 1, 1, 10000)
		limit := parseIntParam(r, "limit", 20, 1, 200)

		meetings, total, err := store.ListMeetings(s.db, partIDs, projIDs, sort, order, page, limit)
		if err != nil {
			log.Printf("handleListMeetings: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}

		pages := (total + limit - 1) / limit
		if pages < 1 {
			pages = 1
		}
		writeJSON(w, http.StatusOK, model.MeetingListResponse{
			Data:  meetings,
			Total: total,
			Page:  page,
			Limit: limit,
			Pages: pages,
		})
	}
}

func (s *Server) handleGetMeeting() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		m, err := store.GetMeeting(s.db, id)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, m)
	}
}

func (s *Server) handleCreateMeeting() http.HandlerFunc {
	type request struct {
		DataHora       string        `json:"data_hora"`
		Tipo           string        `json:"tipo"`
		Notas          *string       `json:"notas"`
		ParticipanteIDs []int64      `json:"participante_ids"`
		ProjetoIDs     []int64       `json:"projeto_ids"`
		Pautas         []string      `json:"pautas"`
		Links          []linkInput   `json:"links"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		if req.DataHora == "" {
			writeError(w, http.StatusBadRequest, "data_hora é obrigatório")
			return
		}
		if !allowedTipo[req.Tipo] {
			writeError(w, http.StatusBadRequest, "tipo inválido")
			return
		}
		if len(req.ParticipanteIDs) < 1 {
			writeError(w, http.StatusBadRequest, "ao menos um participante é obrigatório")
			return
		}

		links := parseLinks(req.Links)
		m, _, err := store.CreateMeeting(s.db, req.DataHora, req.Tipo, req.Notas, req.ParticipanteIDs, req.ProjetoIDs, req.Pautas, links)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusCreated, m)
	}
}

func (s *Server) handleUpdateMeeting() http.HandlerFunc {
	type request struct {
		DataHora        string      `json:"data_hora"`
		Tipo            string      `json:"tipo"`
		Notas           *string     `json:"notas"`
		ParticipanteIDs []int64     `json:"participante_ids"`
		ProjetoIDs      []int64     `json:"projeto_ids"`
		Pautas          []string    `json:"pautas"`
		Links           []linkInput `json:"links"`
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
		if req.DataHora == "" {
			writeError(w, http.StatusBadRequest, "data_hora é obrigatório")
			return
		}
		if !allowedTipo[req.Tipo] {
			writeError(w, http.StatusBadRequest, "tipo inválido")
			return
		}
		if len(req.ParticipanteIDs) < 1 {
			writeError(w, http.StatusBadRequest, "ao menos um participante é obrigatório")
			return
		}

		links := parseLinks(req.Links)
		m, _, err := store.UpdateMeeting(s.db, id, req.DataHora, req.Tipo, req.Notas, req.ParticipanteIDs, req.ProjetoIDs, req.Pautas, links)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, m)
	}
}

func (s *Server) handlePatchMeetingNotes() http.HandlerFunc {
	type request struct {
		Notas *string `json:"notas"`
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
		if err := store.UpdateMeetingNotes(s.db, id, req.Notas); handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

func (s *Server) handleDeleteMeeting() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		if err := store.DeleteMeeting(s.db, id); handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

// linkInput is the JSON shape for incoming link objects (no id/ordem needed).
type linkInput struct {
	Nome *string `json:"nome"`
	URL  string  `json:"url"`
}

// parseLinks converts linkInput slice to model.Link slice.
func parseLinks(inputs []linkInput) []model.Link {
	links := make([]model.Link, 0, len(inputs))
	for _, l := range inputs {
		links = append(links, model.Link{Nome: l.Nome, URL: l.URL})
	}
	return links
}
