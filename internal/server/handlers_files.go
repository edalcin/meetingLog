package server

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/edalcin/meetinglog/internal/security"
	"github.com/edalcin/meetinglog/internal/storage"
	"github.com/edalcin/meetinglog/internal/store"
	"github.com/edalcin/meetinglog/internal/thumbnail"
)

func (s *Server) handleListFiles() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw := chi.URLParam(r, "meetingId")
		var meetingID int64
		if _, err := fmt.Sscan(raw, &meetingID); err != nil || meetingID <= 0 {
			writeError(w, http.StatusBadRequest, "meetingId inválido")
			return
		}
		files, err := store.ListFiles(s.db, meetingID)
		if err != nil {
			log.Printf("handleListFiles: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}
		writeJSON(w, http.StatusOK, files)
	}
}

func (s *Server) handleFileThumbnail() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		storedName, mimeType, err := store.GetFileForThumbnail(s.db, id)
		if handleStoreErr(w, err) {
			return
		}

		if mimeType == "application/pdf" {
			w.Header().Set("Content-Type", "image/png")
			w.WriteHeader(http.StatusOK)
			w.Write(thumbnail.PDFIconBytes())
			return
		}

		stem := strings.TrimSuffix(storedName, filepath.Ext(storedName))
		thumbKey := "thumbnails/" + stem + ".jpg"

		// Validate the path is safe before attempting to open.
		if _, err := security.SafeAttachmentPath(s.cfg.AttachmentsPath, thumbKey); err != nil {
			writeError(w, http.StatusNotFound, "thumbnail não encontrado")
			return
		}

		ctx := context.Background()
		f, openErr := s.storage.OpenSeek(ctx, thumbKey)
		if openErr != nil {
			writeError(w, http.StatusNotFound, "thumbnail não encontrado")
			return
		}
		defer f.Close()

		w.Header().Set("Content-Type", "image/jpeg")
		http.ServeContent(w, r, stem+".jpg", time.Time{}, f)
	}
}

func (s *Server) handleFileContent() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		storedName, mimeType, err := store.GetFileForContent(s.db, id)
		if handleStoreErr(w, err) {
			return
		}

		ctx := context.Background()
		f, err := s.storage.OpenSeek(ctx, storedName)
		if err != nil {
			log.Printf("handleFileContent OpenSeek %q: %v", storedName, err)
			writeError(w, http.StatusInternalServerError, "erro ao abrir arquivo")
			return
		}
		defer f.Close()

		w.Header().Set("Content-Type", mimeType)
		w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, storedName))
		http.ServeContent(w, r, storedName, time.Time{}, f)
	}
}

func (s *Server) handleUploadFile() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw := chi.URLParam(r, "meetingId")
		var meetingID int64
		if _, err := fmt.Sscan(raw, &meetingID); err != nil || meetingID <= 0 {
			writeError(w, http.StatusBadRequest, "meetingId inválido")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxFileMB<<20)
		if err := r.ParseMultipartForm(s.cfg.MaxFileMB << 20); err != nil {
			writeError(w, http.StatusRequestEntityTooLarge, "arquivo muito grande ou form inválido")
			return
		}

		fh, header, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, "campo 'file' ausente")
			return
		}
		defer fh.Close()

		// Read the entire file into memory for magic-byte detection and re-use.
		body, err := io.ReadAll(fh)
		if err != nil {
			log.Printf("handleUploadFile ReadAll: %v", err)
			writeError(w, http.StatusInternalServerError, "erro ao ler arquivo")
			return
		}

		mimeType, ext := detectMime(body, header.Filename)

		baseFilename, err := store.GetMeetingBaseFilename(s.db, meetingID)
		if handleStoreErr(w, err) {
			return
		}
		letter, err := store.NextFileLetter(s.db, meetingID)
		if err != nil {
			log.Printf("handleUploadFile NextFileLetter: %v", err)
			writeError(w, http.StatusInternalServerError, "erro interno")
			return
		}

		filenameStored := baseFilename + "_" + letter + ext
		ctx := context.Background()

		if err := s.storage.Put(ctx, filenameStored, bytes.NewReader(body), int64(len(body)), mimeType); err != nil {
			log.Printf("handleUploadFile Put %q: %v", filenameStored, err)
			writeError(w, http.StatusInternalServerError, "erro ao salvar arquivo")
			return
		}

		// Generate JPEG thumbnail for images (not PDFs).
		if mimeType == "image/png" || mimeType == "image/jpeg" {
			stem := strings.TrimSuffix(filenameStored, filepath.Ext(filenameStored))
			thumbKey := "thumbnails/" + stem + ".jpg"

			var thumbBuf bytes.Buffer
			if err := thumbnail.GenerateJPEG(&thumbBuf, bytes.NewReader(body)); err != nil {
				log.Printf("handleUploadFile GenerateJPEG: %v", err)
				// Thumbnail failure is non-fatal — the file itself was saved.
			} else {
				thumbData := thumbBuf.Bytes()
				if putErr := s.storage.Put(ctx, thumbKey, bytes.NewReader(thumbData), int64(len(thumbData)), "image/jpeg"); putErr != nil {
					log.Printf("handleUploadFile Put thumbnail %q: %v", thumbKey, putErr)
				}
			}
		}

		f, err := store.CreateFile(s.db, meetingID, header.Filename, filenameStored, letter, mimeType, int64(len(body)))
		if handleStoreErr(w, err) {
			// Attempt cleanup; ignore error.
			_ = s.storage.Delete(ctx, filenameStored)
			return
		}
		writeJSON(w, http.StatusCreated, f)
	}
}

func (s *Server) handleDeleteFile() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := parseID(w, r)
		if !ok {
			return
		}
		storedName, err := store.DeleteFile(s.db, id)
		if handleStoreErr(w, err) {
			return
		}

		ctx := context.Background()
		if delErr := s.storage.Delete(ctx, storedName); delErr != nil {
			log.Printf("handleDeleteFile storage.Delete %q: %v", storedName, delErr)
		}

		// Best-effort thumbnail removal for images.
		stem := strings.TrimSuffix(storedName, filepath.Ext(storedName))
		_ = s.storage.Delete(ctx, "thumbnails/"+stem+".jpg")

		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

// detectMime inspects the first bytes of data to determine MIME type and file extension.
// Falls back to the filename extension when the magic bytes are unrecognised.
func detectMime(data []byte, originalFilename string) (mimeType, ext string) {
	if len(data) >= 4 {
		switch {
		case data[0] == 0xFF && data[1] == 0xD8:
			return "image/jpeg", ".jpg"
		case data[0] == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G':
			return "image/png", ".png"
		case string(data[:4]) == "%PDF":
			return "application/pdf", ".pdf"
		}
	}
	e := strings.ToLower(filepath.Ext(originalFilename))
	switch e {
	case ".jpg", ".jpeg":
		return "image/jpeg", ".jpg"
	case ".png":
		return "image/png", ".png"
	case ".pdf":
		return "application/pdf", ".pdf"
	}
	return "application/octet-stream", e
}

// Compile-time assertion: LocalBackend must satisfy the Seeker interface used here.
var _ storage.Seeker = (*storage.LocalBackend)(nil)
