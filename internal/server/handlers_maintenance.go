package server

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/edalcin/meetinglog/internal/store"
)

func (s *Server) handleReplaceProject() http.HandlerFunc {
	type request struct {
		FromID int64 `json:"from_id"`
		ToID   int64 `json:"to_id"`
		DryRun bool  `json:"dry_run"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		if req.FromID <= 0 || req.ToID <= 0 {
			writeError(w, http.StatusBadRequest, "from_id e to_id são obrigatórios")
			return
		}
		if req.FromID == req.ToID {
			writeError(w, http.StatusBadRequest, "from_id e to_id devem ser diferentes")
			return
		}

		result, err := store.ReplaceProject(s.db, req.FromID, req.ToID, req.DryRun)
		if handleStoreErr(w, err) {
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleBackup() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dbDir := filepath.Dir(s.cfg.DBPath)

		tmpPath, err := store.BackupDB(s.db, dbDir)
		if err != nil {
			log.Printf("handleBackup BackupDB: %v", err)
			writeError(w, http.StatusInternalServerError, "erro ao gerar backup")
			return
		}
		defer os.Remove(tmpPath)

		f, err := os.Open(tmpPath)
		if err != nil {
			log.Printf("handleBackup open tmp: %v", err)
			writeError(w, http.StatusInternalServerError, "erro ao abrir backup")
			return
		}
		defer f.Close()

		fi, err := f.Stat()
		if err != nil {
			log.Printf("handleBackup stat: %v", err)
			writeError(w, http.StatusInternalServerError, "erro ao verificar backup")
			return
		}

		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", `attachment; filename="meetinglog-backup.sqlite"`)
		w.Header().Set("Content-Length", strconv.FormatInt(fi.Size(), 10))
		io.Copy(w, f)
	}
}

func (s *Server) handleRestore() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		maxBytes := int64(s.cfg.MaxRestoreMB) << 20
		r.Body = http.MaxBytesReader(w, r.Body, maxBytes)

		if err := r.ParseMultipartForm(maxBytes); err != nil {
			writeError(w, http.StatusRequestEntityTooLarge, "arquivo muito grande ou form inválido")
			return
		}

		fh, _, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, "campo 'file' ausente")
			return
		}
		defer fh.Close()

		// Read first 16 bytes to validate SQLite magic header.
		magic := make([]byte, 16)
		if _, err := io.ReadFull(fh, magic); err != nil {
			writeError(w, http.StatusBadRequest, "arquivo inválido ou incompleto")
			return
		}
		if !store.ValidateSQLiteFile(magic) {
			writeError(w, http.StatusBadRequest, "arquivo não é um banco SQLite válido")
			return
		}

		// Write the full file (magic + remainder) to a temp path in the DB directory.
		dbDir := filepath.Dir(s.cfg.DBPath)
		tmp, err := os.CreateTemp(dbDir, "meetinglog-restore-*.sqlite")
		if err != nil {
			log.Printf("handleRestore CreateTemp: %v", err)
			writeError(w, http.StatusInternalServerError, "erro ao criar arquivo temporário")
			return
		}
		tmpPath := tmp.Name()

		_, writeErr := tmp.Write(magic)
		if writeErr == nil {
			_, writeErr = io.Copy(tmp, fh)
		}
		tmp.Close()

		if writeErr != nil {
			os.Remove(tmpPath)
			log.Printf("handleRestore write tmp: %v", writeErr)
			writeError(w, http.StatusInternalServerError, "erro ao escrever arquivo temporário")
			return
		}

		// Atomically replace the production database file.
		if err := os.Rename(tmpPath, s.cfg.DBPath); err != nil {
			os.Remove(tmpPath)
			log.Printf("handleRestore rename: %v", err)
			writeError(w, http.StatusInternalServerError, "erro ao substituir banco de dados")
			return
		}

		// Open the freshly restored database and hot-swap it into the server.
		newDB, err := store.Open(s.cfg.DBPath)
		if err != nil {
			log.Printf("handleRestore Open newDB: %v", err)
			writeError(w, http.StatusInternalServerError, "banco restaurado mas não foi possível reabrir")
			return
		}

		s.ReplaceDB(newDB)

		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

