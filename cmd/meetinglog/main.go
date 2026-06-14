package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/edalcin/meetinglog/internal/config"
	"github.com/edalcin/meetinglog/internal/server"
	"github.com/edalcin/meetinglog/internal/sessions"
	"github.com/edalcin/meetinglog/internal/store"
)

func main() {
	// -healthcheck flag: dial /healthz and exit 0/1.
	// Used as Docker HEALTHCHECK CMD so no shell or curl is needed.
	healthcheck := flag.Bool("healthcheck", false, "perform a health check against the running server and exit")
	flag.Parse()

	if *healthcheck {
		os.Exit(doHealthCheck())
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// Ensure required directories exist.
	// store.Open handles the DB directory; FILES_PATH is optional (upload disabled
	// when empty) but if set we create its thumbnails sub-dir eagerly.
	if cfg.AttachmentsPath != "" {
		for _, dir := range []string{
			cfg.AttachmentsPath,
			filepath.Join(cfg.AttachmentsPath, "thumbnails"),
		} {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				log.Fatalf("mkdir %s: %v", dir, err)
			}
		}
	}

	db, err := store.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("store.Open: %v", err)
	}
	defer db.Close()

	sess := sessions.New(cfg.SessionIdleMinutes, db)
	srv := server.New(cfg, db, sess)

	httpServer := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      srv.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second, // longer for file downloads
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown on SIGINT / SIGTERM.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("meetinglog listening on %s", cfg.ListenAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down…")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("done")
}

// doHealthCheck dials /healthz on the configured port and returns 0 (healthy)
// or 1 (unhealthy / unreachable).
func doHealthCheck() int {
	// Read port from env directly — we want this to work even if config.Load
	// fails (e.g. APP_PIN not set in a healthcheck-only invocation).
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "3000"
	}
	url := fmt.Sprintf("http://localhost:%s/healthz", port)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "healthcheck: %v\n", err)
		return 1
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "healthcheck: status %d\n", resp.StatusCode)
		return 1
	}
	return 0
}
