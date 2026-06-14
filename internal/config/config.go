package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all runtime configuration loaded from environment variables.
// Variable names kept intentionally identical to the original Node app so that
// existing UNRAID/docker-compose deployments need zero changes.
type Config struct {
	// Required
	PIN             string
	DBPath          string
	AttachmentsPath string

	// Optional with defaults
	ListenAddr         string
	SessionIdleMinutes int
	MaxFileMB          int64
	MaxRestoreMB       int64
	TrustProxyHeaders  bool

	// BaseURL is the public-facing base URL for generating shareable links.
	// e.g. "https://reunioes.dalc.in/". If empty, derived from request Host.
	BaseURL string
}

// Load reads configuration from environment variables and returns an error if
// any required variable is missing or any value is invalid.
func Load() (*Config, error) {
	var errs []string

	pin := os.Getenv("APP_PIN")
	if pin == "" {
		errs = append(errs, "APP_PIN is required")
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "/data/db/meetinglog.sqlite"
	}

	attachmentsPath := os.Getenv("FILES_PATH")

	if len(errs) > 0 {
		return nil, errors.New(strings.Join(errs, "; "))
	}

	cfg := &Config{
		PIN:                pin,
		DBPath:             dbPath,
		AttachmentsPath:    attachmentsPath,
		ListenAddr:         ":3000",
		SessionIdleMinutes: 43200, // 30 days
		MaxFileMB:          10,
		MaxRestoreMB:       512,
	}

	if v := os.Getenv("APP_PORT"); v != "" {
		if !strings.HasPrefix(v, ":") {
			v = ":" + v
		}
		cfg.ListenAddr = v
	}

	if v := os.Getenv("ML_SESSION_IDLE_MINUTES"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			return nil, fmt.Errorf("ML_SESSION_IDLE_MINUTES must be a positive integer, got %q", v)
		}
		cfg.SessionIdleMinutes = n
	}

	if v := os.Getenv("ML_MAX_FILE_MB"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 {
			return nil, fmt.Errorf("ML_MAX_FILE_MB must be a positive integer, got %q", v)
		}
		cfg.MaxFileMB = n
	}

	if v := os.Getenv("ML_MAX_RESTORE_MB"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 {
			return nil, fmt.Errorf("ML_MAX_RESTORE_MB must be a positive integer, got %q", v)
		}
		cfg.MaxRestoreMB = n
	}

	if v := os.Getenv("ML_TRUST_PROXY_HEADERS"); v == "1" || v == "true" || v == "yes" {
		cfg.TrustProxyHeaders = true
	}

	if v := os.Getenv("BASE_URL"); v != "" {
		cfg.BaseURL = strings.TrimRight(v, "/") + "/"
	}

	return cfg, nil
}
