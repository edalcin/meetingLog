package storage

import (
	"context"
	"io"
)

// Backend abstracts file storage. For meetingLog only the local filesystem
// backend is used; the interface keeps the door open for future extensions.
type Backend interface {
	// Put writes body to key. size must be the exact byte count of body.
	Put(ctx context.Context, key string, body io.Reader, size int64, contentType string) error
	// Get returns the file content and its size. Caller must close the reader.
	Get(ctx context.Context, key string) (io.ReadCloser, int64, error)
	// Delete removes key. Returns nil if the key does not exist.
	Delete(ctx context.Context, key string) error
	// Name returns the backend identifier (e.g. "local").
	Name() string
}

// Seeker is an optional interface for random-access reads (HTTP range requests).
type Seeker interface {
	OpenSeek(ctx context.Context, key string) (io.ReadSeekCloser, error)
}
