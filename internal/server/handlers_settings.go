package server

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"

	"github.com/edalcin/meetinglog/internal/model"
	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) settings() (model.Settings, error) {
	interval, err := store.GetAutosaveIntervalSeconds(s.db)
	if err != nil {
		return model.Settings{}, err
	}
	chatModel, err := store.GetChatModel(s.db)
	if err != nil {
		return model.Settings{}, err
	}
	return model.Settings{
		AutosaveIntervalSeconds: interval,
		ChatModel:               chatModel,
		ChatModels:              store.ChatModels,
		ChatEnabled:             s.cfg.GeminiAPIKey != "",
	}, nil
}

func (s *Server) handleGetSettings() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		st, err := s.settings()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "erro ao ler configurações")
			return
		}
		writeJSON(w, http.StatusOK, st)
	}
}

// handleUpdateSettings accepts any subset of the editable settings.
func (s *Server) handleUpdateSettings() http.HandlerFunc {
	type request struct {
		AutosaveIntervalSeconds *int    `json:"autosave_interval_seconds"`
		ChatModel               *string `json:"chat_model"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		if v := req.AutosaveIntervalSeconds; v != nil && (*v < store.MinAutosaveIntervalSeconds || *v > store.MaxAutosaveIntervalSeconds) {
			writeError(w, http.StatusBadRequest, "intervalo inválido (2–300 segundos)")
			return
		}
		if v := req.ChatModel; v != nil && !slices.Contains(store.ChatModels, *v) {
			writeError(w, http.StatusBadRequest, "modelo do Chat inválido")
			return
		}
		if v := req.AutosaveIntervalSeconds; v != nil {
			if err := store.SetSetting(s.db, store.SettingAutosaveIntervalSeconds, strconv.Itoa(*v)); err != nil {
				writeError(w, http.StatusInternalServerError, "erro ao salvar configuração")
				return
			}
		}
		if v := req.ChatModel; v != nil {
			if err := store.SetSetting(s.db, store.SettingChatModel, *v); err != nil {
				writeError(w, http.StatusInternalServerError, "erro ao salvar configuração")
				return
			}
		}
		st, err := s.settings()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "erro ao ler configurações")
			return
		}
		writeJSON(w, http.StatusOK, st)
	}
}
