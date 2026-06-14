package store

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/edalcin/meetinglog/internal/model"
)

// ListShareLinks returns all share links ordered by criado_em DESC.
func ListShareLinks(db *sql.DB) ([]model.ShareLink, error) {
	rows, err := db.Query(`
		SELECT id, token, filter_type, filter_value, descricao, criado_em, revogado
		FROM link_publico ORDER BY criado_em DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("ListShareLinks query: %w", err)
	}
	defer rows.Close()

	var links []model.ShareLink
	for rows.Next() {
		var l model.ShareLink
		var revogado int
		if err := rows.Scan(
			&l.ID, &l.Token, &l.FilterType, &l.FilterValue,
			&l.Descricao, &l.CriadoEm, &revogado,
		); err != nil {
			return nil, fmt.Errorf("ListShareLinks scan: %w", err)
		}
		l.Revogado = revogado == 1
		links = append(links, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ListShareLinks iter: %w", err)
	}
	return links, nil
}

// CreateShareLink creates a new public share link.
func CreateShareLink(db *sql.DB, token, filterType, filterValue, descricao string) (*model.ShareLink, error) {
	res, err := db.Exec(`
		INSERT INTO link_publico (token, filter_type, filter_value, descricao)
		VALUES (?, ?, ?, ?)`,
		token, filterType, filterValue, descricao,
	)
	if err != nil {
		if isUniqueConstraintError(err) {
			return nil, ErrConflict
		}
		return nil, fmt.Errorf("CreateShareLink exec: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("CreateShareLink last insert id: %w", err)
	}
	return GetShareLinkByID(db, id)
}

// RevokeShareLink sets revogado=1 for the given id.
// Returns ErrNotFound if changes=0.
func RevokeShareLink(db *sql.DB, id int64) error {
	res, err := db.Exec(`UPDATE link_publico SET revogado = 1 WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("RevokeShareLink exec: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// GetShareLinkByToken returns a share link by token.
// Returns ErrNotFound if not found.
func GetShareLinkByToken(db *sql.DB, token string) (*model.ShareLink, error) {
	var l model.ShareLink
	var revogado int
	err := db.QueryRow(`
		SELECT id, token, filter_type, filter_value, descricao, criado_em, revogado
		FROM link_publico WHERE token = ?`, token,
	).Scan(
		&l.ID, &l.Token, &l.FilterType, &l.FilterValue,
		&l.Descricao, &l.CriadoEm, &revogado,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("GetShareLinkByToken scan: %w", err)
	}
	l.Revogado = revogado == 1
	return &l, nil
}

// GetShareLinkByID returns a share link by primary key. Used internally after
// inserts to return the full row without a second token lookup.
func GetShareLinkByID(db *sql.DB, id int64) (*model.ShareLink, error) {
	var l model.ShareLink
	var revogado int
	err := db.QueryRow(`
		SELECT id, token, filter_type, filter_value, descricao, criado_em, revogado
		FROM link_publico WHERE id = ?`, id,
	).Scan(
		&l.ID, &l.Token, &l.FilterType, &l.FilterValue,
		&l.Descricao, &l.CriadoEm, &revogado,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("GetShareLinkByID scan: %w", err)
	}
	l.Revogado = revogado == 1
	return &l, nil
}
