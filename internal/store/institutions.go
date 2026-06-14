package store

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/edalcin/meetinglog/internal/model"
)

// ListInstitutions returns institutions with optional search filter and counts.
func ListInstitutions(db *sql.DB, q string, limit int) ([]model.Institution, int, error) {
	where := ""
	var args []any
	if q != "" {
		where = "WHERE sigla LIKE ? OR nome LIKE ?"
		like := "%" + q + "%"
		args = append(args, like, like)
	}

	var total int
	if err := db.QueryRow(
		fmt.Sprintf("SELECT COUNT(*) FROM instituicao %s", where),
		args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("ListInstitutions count: %w", err)
	}

	rows, err := db.Query(fmt.Sprintf(`
		SELECT id, sigla, nome,
		       (SELECT COUNT(*) FROM participante WHERE instituicao = instituicao.sigla) AS participante_count,
		       (SELECT COUNT(*) FROM projeto_instituicao WHERE instituicao_id = instituicao.id) AS projeto_count
		FROM instituicao %s ORDER BY sigla ASC LIMIT ?`, where),
		append(args, limit)...,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("ListInstitutions query: %w", err)
	}
	defer rows.Close()

	var list []model.Institution
	for rows.Next() {
		inst, err := scanInstitution(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("ListInstitutions scan: %w", err)
		}
		list = append(list, inst)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("ListInstitutions rows: %w", err)
	}
	return list, total, nil
}

// scanInstitution reads the columns returned by list/detail SELECT statements:
// id, sigla, nome, participante_count, projeto_count.
func scanInstitution(rows *sql.Rows) (model.Institution, error) {
	var inst model.Institution
	var nome sql.NullString
	if err := rows.Scan(
		&inst.ID, &inst.Sigla, &nome,
		&inst.ParticipanteCount, &inst.ProjetoCount,
	); err != nil {
		return inst, err
	}
	if nome.Valid {
		inst.Nome = &nome.String
	}
	return inst, nil
}

// GetInstitution returns one institution with its participants and projects.
// Returns ErrNotFound when no row matches.
func GetInstitution(db *sql.DB, id int64) (*model.Institution, error) {
	var inst model.Institution
	var nome sql.NullString
	err := db.QueryRow(
		`SELECT id, sigla, nome FROM instituicao WHERE id = ?`, id,
	).Scan(&inst.ID, &inst.Sigla, &nome)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("GetInstitution base: %w", err)
	}
	if nome.Valid {
		inst.Nome = &nome.String
	}

	// Participants belonging to this institution (matched by sigla string).
	pRows, err := db.Query(
		`SELECT id, nome, lotacao, cargo, ativo FROM participante WHERE instituicao = ? ORDER BY nome ASC`,
		inst.Sigla,
	)
	if err != nil {
		return nil, fmt.Errorf("GetInstitution participantes: %w", err)
	}
	defer pRows.Close()
	for pRows.Next() {
		var p model.Participant
		var lotacao, cargo sql.NullString
		var ativo int
		if err := pRows.Scan(&p.ID, &p.Nome, &lotacao, &cargo, &ativo); err != nil {
			return nil, fmt.Errorf("GetInstitution participante scan: %w", err)
		}
		p.Ativo = ativo != 0
		if lotacao.Valid {
			p.Lotacao = &lotacao.String
		}
		if cargo.Valid {
			p.Cargo = &cargo.String
		}
		inst.Participantes = append(inst.Participantes, p)
	}
	if err := pRows.Err(); err != nil {
		return nil, fmt.Errorf("GetInstitution participante rows: %w", err)
	}

	// Projects linked via projeto_instituicao.
	prRows, err := db.Query(`
		SELECT p.id, p.nome, p.ativo
		FROM projeto p
		JOIN projeto_instituicao pi ON pi.projeto_id = p.id
		WHERE pi.instituicao_id = ?
		ORDER BY p.nome ASC`, id)
	if err != nil {
		return nil, fmt.Errorf("GetInstitution projetos: %w", err)
	}
	defer prRows.Close()
	for prRows.Next() {
		var ps model.ProjectSummary
		var ativo int
		if err := prRows.Scan(&ps.ID, &ps.Nome, &ativo); err != nil {
			return nil, fmt.Errorf("GetInstitution projeto scan: %w", err)
		}
		ps.Ativo = ativo != 0
		inst.Projetos = append(inst.Projetos, ps)
	}
	if err := prRows.Err(); err != nil {
		return nil, fmt.Errorf("GetInstitution projeto rows: %w", err)
	}

	return &inst, nil
}

// CreateInstitution inserts a new institution.
// Returns a wrapped ErrConflict when the sigla already exists.
func CreateInstitution(db *sql.DB, sigla string, nome *string) (*model.Institution, error) {
	res, err := db.Exec(
		`INSERT INTO instituicao (sigla, nome) VALUES (?, ?)`,
		sigla, nome,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, fmt.Errorf("Já existe uma instituição com esta sigla: %w", ErrConflict)
		}
		return nil, fmt.Errorf("CreateInstitution: %w", err)
	}
	id, _ := res.LastInsertId()
	return GetInstitution(db, id)
}

