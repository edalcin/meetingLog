package server

import (
	"database/sql"
	"io/fs"
	"net/http"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/edalcin/meetinglog/internal/config"
	"github.com/edalcin/meetinglog/internal/sessions"
	"github.com/edalcin/meetinglog/internal/storage"
)

// Server wraps the HTTP router and all its dependencies.
type Server struct {
	cfg      *config.Config
	db       *sql.DB
	sessions *sessions.Store
	storage  *storage.LocalBackend
	throttle *Throttle
	handler  http.Handler
	mu       sync.RWMutex
}

// New builds the chi router with all middleware and routes.
func New(cfg *config.Config, db *sql.DB, sess *sessions.Store) *Server {
	local := storage.NewLocal(cfg.AttachmentsPath)
	s := &Server{
		cfg:      cfg,
		db:       db,
		sessions: sess,
		storage:  local,
		throttle: NewThrottle(cfg.TrustProxyHeaders),
	}
	s.handler = s.buildRouter()
	return s
}

// Handler returns the root http.Handler.
func (s *Server) Handler() http.Handler { return s.handler }

// ReplaceDB atomically replaces the DB and sessions after a restore.
// Called by handleRestore after the file swap succeeds.
func (s *Server) ReplaceDB(newDB *sql.DB) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.db = newDB
	s.sessions = s.sessions.Reset(newDB)
	s.handler = s.buildRouter()
}

func (s *Server) buildRouter() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(SecurityHeaders)
	r.Use(CSRF)

	root := webRoot()

	// Public routes
	r.Get("/healthz", (&healthHandler{db: s.db}).ServeHTTP)
	r.Post("/api/login", s.handleLogin())

	// SPA shell — served unauthenticated so the login screen renders.
	r.Get("/", serveFile(root, "index.html"))
	r.Get("/login", serveFile(root, "index.html"))

	// Public shared view routes — SPA handles the rendering.
	r.With(PublicShareCSP).Get("/p/{token}", serveFile(root, "index.html"))
	r.Get("/meeting/{id}", serveFile(root, "index.html"))

	// Static assets (unauthenticated)
	sf := staticFileServer()
	r.Get("/assets/*", sf.ServeHTTP)
	r.Get("/icons/*", sf.ServeHTTP)
	r.Get("/css/*", sf.ServeHTTP)
	r.Get("/js/*", sf.ServeHTTP)

	// Public API endpoints for shared link views (no auth required)
	r.With(PublicShareCSP).Get("/api/p/{token}", s.handleGetPublicLink())
	r.With(PublicShareCSP).Get("/api/p/{token}/meetings", s.handlePublicMeetings())

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(AuthRequired(s.sessions))

		// Auth
		r.Post("/api/logout", s.handleLogout())

		// Meetings
		r.Get("/api/meetings", s.handleListMeetings())
		r.Get("/api/meetings/{id}", s.handleGetMeeting())
		r.Post("/api/meetings", s.handleCreateMeeting())
		r.Put("/api/meetings/{id}", s.handleUpdateMeeting())
		r.Patch("/api/meetings/{id}/notas", s.handlePatchMeetingNotes())
		r.Delete("/api/meetings/{id}", s.handleDeleteMeeting())

		// Files (within meetings)
		r.Get("/api/meetings/{meetingId}/files", s.handleListFiles())
		r.Post("/api/meetings/{meetingId}/files", s.handleUploadFile())

		// Files (standalone)
		r.With(FileContentCSP).Get("/api/files/{id}/content", s.handleFileContent())
		r.Get("/api/files/{id}/thumbnail", s.handleFileThumbnail())
		r.Delete("/api/files/{id}", s.handleDeleteFile())

		// Participants
		r.Get("/api/participants", s.handleListParticipants())
		r.Post("/api/participants", s.handleCreateParticipant())
		r.Get("/api/participants/{id}", s.handleGetParticipant())
		r.Put("/api/participants/{id}", s.handleUpdateParticipant())
		r.Delete("/api/participants/{id}", s.handleDeleteParticipant())

		// Projects
		r.Get("/api/projects", s.handleListProjects())
		r.Post("/api/projects", s.handleCreateProject())
		r.Get("/api/projects/{id}/detail", s.handleGetProjectDetail())
		r.Put("/api/projects/{id}", s.handleUpdateProject())
		r.Delete("/api/projects/{id}", s.handleDeleteProject())

		// Institutions
		r.Get("/api/institutions", s.handleListInstitutions())
		r.Post("/api/institutions", s.handleCreateInstitution())
		r.Get("/api/institutions/{id}", s.handleGetInstitution())
		r.Put("/api/institutions/{id}", s.handleUpdateInstitution())
		r.Delete("/api/institutions/{id}", s.handleDeleteInstitution())

		// Dashboard
		r.Get("/api/dashboard/options", s.handleDashboardOptions())
		r.Get("/api/dashboard", s.handleDashboard())

		// Shared links (owner management)
		r.Get("/api/shared-links", s.handleListSharedLinks())
		r.Post("/api/shared-links", s.handleCreateSharedLink())
		r.Delete("/api/shared-links/{id}", s.handleRevokeSharedLink())

		// Maintenance
		r.Post("/api/maintenance/replace-project", s.handleReplaceProject())
		r.Get("/api/maintenance/backup", s.handleBackup())
		r.Post("/api/maintenance/restore", s.handleRestore())
	})

	return r
}

func serveFile(root fs.FS, name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		http.ServeFileFS(w, r, root, name)
	}
}
