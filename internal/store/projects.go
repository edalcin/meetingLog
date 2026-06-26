package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/edalcin/meetinglog/internal/model"
)

// fetchProjectByID is a helper that returns a project with its institution data.
// Returns (nil, ErrNotFound) if missing.
func fetchProjectByID(db *sql.DB, id int64) (*model.Project, error) {
	const q = `
		SELECT p.id, p.nome, p.ativo, p.notas,
			COALESCE((SELECT GROUP_CONCAT(sigla, ', ') FROM (SELECT DISTINCT i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = p.id ORDER BY i2.sigla)), '') AS instituicao_nomes,
			COALESCE((SELECT GROUP_CONCAT(id, ',') FROM (SELECT i2.id, i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = p.id ORDER BY i2.sigla)), '') AS instituicao_ids_str
		FROM projeto p WHERE p.id = ?`

	var p model.Project
	var ativo int
	var idsStr string

	row := db.QueryRow(q, id)
	err := row.Scan(&p.ID, &p.Nome, &ativo, &p.Notas, &p.InstituicaoNomes, &idsStr)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("fetchProjectByID scan: %w", err)
	}

	p.Ativo = ativo == 1
	p.InstituicaoIDs = parseIDStr(idsStr)
	return &p, nil
}

// GetProjectDetail returns a project with its links and reunioes.
func GetProjectDetail(db *sql.DB, id int64) (*model.Project, error) {
	p, err := fetchProjectByID(db, id)
	if err != nil {
		return nil, err
	}

	linkRows, err := db.Query(
		`SELECT id, nome, url, ordem FROM projeto_link WHERE projeto_id = ? ORDER BY ordem ASC`,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("GetProjectDetail links: %w", err)
	}
	defer linkRows.Close()
	for linkRows.Next() {
		var l model.ProjectLink
		if err := linkRows.Scan(&l.ID, &l.Nome, &l.URL, &l.Ordem); err != nil {
			return nil, fmt.Errorf("GetProjectDetail link scan: %w", err)
		}
		p.Links = append(p.Links, l)
	}
	if err := linkRows.Err(); err != nil {
		return nil, fmt.Errorf("GetProjectDetail links iter: %w", err)
	}

	reuniaoRows, err := db.Query(
		`SELECT r.id, r.data_hora, r.tipo
		 FROM reuniao r
		 JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
		 WHERE rp.projeto_id = ?
		 ORDER BY r.data_hora DESC`,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("GetProjectDetail reunioes: %w", err)
	}
	defer reuniaoRows.Close()
	for reuniaoRows.Next() {
		var m model.MeetingSummary
		if err := reuniaoRows.Scan(&m.ID, &m.DataHora, &m.Tipo); err != nil {
			return nil, fmt.Errorf("GetProjectDetail reuniao scan: %w", err)
		}
		p.Reunioes = append(p.Reunioes, m)
	}
	if err := reuniaoRows.Err(); err != nil {
		return nil, fmt.Errorf("GetProjectDetail reunioes iter: %w", err)
	}

	return p, nil
}

