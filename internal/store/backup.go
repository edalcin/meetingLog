package store

import (
	"database/sql"
	"fmt"
	"time"
)

// BackupDB creates a consistent SQLite backup using VACUUM INTO.
// It writes to a temp file in dbDir and returns the path. The caller is
// responsible for streaming and then removing the file with os.Remove.
func BackupDB(db *sql.DB, dbDir string) (tmpPath string, err error) {
	tmpPath = fmt.Sprintf("%s/meetinglog-backup-%d.sqlite", dbDir, time.Now().UnixNano())
	if _, err := db.Exec("VACUUM INTO ?", tmpPath); err != nil {
		return "", fmt.Errorf("BackupDB vacuum into: %w", err)
	}
	return tmpPath, nil
}

// ValidateSQLiteFile reports whether magic starts with the SQLite file header
// "SQLite format 3\x00" (the first 16 bytes of any valid SQLite database).
func ValidateSQLiteFile(magic []byte) bool {
	const header = "SQLite format 3\x00"
	if len(magic) < len(header) {
		return false
	}
	for i := range header {
		if magic[i] != header[i] {
			return false
		}
	}
	return true
}