// UpdateInstitution updates an institution's sigla and nome in a transaction.
// When the sigla changes, all participante rows that reference the old sigla
// are updated to the new one.
// Returns (updated institution, old sigla, error).
func UpdateInstitution(db *sql.DB, id int64, sigla string, nome *string) (*model.Institution, string, error) {
	var oldSigla string

	err := WithTx(db, func(tx *sql.Tx) error {
		if err := tx.QueryRow(
			`SELECT sigla FROM instituicao WHERE id = ?`, id,
		).Scan(&oldSigla); err == sql.ErrNoRows {
			return ErrNotFound
		} else if err != nil {
			return fmt.Errorf("select old sigla: %w", err)
		}

		res, err := tx.Exec(
			`UPDATE instituicao SET sigla = ?, nome = ? WHERE id = ?`,
			sigla, nome, id,
		)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				return fmt.Errorf("Já existe uma instituição com esta sigla: %w", ErrConflict)
			}
			return fmt.Errorf("update instituicao: %w", err)
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			return ErrNotFound
		}

		if oldSigla != sigla {
			if _, err := tx.Exec(
				`UPDATE participante SET instituicao = ? WHERE instituicao = ?`,
				sigla, oldSigla,
			); err != nil {
				return fmt.Errorf("cascade participante sigla: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, "", fmt.Errorf("UpdateInstitution: %w", err)
	}

	inst, err := GetInstitution(db, id)
	if err != nil {
		return nil, "", err
	}
	return inst, oldSigla, nil
}

// DeleteInstitution removes an institution only when it has no linked
// participants or projects. Returns a wrapped ErrLinked with a Portuguese
// message (listing up to 5 names for each category) when links exist, or
// ErrNotFound when the id does not match any row.
func DeleteInstitution(db *sql.DB, id int64) error {
	var sigla string
	if err := db.QueryRow(`SELECT sigla FROM instituicao WHERE id = ?`, id).Scan(&sigla); err == sql.ErrNoRows {
		return ErrNotFound
	} else if err != nil {
		return fmt.Errorf("DeleteInstitution lookup: %w", err)
	}

	var pTotal int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM participante WHERE instituicao = ?`, sigla,
	).Scan(&pTotal); err != nil {
		return fmt.Errorf("DeleteInstitution pCount: %w", err)
	}

	var prTotal int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM projeto_instituicao WHERE instituicao_id = ?`, id,
	).Scan(&prTotal); err != nil {
		return fmt.Errorf("DeleteInstitution prCount: %w", err)
	}

	if pTotal > 0 || prTotal > 0 {
		var parts []string

		if pTotal > 0 {
			pRows, err := db.Query(
				`SELECT nome FROM participante WHERE instituicao = ? ORDER BY nome LIMIT 5`, sigla)
			if err != nil {
				return fmt.Errorf("DeleteInstitution pNames: %w", err)
			}
			defer pRows.Close()
			var names []string
			for pRows.Next() {
				var n string
				if err := pRows.Scan(&n); err != nil {
					return fmt.Errorf("DeleteInstitution pName scan: %w", err)
				}
				names = append(names, n)
			}
			pRows.Close()
			extra := ""
			if pTotal > 5 {
				extra = fmt.Sprintf(" e mais %d", pTotal-5)
			}
			parts = append(parts, fmt.Sprintf("%d participante(s): %s%s", pTotal, strings.Join(names, ", "), extra))
		}

		if prTotal > 0 {
			prRows, err := db.Query(`
				SELECT p.nome FROM projeto p
				JOIN projeto_instituicao pi ON pi.projeto_id = p.id
				WHERE pi.instituicao_id = ?
				ORDER BY p.nome LIMIT 5`, id)
			if err != nil {
				return fmt.Errorf("DeleteInstitution prNames: %w", err)
			}
			defer prRows.Close()
			var names []string
			for prRows.Next() {
				var n string
				if err := prRows.Scan(&n); err != nil {
					return fmt.Errorf("DeleteInstitution prName scan: %w", err)
				}
				names = append(names, n)
			}
			prRows.Close()
			extra := ""
			if prTotal > 5 {
				extra = fmt.Sprintf(" e mais %d", prTotal-5)
			}
			parts = append(parts, fmt.Sprintf("%d projeto(s): %s%s", prTotal, strings.Join(names, ", "), extra))
		}

		return fmt.Errorf("Não é possível excluir: vinculada a %s.: %w",
			strings.Join(parts, " e "), ErrLinked)
	}

	res, err := db.Exec(`DELETE FROM instituicao WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("DeleteInstitution: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
