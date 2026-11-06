package store

import (
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strconv"
)

const (
	SettingAutosaveIntervalSeconds = "autosave_interval_seconds"
	SettingChatModel               = "chat_model"
)

// ChatModels is the allowlist of Gemini models the Chat may use; first = default.
var ChatModels = []string{"gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"}

const (
	DefaultAutosaveIntervalSeconds = 5
	MinAutosaveIntervalSeconds     = 2
	MaxAutosaveIntervalSeconds     = 300
)

// GetSetting returns the value for key; ok=false when no row exists.
func GetSetting(db *sql.DB, key string) (string, bool, error) {
	var value string
	err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("GetSetting: %w", err)
	}
	return value, true, nil
}

// SetSetting upserts a key/value pair.
func SetSetting(db *sql.DB, key, value string) error {
	_, err := db.Exec(
		`INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		key, value,
	)
	if err != nil {
		return fmt.Errorf("SetSetting: %w", err)
	}
	return nil
}

// GetAutosaveIntervalSeconds returns the configured autosave interval.
// Falls back to DefaultAutosaveIntervalSeconds when unset, non-numeric, or out of range.
func GetAutosaveIntervalSeconds(db *sql.DB) (int, error) {
	v, ok, err := GetSetting(db, SettingAutosaveIntervalSeconds)
	if err != nil {
		return DefaultAutosaveIntervalSeconds, err
	}
	if !ok {
		return DefaultAutosaveIntervalSeconds, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < MinAutosaveIntervalSeconds || n > MaxAutosaveIntervalSeconds {
		return DefaultAutosaveIntervalSeconds, nil
	}
	return n, nil
}

// GetChatModel returns the configured Chat model, or the default when unset
// or no longer in ChatModels.
func GetChatModel(db *sql.DB) (string, error) {
	v, _, err := GetSetting(db, SettingChatModel)
	if err != nil || !slices.Contains(ChatModels, v) {
		return ChatModels[0], err
	}
	return v, nil
}
