package store

import "errors"

// Sentinel errors returned by store functions.
var (
	// ErrNotFound is returned when a requested row does not exist.
	ErrNotFound = errors.New("not found")

	// ErrConflict is returned on unique-constraint violations
	// (e.g. duplicate nome, sigla, token).
	ErrConflict = errors.New("conflict")

	// ErrLinked is returned when a delete is blocked because the row is
	// referenced by other rows (participants in meetings, institutions in projects).
	ErrLinked = errors.New("linked")
)
