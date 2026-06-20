package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/edalcin/meetinglog/internal/model"
	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) handleGetSettings() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		interval, err := store.GetAutosaveIntervalSeconds(s.db)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "erro ao ler configurações")
			return
		}
		writeJSON(w, http.StatusOK, model.Settings{AutosaveIntervalSeconds: interval})
	}
}

func (s *Server) handleUpdateSettings() http.HandlerFunc {
	type request struct {
		AutosaveIntervalSeconds int `json:"autosave_interval_seconds"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		if req.AutosaveIntervalSeconds < store.MinAutosaveIntervalSeconds || req.AutosaveIntervalSeconds > store.MaxAutosaveIntervalSeconds {
			writeError(w, http.StatusBadRequest, "intervalo inválido (2–300 segundos)")
			return
		}
		if err := store.SetSetting(s.db, store.SettingAutosaveIntervalSeconds, strconv.Itoa(req.AutosaveIntervalSeconds)); err != nil {
			writeError(w, http.StatusInternalServerError, "erro ao salvar configuração")
			return
		}
		writeJSON(w, http.StatusOK, model.Settings{AutosaveIntervalSeconds: req.AutosaveIntervalSeconds})
	}
}
