package store

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/edalcin/meetinglog/internal/model"
)

// ListParticipants returns participants filtered by an optional search term and
// ativo flag. When ativo is nil no filter is applied on that column.
func ListParticipants(db *sql.DB, q string, ativo *bool, limit int) ([]model.Participant, int, error) {
	var conditions []string
	var args []any

	if q != "" {
		conditions = append(conditions, "(nome LIKE ? OR instituicao LIKE ? OR lotacao LIKE ? OR notas LIKE ?)")
		like := "%" + q + "%"
		args = append(args, like, like, like, like)
	}
	if ativo != nil {
		if *ativo {
			conditions = append(conditions, "ativo = 1")
		} else {
			conditions = append(conditions, "ativo = 0")
		}
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	if err := db.QueryRow(
		fmt.Sprintf("SELECT COUNT(*) FROM participante %s", where),
		args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("ListParticipants count: %w", err)
	}

	rows, err := db.Query(fmt.Sprintf(`
		SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas,
		       (SELECT COUNT(*) FROM reuniao_participante WHERE participante_id = participante.id) AS reuniao_count
		FROM participante %s ORDER BY nome ASC LIMIT ?`, where),
		append(args, limit)...,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("ListParticipants query: %w", err)
	}
	defer rows.Close()

	var list []model.Participant
	for rows.Next() {
		p, err := scanParticipant(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("ListParticipants scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("ListParticipants rows: %w", err)
	}
	return list, total, nil
}

// scanParticipant reads the common column set used by both list and detail queries.
// The query must select: id, nome, instituicao, lotacao, cargo, email, ativo, notas, reuniao_count.
func scanParticipant(rows *sql.Rows) (model.Participant, error) {
	var p model.Participant
	var inst, lotacao, cargo, email, notas sql.NullString
	var ativo int
	if err := rows.Scan(
		&p.ID, &p.Nome, &inst, &lotacao, &cargo, &email, &ativo, &notas, &p.ReuniaoCount,
	); err != nil {
		return p, err
	}
	p.Ativo = ativo != 0
	if inst.Valid {
		p.Instituicao = &inst.String
	}
	if lotacao.Valid {
		p.Lotacao = &lotacao.String
	}
	if cargo.Valid {
		p.Cargo = &cargo.String
	}
	if email.Valid {
		p.Email = &email.String
	}
	if notas.Valid {
		p.Notas = &notas.String
	}
	return p, nil
}

// GetParticipant returns one participant together with their meetings and projects.
// Returns ErrNotFound when no row matches.
func GetParticipant(db *sql.DB, id int64) (*model.Participant, error) {
	rows, err := db.Query(`
		SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas,
		       (SELECT COUNT(*) FROM reuniao_participante WHERE participante_id = participante.id) AS reuniao_count
		FROM participante WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("GetParticipant query: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("GetParticipant rows: %w", err)
		}
		return nil, ErrNotFound
	}
	p, err := scanParticipant(rows)
	if err != nil {
		return nil, fmt.Errorf("GetParticipant scan: %w", err)
	}
	rows.Close()

	// Meetings ordered by most recent first, with their project names.
	rRows, err := db.Query(`
		SELECT r.id, r.data_hora,
		       COALESCE((SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT DISTINCT p2.nome FROM projeto p2 JOIN reuniao_projeto rpj2 ON rpj2.projeto_id = p2.id WHERE rpj2.reuniao_id = r.id ORDER BY p2.nome)), '') AS projeto_nomes
		FROM reuniao_participante rp
		JOIN reuniao r ON r.id = rp.reuniao_id
		WHERE rp.participante_id = ?
		ORDER BY r.data_hora DESC`, id)
	if err != nil {
		return nil, fmt.Errorf("GetParticipant reunioes: %w", err)
	}
	defer rRows.Close()
	for rRows.Next() {
		var m model.MeetingSummary
		if err := rRows.Scan(&m.ID, &m.DataHora, &m.ProjetoNomes); err != nil {
			return nil, fmt.Errorf("GetParticipant reuniao scan: %w", err)
		}
		p.Reunioes = append(p.Reunioes, m)
	}
	if err := rRows.Err(); err != nil {
		return nil, fmt.Errorf("GetParticipant reuniao rows: %w", err)
	}

	// Distinct projects the participant has appeared in.
	prRows, err := db.Query(`
		SELECT DISTINCT p.id, p.nome, p.ativo
		FROM reuniao_participante rp
		JOIN reuniao_projeto rpj ON rpj.reuniao_id = rp.reuniao_id
		JOIN projeto p ON p.id = rpj.projeto_id
		WHERE rp.participante_id = ?
		ORDER BY p.nome`, id)
	if err != nil {
		return nil, fmt.Errorf("GetParticipant projetos: %w", err)
	}
	defer prRows.Close()
	for prRows.Next() {
		var ps model.ProjectSummary
		var ativo int
		if err := prRows.Scan(&ps.ID, &ps.Nome, &ativo); err != nil {
			return nil, fmt.Errorf("GetParticipant projeto scan: %w", err)
		}
		ps.Ativo = ativo != 0
		p.Projetos = append(p.Projetos, ps)
	}
	if err := prRows.Err(); err != nil {
		return nil, fmt.Errorf("GetParticipant projeto rows: %w", err)
	}

	return &p, nil
}

// CreateParticipant inserts a new participant row.
// Returns a wrapped ErrConflict when the nome already exists.
func CreateParticipant(db *sql.DB, nome string, instituicao, lotacao, cargo, email, notas *string, ativo bool) (*model.Participant, error) {
	ativoInt := 0
	if ativo {
		ativoInt = 1
	}
	res, err := db.Exec(
		`INSERT INTO participante (nome, instituicao, lotacao, cargo, email, ativo, ativo_manual, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		nome, instituicao, lotacao, cargo, email, ativoInt, ativoInt, notas,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, fmt.Errorf("Já existe um participante com este nome: %w", ErrConflict)
		}
		return nil, fmt.Errorf("CreateParticipant: %w", err)
	}
	id, _ := res.LastInsertId()
	return GetParticipant(db, id)
}

// UpdateParticipant replaces all mutable fields of a participant.
// Returns a wrapped ErrConflict on nome collision, ErrNotFound when id is missing.
func UpdateParticipant(db *sql.DB, id int64, nome string, instituicao, lotacao, cargo, email, notas *string, ativo bool) (*model.Participant, error) {
	ativoInt := 0
	if ativo {
		ativoInt = 1
	}
	res, err := db.Exec(
		`UPDATE participante SET nome=?, instituicao=?, lotacao=?, cargo=?, email=?, ativo=?, ativo_manual=?, notas=? WHERE id=?`,
		nome, instituicao, lotacao, cargo, email, ativoInt, ativoInt, notas, id,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, fmt.Errorf("Já existe um participante com este nome: %w", ErrConflict)
		}
		return nil, fmt.Errorf("UpdateParticipant: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}
	return GetParticipant(db, id)
}

// DeleteParticipant removes a participant only when they have no meeting links.
// Returns a wrapped ErrLinked (with a Portuguese message listing up to 5 dates)
// when meetings exist, or ErrNotFound when the id does not match any row.
func DeleteParticipant(db *sql.DB, id int64) error {
	var total int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM reuniao_participante WHERE participante_id = ?`, id,
	).Scan(&total); err != nil {
		return fmt.Errorf("DeleteParticipant count: %w", err)
	}

	if total > 0 {
		dateRows, err := db.Query(`
			SELECT strftime('%d/%m/%Y', r.data_hora) AS data
			FROM reuniao r
			JOIN reuniao_participante rp ON rp.reuniao_id = r.id
			WHERE rp.participante_id = ?
			ORDER BY r.data_hora LIMIT 5`, id)
		if err != nil {
			return fmt.Errorf("DeleteParticipant dates: %w", err)
		}
		defer dateRows.Close()
		var dates []string
		for dateRows.Next() {
			var d string
			if err := dateRows.Scan(&d); err != nil {
				return fmt.Errorf("DeleteParticipant date scan: %w", err)
			}
			dates = append(dates, d)
		}
		dateRows.Close()

		extra := ""
		if total > 5 {
			extra = fmt.Sprintf(" e mais %d", total-5)
		}
		return fmt.Errorf("Não é possível excluir: participante vinculado a %d reunião(ões) (%s%s).: %w",
			total, strings.Join(dates, ", "), extra, ErrLinked)
	}

	res, err := db.Exec(`DELETE FROM participante WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("DeleteParticipant: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ReplaceParticipant substitutes fromID with toID in all meetings.
// When dryRun is false, runs the replacement inside a transaction.
func ReplaceParticipant(db *sql.DB, fromID, toID int64, dryRun bool) (*model.MaintenanceAffected, error) {
	const listSQL = `
		SELECT r.id,
		       strftime('%d/%m/%Y, %H:%M', r.data_hora) AS data_fmt,
		       COALESCE((SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT p2.nome FROM participante p2 JOIN reuniao_participante rp2 ON rp2.participante_id = p2.id WHERE rp2.reuniao_id = r.id ORDER BY p2.nome)), '—') AS participantes_nomes
		FROM reuniao r
		JOIN reuniao_participante rp ON rp.reuniao_id = r.id
		WHERE rp.participante_id = ?
		ORDER BY r.data_hora DESC`

	rows, err := db.Query(listSQL, fromID)
	if err != nil {
		return nil, fmt.Errorf("ReplaceParticipant list: %w", err)
	}
	defer rows.Close()

	var affected []model.MaintenanceMeeting
	for rows.Next() {
		var m model.MaintenanceMeeting
		if err := rows.Scan(&m.ID, &m.DataFmt, &m.ParticipantesNomes); err != nil {
			return nil, fmt.Errorf("ReplaceParticipant scan: %w", err)
		}
		affected = append(affected, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ReplaceParticipant rows: %w", err)
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
			`DELETE FROM reuniao_participante WHERE participante_id = ? AND reuniao_id IN (SELECT reuniao_id FROM reuniao_participante WHERE participante_id = ?)`,
			fromID, toID,
		); err != nil {
			return fmt.Errorf("ReplaceParticipant delete duplicates: %w", err)
		}
		// Remap remaining rows to the target participant.
		if _, err := tx.Exec(
			`UPDATE reuniao_participante SET participante_id = ? WHERE participante_id = ?`,
			toID, fromID,
		); err != nil {
			return fmt.Errorf("ReplaceParticipant update: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