// ListProjects returns projects with optional search/filter.
// Returns (projects, total, error).
func ListProjects(db *sql.DB, q string, activeOnly bool, limit int) ([]model.Project, int, error) {
	var conditions []string
	var params []any

	if q != "" {
		conditions = append(conditions, `(p.nome LIKE ? OR EXISTS (
			SELECT 1 FROM projeto_instituicao pi2
			JOIN instituicao i2 ON i2.id = pi2.instituicao_id
			WHERE pi2.projeto_id = p.id AND (i2.sigla LIKE ? OR i2.nome LIKE ?)
		))`)
		like := "%" + q + "%"
		params = append(params, like, like, like)
	}
	if activeOnly {
		conditions = append(conditions, "p.ativo = 1")
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countRow := db.QueryRow(
		fmt.Sprintf("SELECT COUNT(*) FROM projeto p %s", where),
		params...,
	)
	if err := countRow.Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("ListProjects count: %w", err)
	}

	listParams := append(params, limit)
	rows, err := db.Query(fmt.Sprintf(`
		SELECT p.id, p.nome, p.ativo,
			COALESCE((SELECT GROUP_CONCAT(sigla, ', ') FROM (SELECT DISTINCT i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = p.id ORDER BY i2.sigla)), '') AS instituicao_nomes,
			COALESCE((SELECT GROUP_CONCAT(id, ',') FROM (SELECT i2.id, i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = p.id ORDER BY i2.sigla)), '') AS instituicao_ids_str,
			(p.notas IS NOT NULL AND p.notas != '') AS has_notas,
			(SELECT COUNT(*) FROM projeto_link WHERE projeto_id = p.id) AS link_count,
			(SELECT COUNT(*) FROM reuniao_projeto WHERE projeto_id = p.id) AS reuniao_count
		FROM projeto p
		%s
		ORDER BY p.nome ASC
		LIMIT ?`, where),
		listParams...,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("ListProjects query: %w", err)
	}
	defer rows.Close()

	var projects []model.Project
	for rows.Next() {
		var p model.Project
		var ativo, hasNotas int
		var idsStr string
		if err := rows.Scan(
			&p.ID, &p.Nome, &ativo,
			&p.InstituicaoNomes, &idsStr,
			&hasNotas, &p.LinkCount, &p.ReuniaoCount,
		); err != nil {
			return nil, 0, fmt.Errorf("ListProjects scan: %w", err)
		}
		p.Ativo = ativo == 1
		p.HasNotas = hasNotas == 1
		p.InstituicaoIDs = parseIDStr(idsStr)
		projects = append(projects, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("ListProjects iter: %w", err)
	}

	return projects, total, nil
}

// partitionLinks splits links into valid (http/https) and rejected URL lists.
func partitionLinks(links []model.ProjectLink) (valid []model.ProjectLink, rejected []string) {
	for _, l := range links {
		trimmed := strings.TrimSpace(l.URL)
		if trimmed == "" {
			continue
		}
		if isAllowedURL(trimmed) {
			l.URL = trimmed
			valid = append(valid, l)
		} else {
			rejected = append(rejected, trimmed)
		}
	}
	return
}

// CreateProject inserts a project with its institutions and links in a transaction.
// Returns the created project, rejected URLs, and any error.
// Returns ErrConflict if the nome already exists.
func CreateProject(db *sql.DB, nome string, ativo bool, notas *string, instituicaoIDs []int64, links []model.ProjectLink) (*model.Project, []string, error) {
	validLinks, rejectedURLs := partitionLinks(links)

	var projectID int64

	err := WithTx(db, func(tx *sql.Tx) error {
		ativoInt := 0
		if ativo {
			ativoInt = 1
		}
		res, err := tx.Exec(
			`INSERT INTO projeto (nome, ativo, notas) VALUES (?, ?, ?)`,
			nome, ativoInt, notas,
		)
		if err != nil {
			if isUniqueConstraintError(err) {
				return ErrConflict
			}
			return fmt.Errorf("insert projeto: %w", err)
		}
		id, err := res.LastInsertId()
		if err != nil {
			return fmt.Errorf("last insert id: %w", err)
		}
		projectID = id

		for _, instID := range instituicaoIDs {
			if _, err := tx.Exec(
				`INSERT OR IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)`,
				projectID, instID,
			); err != nil {
				return fmt.Errorf("insert projeto_instituicao: %w", err)
			}
		}

		for i, l := range validLinks {
			nome := nilIfEmpty(strings.TrimSpace(ptrStr(l.Nome)))
			if _, err := tx.Exec(
				`INSERT OR IGNORE INTO projeto_link (projeto_id, nome, url, ordem) VALUES (?, ?, ?, ?)`,
				projectID, nome, l.URL, i,
			); err != nil {
				return fmt.Errorf("insert projeto_link: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		return nil, rejectedURLs, err
	}

	p, err := fetchProjectByID(db, projectID)
	if err != nil {
		return nil, rejectedURLs, err
	}
	return p, rejectedURLs, nil
}

// UpdateProject updates a project. If it transitions from active to inactive,
// it auto-deactivates participants that no longer have any active projects.
// Returns (project, deactivatedParticipants, rejectedURLs, error).
// Returns ErrNotFound if the project does not exist.
func UpdateProject(db *sql.DB, id int64, nome string, ativo bool, notas *string, instituicaoIDs []int64, links []model.ProjectLink) (*model.Project, []model.ParticipantSummary, []string, error) {
	validLinks, rejectedURLs := partitionLinks(links)

	var deactivated []model.ParticipantSummary

	err := WithTx(db, func(tx *sql.Tx) error {
		var prevAtivo int
		if err := tx.QueryRow(`SELECT ativo FROM projeto WHERE id = ?`, id).Scan(&prevAtivo); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrNotFound
			}
			return fmt.Errorf("select prev ativo: %w", err)
		}
		wasActive := prevAtivo == 1

		ativoInt := 0
		if ativo {
			ativoInt = 1
		}
		res, err := tx.Exec(
			`UPDATE projeto SET nome = ?, ativo = ?, notas = ? WHERE id = ?`,
			nome, ativoInt, notas, id,
		)
		if err != nil {
			if isUniqueConstraintError(err) {
				return ErrConflict
			}
			return fmt.Errorf("update projeto: %w", err)
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return ErrNotFound
		}

		if _, err := tx.Exec(`DELETE FROM projeto_instituicao WHERE projeto_id = ?`, id); err != nil {
			return fmt.Errorf("delete projeto_instituicao: %w", err)
		}
		for _, instID := range instituicaoIDs {
			if _, err := tx.Exec(
				`INSERT OR IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)`,
				id, instID,
			); err != nil {
				return fmt.Errorf("insert projeto_instituicao: %w", err)
			}
		}

		if _, err := tx.Exec(`DELETE FROM projeto_link WHERE projeto_id = ?`, id); err != nil {
			return fmt.Errorf("delete projeto_link: %w", err)
		}
		for i, l := range validLinks {
			linkNome := nilIfEmpty(strings.TrimSpace(ptrStr(l.Nome)))
			if _, err := tx.Exec(
				`INSERT OR IGNORE INTO projeto_link (projeto_id, nome, url, ordem) VALUES (?, ?, ?, ?)`,
				id, linkNome, l.URL, i,
			); err != nil {
				return fmt.Errorf("insert projeto_link: %w", err)
			}
		}

		if wasActive && !ativo {
			rows, err := tx.Query(`
				SELECT p.id, p.nome FROM participante p
				WHERE p.ativo = 1
				  AND p.ativo_manual = 0
				  AND EXISTS (
					SELECT 1 FROM reuniao_participante rp
					JOIN reuniao_projeto rpj ON rpj.reuniao_id = rp.reuniao_id
					WHERE rp.participante_id = p.id AND rpj.projeto_id = ?
				  )
				  AND NOT EXISTS (
					SELECT 1 FROM reuniao_participante rp2
					JOIN reuniao_projeto rpj2 ON rpj2.reuniao_id = rp2.reuniao_id
					JOIN projeto pr ON pr.id = rpj2.projeto_id
					WHERE rp2.participante_id = p.id AND pr.ativo = 1
				  )`, id)
			if err != nil {
				return fmt.Errorf("deactivation candidates query: %w", err)
			}
			defer rows.Close()

			var candidateIDs []int64
			for rows.Next() {
				var s model.ParticipantSummary
				if err := rows.Scan(&s.ID, &s.Nome); err != nil {
					return fmt.Errorf("deactivation candidates scan: %w", err)
				}
				candidateIDs = append(candidateIDs, s.ID)
				deactivated = append(deactivated, s)
			}
			if err := rows.Err(); err != nil {
				return fmt.Errorf("deactivation candidates iter: %w", err)
			}

			if len(candidateIDs) > 0 {
				placeholders := strings.Repeat("?,", len(candidateIDs))
				placeholders = placeholders[:len(placeholders)-1]
				args := make([]any, len(candidateIDs))
				for i, cid := range candidateIDs {
					args[i] = cid
				}
				if _, err := tx.Exec(
					fmt.Sprintf(`UPDATE participante SET ativo = 0 WHERE id IN (%s)`, placeholders),
					args...,
				); err != nil {
					return fmt.Errorf("deactivate participantes: %w", err)
				}
			}
		}

		return nil
	})
	if err != nil {
		return nil, nil, rejectedURLs, err
	}

	p, err := fetchProjectByID(db, id)
	if err != nil {
		return nil, nil, rejectedURLs, err
	}
	return p, deactivated, rejectedURLs, nil
}

// DeleteProject deletes a project if it is not linked to any meetings.
// Returns ErrLinked with a Portuguese message if meetings exist.
// Returns ErrNotFound if the project does not exist.
func DeleteProject(db *sql.DB, id int64) error {
	var total int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM reuniao_projeto WHERE projeto_id = ?`, id,
	).Scan(&total); err != nil {
		return fmt.Errorf("DeleteProject count: %w", err)
	}

	if total > 0 {
		rows, err := db.Query(
			`SELECT strftime('%d/%m/%Y', r.data_hora) AS data FROM reuniao r
			 JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
			 WHERE rp.projeto_id = ? ORDER BY r.data_hora LIMIT 5`,
			id,
		)
		if err != nil {
			return fmt.Errorf("DeleteProject dates: %w", err)
		}
		defer rows.Close()

		var dates []string
		for rows.Next() {
			var d string
			if err := rows.Scan(&d); err != nil {
				return fmt.Errorf("DeleteProject date scan: %w", err)
			}
			dates = append(dates, d)
		}
		if err := rows.Err(); err != nil {
			return fmt.Errorf("DeleteProject dates iter: %w", err)
		}

		extra := ""
		if total > 5 {
			extra = fmt.Sprintf(" e mais %d", total-5)
		}
		return fmt.Errorf("%w: Não é possível excluir: projeto vinculado a %d reunião(ões) (%s%s).",
			ErrLinked, total, strings.Join(dates, ", "), extra)
	}

	res, err := db.Exec(`DELETE FROM projeto WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("DeleteProject exec: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ReplaceProject remaps reuniao_projeto rows from fromID to toID.
// When dryRun is true, returns the affected meetings without modifying any data.
// When dryRun is false, runs the replacement inside a transaction.
func ReplaceProject(db *sql.DB, fromID, toID int64, dryRun bool) (*model.MaintenanceAffected, error) {
	const listSQL = `
		SELECT r.id,
		       strftime('%d/%m/%Y, %H:%M', r.data_hora) AS data_fmt,
		       COALESCE((SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT p2.nome FROM participante p2 JOIN reuniao_participante rp2 ON rp2.participante_id = p2.id WHERE rp2.reuniao_id = r.id ORDER BY p2.nome)), '—') AS participantes_nomes
		FROM reuniao r
		JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
		WHERE rp.projeto_id = ?
		ORDER BY r.data_hora DESC`

	rows, err := db.Query(listSQL, fromID)
	if err != nil {
		return nil, fmt.Errorf("ReplaceProject list: %w", err)
	}
	defer rows.Close()

	var affected []model.MaintenanceMeeting
	for rows.Next() {
		var m model.MaintenanceMeeting
		if err := rows.Scan(&m.ID, &m.DataFmt, &m.ParticipantesNomes); err != nil {
			return nil, fmt.Errorf("ReplaceProject scan: %w", err)
		}
		affected = append(affected, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ReplaceProject rows: %w", err)
	}

	result := &model.MaintenanceAffected{
		Affected: affected,
		Count:    len(affected),
	}

	if dryRun || len(affected) == 0 {
		return result, nil
	}

	err = WithTx(db, func(tx *sql.Tx) error {
		// Remove duplicate links that would conflict after the remap.
		if _, err := tx.Exec(
			`DELETE FROM reuniao_projeto WHERE projeto_id = ? AND reuniao_id IN (SELECT reuniao_id FROM reuniao_projeto WHERE projeto_id = ?)`,
			fromID, toID,
		); err != nil {
			return fmt.Errorf("ReplaceProject delete duplicates: %w", err)
		}
		// Remap remaining rows to the target project.
		if _, err := tx.Exec(
			`UPDATE reuniao_projeto SET projeto_id = ? WHERE projeto_id = ?`,
			toID, fromID,
		); err != nil {
			return fmt.Errorf("ReplaceProject update: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// PatchProjectAtivo updates only the ativo field.
// Returns ErrNotFound if the id does not exist.
func PatchProjectAtivo(db *sql.DB, id int64, ativo bool) (*model.Project, error) {
	ativoInt := 0
	if ativo {
		ativoInt = 1
	}
	res, err := db.Exec(`UPDATE projeto SET ativo=? WHERE id=?`, ativoInt, id)
	if err != nil {
		return nil, fmt.Errorf("PatchProjectAtivo: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}
	return fetchProjectByID(db, id)
}

// isUniqueConstraintError reports whether err is a SQLite UNIQUE constraint violation.
func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "UNIQUE constraint failed") ||
		strings.Contains(msg, "constraint failed: UNIQUE")
}

// ptrStr safely dereferences a *string, returning "" for nil.
func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// nilIfEmpty returns nil if s is empty, otherwise returns a pointer to s.
func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
