package store

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/edalcin/meetinglog/internal/model"
)

// ListFiles returns all arquivo rows for a meeting, ordered by letter.
func ListFiles(db *sql.DB, meetingID int64) ([]model.File, error) {
	rows, err := db.Query(`
		SELECT id, reuniao_id, filename_original, filename_stored, letter,
		       mime_type, file_size, criado_em
		FROM arquivo WHERE reuniao_id = ? ORDER BY letter ASC`,
		meetingID,
	)
	if err != nil {
		return nil, fmt.Errorf("ListFiles query: %w", err)
	}
	defer rows.Close()

	var files []model.File
	for rows.Next() {
		var f model.File
		if err := rows.Scan(
			&f.ID, &f.ReuniaoID, &f.FilenameOriginal, &f.FilenameStored,
			&f.Letter, &f.MimeType, &f.FileSize, &f.CriadoEm,
		); err != nil {
			return nil, fmt.Errorf("ListFiles scan: %w", err)
		}
		files = append(files, f)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ListFiles iter: %w", err)
	}
	return files, nil
}

// GetFile returns one arquivo row. Returns ErrNotFound if missing.
func GetFile(db *sql.DB, id int64) (*model.File, error) {
	var f model.File
	err := db.QueryRow(`
		SELECT id, reuniao_id, filename_original, filename_stored, letter,
		       mime_type, file_size, criado_em
		FROM arquivo WHERE id = ?`, id,
	).Scan(
		&f.ID, &f.ReuniaoID, &f.FilenameOriginal, &f.FilenameStored,
		&f.Letter, &f.MimeType, &f.FileSize, &f.CriadoEm,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("GetFile scan: %w", err)
	}
	return &f, nil
}

// GetFileForThumbnail returns (filename_stored, mime_type) for thumbnail serving.
// Returns ErrNotFound if missing.
func GetFileForThumbnail(db *sql.DB, id int64) (storedName, mimeType string, err error) {
	row := db.QueryRow(`SELECT filename_stored, mime_type FROM arquivo WHERE id = ?`, id)
	if scanErr := row.Scan(&storedName, &mimeType); scanErr != nil {
		if errors.Is(scanErr, sql.ErrNoRows) {
			return "", "", ErrNotFound
		}
		return "", "", fmt.Errorf("GetFileForThumbnail scan: %w", scanErr)
	}
	return storedName, mimeType, nil
}

// GetFileForContent returns (filename_stored, mime_type) for content serving.
// Returns ErrNotFound if missing.
func GetFileForContent(db *sql.DB, id int64) (storedName, mimeType string, err error) {
	row := db.QueryRow(`SELECT filename_stored, mime_type FROM arquivo WHERE id = ?`, id)
	if scanErr := row.Scan(&storedName, &mimeType); scanErr != nil {
		if errors.Is(scanErr, sql.ErrNoRows) {
			return "", "", ErrNotFound
		}
		return "", "", fmt.Errorf("GetFileForContent scan: %w", scanErr)
	}
	return storedName, mimeType, nil
}

// NextFileLetter returns the next letter for a meeting's files.
// Returns 'a' for the first file, 'b' for the second, and so on.
func NextFileLetter(db *sql.DB, meetingID int64) (string, error) {
	var maxLetter string
	err := db.QueryRow(
		`SELECT COALESCE(MAX(letter), CHAR(96)) AS maxLetter FROM arquivo WHERE reuniao_id = ?`,
		meetingID,
	).Scan(&maxLetter)
	if err != nil {
		return "", fmt.Errorf("NextFileLetter scan: %w", err)
	}
	if len(maxLetter) == 0 {
		return "a", nil
	}
	return string(rune(maxLetter[0]) + 1), nil
}

// GetMeetingBaseFilename returns a formatted datetime string for a meeting,
// suitable for use as a filename prefix (e.g. "2024-03-15_14h30").
// Returns ErrNotFound if the meeting does not exist.
func GetMeetingBaseFilename(db *sql.DB, meetingID int64) (string, error) {
	var base string
	err := db.QueryRow(
		`SELECT strftime('%Y-%m-%d_%Hh%M', data_hora) FROM reuniao WHERE id = ?`,
		meetingID,
	).Scan(&base)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("GetMeetingBaseFilename scan: %w", err)
	}
	return base, nil
}

// CreateFile inserts an arquivo row and returns the created record.
func CreateFile(db *sql.DB, meetingID int64, filenameOriginal, filenameStored, letter, mimeType string, fileSize int64) (*model.File, error) {
	res, err := db.Exec(`
		INSERT INTO arquivo (reuniao_id, filename_original, filename_stored, letter, mime_type, file_size)
		VALUES (?, ?, ?, ?, ?, ?)`,
		meetingID, filenameOriginal, filenameStored, letter, mimeType, fileSize,
	)
	if err != nil {
		return nil, fmt.Errorf("CreateFile exec: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("CreateFile last insert id: %w", err)
	}
	return GetFile(db, id)
}

// DeleteFile deletes an arquivo row and returns the stored filename so the
// handler can remove the file from disk.
// Returns ErrNotFound if the row does not exist.
func DeleteFile(db *sql.DB, id int64) (string, error) {
	var filenameStored string
	err := db.QueryRow(`SELECT filename_stored FROM arquivo WHERE id = ?`, id).Scan(&filenameStored)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("DeleteFile select: %w", err)
	}

	if _, err := db.Exec(`DELETE FROM arquivo WHERE id = ?`, id); err != nil {
		return "", fmt.Errorf("DeleteFile exec: %w", err)
	}
	return filenameStored, nil
}
