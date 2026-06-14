package store

import (
	"database/sql"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/edalcin/meetinglog/internal/model"
)

// allowedMeetingSort lists the column names that callers may sort by.
var allowedMeetingSort = map[string]bool{
	"data_hora":          true,
	"tipo":               true,
	"participantes_nomes": true,
	"projeto_nomes":      true,
}

// isAllowedURL returns true only for http and https URLs.
func isAllowedURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return u.Scheme == "http" || u.Scheme == "https"
}

// parseIDStr splits a comma-separated string of integers into a []int64,
// skipping any token that is not a positive integer.
func parseIDStr(s string) []int64 {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]int64, 0, len(parts))
	for _, p := range parts {
		v, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64)
		if err == nil && v > 0 {
			out = append(out, v)
		}
	}
	return out
}

// placeholders returns n comma-separated "?" tokens for use in SQL IN clauses.
func placeholders(n int) string {
	if n == 0 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?,", n), ",")
}

// scanMeetingRow maps the columns returned by the list SELECT into a Meeting.
func scanMeetingRow(rows *sql.Rows) (model.Meeting, error) {
	var m model.Meeting
	var hasNotas int
	var participantesNomes, participanteIDsStr, projetoNomes, projetoIDsStr sql.NullString

	if err := rows.Scan(
		&m.ID,
		&m.DataHora,
		&m.Tipo,
		&m.CriadoEm,
		&m.AtualizadoEm,
		&hasNotas,
		&m.ArquivoCount,
		&participantesNomes,
		&participanteIDsStr,
		&projetoNomes,
		&projetoIDsStr,
	); err != nil {
		return m, err
	}

	m.HasNotas = hasNotas != 0
	m.ParticipantesNomes = participantesNomes.String
	m.ProjetoNomes = projetoNomes.String
	m.ParticipanteIDs = parseIDStr(participanteIDsStr.String)
	m.ProjetoIDs = parseIDStr(projetoIDsStr.String)
	return m, nil
}

// ListMeetings returns a paginated list of meetings with optional AND-filters
// for participants (partIDs) and projects (projIDs). All IDs in each list must
// appear in the meeting for it to match.
func ListMeetings(db *sql.DB, partIDs []int64, projIDs []int64, sort, order string, page, limit int) ([]model.Meeting, int, error) {
	if !allowedMeetingSort[sort] {
		sort = "data_hora"
	}
	if order != "ASC" && order != "DESC" {
		order = "DESC"
	}

	// Build WHERE clause and args.
	var conditions []string
	var args []any

	if len(partIDs) > 0 {
		conditions = append(conditions, fmt.Sprintf(
			"r.id IN (SELECT reuniao_id FROM reuniao_participante WHERE participante_id IN (%s) GROUP BY reuniao_id HAVING COUNT(DISTINCT participante_id) = ?)",
			placeholders(len(partIDs)),
		))
		for _, id := range partIDs {
			args = append(args, id)
		}
		args = append(args, len(partIDs))
	}
	if len(projIDs) > 0 {
		conditions = append(conditions, fmt.Sprintf(
			"r.id IN (SELECT reuniao_id FROM reuniao_projeto WHERE projeto_id IN (%s) GROUP BY reuniao_id HAVING COUNT(DISTINCT projeto_id) = ?)",
			placeholders(len(projIDs)),
		))
		for _, id := range projIDs {
			args = append(args, id)
		}
		args = append(args, len(projIDs))
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Map sort name to the expression used in ORDER BY.
	sortExpr := "r." + sort
	if sort == "participantes_nomes" || sort == "projeto_nomes" {
		sortExpr = sort
	}

	// Count query shares the same WHERE + args.
	var total int
	if err := db.QueryRow(
		fmt.Sprintf("SELECT COUNT(*) FROM reuniao r %s", where),
		args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("ListMeetings count: %w", err)
	}

	offset := (page - 1) * limit
	listArgs := append(args, limit, offset)

	rows, err := db.Query(fmt.Sprintf(`
		SELECT r.id, r.data_hora, r.tipo, r.criado_em, r.atualizado_em,
		       (r.notas IS NOT NULL) AS has_notas,
		       (SELECT COUNT(*) FROM arquivo WHERE reuniao_id = r.id) AS arquivo_count,
		       (SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT p2.nome FROM participante p2 JOIN reuniao_participante rp2 ON rp2.participante_id = p2.id WHERE rp2.reuniao_id = r.id ORDER BY p2.nome)) AS participantes_nomes,
		       (SELECT GROUP_CONCAT(id, ',') FROM (SELECT p2.id FROM participante p2 JOIN reuniao_participante rp2 ON rp2.participante_id = p2.id WHERE rp2.reuniao_id = r.id ORDER BY p2.nome)) AS participante_ids_str,
		       (SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT pr2.nome FROM projeto pr2 JOIN reuniao_projeto rpj2 ON rpj2.projeto_id = pr2.id WHERE rpj2.reuniao_id = r.id ORDER BY pr2.nome)) AS projeto_nomes,
		       (SELECT GROUP_CONCAT(id, ',') FROM (SELECT pr2.id FROM projeto pr2 JOIN reuniao_projeto rpj2 ON rpj2.projeto_id = pr2.id WHERE rpj2.reuniao_id = r.id ORDER BY pr2.nome)) AS projeto_ids_str
		FROM reuniao r
		%s
		ORDER BY %s %s
		LIMIT ? OFFSET ?`, where, sortExpr, order),
		listArgs...,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("ListMeetings query: %w", err)
	}
	defer rows.Close()

	var meetings []model.Meeting
	for rows.Next() {
		m, err := scanMeetingRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("ListMeetings scan: %w", err)
		}
		meetings = append(meetings, m)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("ListMeetings rows: %w", err)
	}
	return meetings, total, nil
}

// GetMeeting returns a single meeting with all sub-entities populated.
// Returns ErrNotFound when no row matches.
func GetMeeting(db *sql.DB, id int64) (*model.Meeting, error) {
	var m model.Meeting
	var notas sql.NullString
	err := db.QueryRow(
		`SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao WHERE id = ?`,
		id,
	).Scan(&m.ID, &m.DataHora, &m.Tipo, &notas, &m.CriadoEm, &m.AtualizadoEm)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("GetMeeting base: %w", err)
	}
	if notas.Valid {
		m.Notas = &notas.String
	}

	// Participants.
	pRows, err := db.Query(`
		SELECT p.id, p.nome, p.instituicao, p.cargo, p.email
		FROM reuniao_participante rp
		JOIN participante p ON p.id = rp.participante_id
		WHERE rp.reuniao_id = ?
		ORDER BY p.nome`, id)
	if err != nil {
		return nil, fmt.Errorf("GetMeeting participants: %w", err)
	}
	defer pRows.Close()
	for pRows.Next() {
		var p model.Participant
		var inst, cargo, email sql.NullString
		if err := pRows.Scan(&p.ID, &p.Nome, &inst, &cargo, &email); err != nil {
			return nil, fmt.Errorf("GetMeeting participant scan: %w", err)
		}
		if inst.Valid {
			p.Instituicao = &inst.String
		}
		if cargo.Valid {
			p.Cargo = &cargo.String
		}
		if email.Valid {
			p.Email = &email.String
		}
		m.Participantes = append(m.Participantes, p)
	}
	if err := pRows.Err(); err != nil {
		return nil, fmt.Errorf("GetMeeting participant rows: %w", err)
	}

	// Projects with institution names.
	prRows, err := db.Query(`
		SELECT pr.id, pr.nome, pr.ativo,
		       COALESCE((SELECT GROUP_CONCAT(sigla, ', ') FROM (SELECT DISTINCT i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = pr.id ORDER BY i2.sigla)), '') AS instituicao_nomes
		FROM reuniao_projeto rpj
		JOIN projeto pr ON pr.id = rpj.projeto_id
		WHERE rpj.reuniao_id = ?
		ORDER BY pr.nome`, id)
	if err != nil {
		return nil, fmt.Errorf("GetMeeting projects: %w", err)
	}
	defer prRows.Close()
	for prRows.Next() {
		var p model.Project
		var ativo int
		if err := prRows.Scan(&p.ID, &p.Nome, &ativo, &p.InstituicaoNomes); err != nil {
			return nil, fmt.Errorf("GetMeeting project scan: %w", err)
		}
		p.Ativo = ativo != 0
		m.Projetos = append(m.Projetos, p)
	}
	if err := prRows.Err(); err != nil {
		return nil, fmt.Errorf("GetMeeting project rows: %w", err)
	}

	// Agenda items.
	paRows, err := db.Query(
		`SELECT id, texto, ordem FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC`, id)
	if err != nil {
		return nil, fmt.Errorf("GetMeeting pautas: %w", err)
	}
	defer paRows.Close()
	for paRows.Next() {
		var p model.Pauta
		if err := paRows.Scan(&p.ID, &p.Texto, &p.Ordem); err != nil {
			return nil, fmt.Errorf("GetMeeting pauta scan: %w", err)
		}
		m.Pautas = append(m.Pautas, p)
	}
	if err := paRows.Err(); err != nil {
		return nil, fmt.Errorf("GetMeeting pauta rows: %w", err)
	}

	// Links.
	lkRows, err := db.Query(
		`SELECT id, nome, url, ordem FROM link WHERE reuniao_id = ? ORDER BY ordem ASC`, id)
	if err != nil {
		return nil, fmt.Errorf("GetMeeting links: %w", err)
	}
	defer lkRows.Close()
	for lkRows.Next() {
		var l model.Link
		var nome sql.NullString
		if err := lkRows.Scan(&l.ID, &nome, &l.URL, &l.Ordem); err != nil {
			return nil, fmt.Errorf("GetMeeting link scan: %w", err)
		}
		if nome.Valid {
			l.Nome = &nome.String
		}
		m.Links = append(m.Links, l)
	}
	if err := lkRows.Err(); err != nil {
		return nil, fmt.Errorf("GetMeeting link rows: %w", err)
	}

	// Build convenience denormalized fields.
	for _, p := range m.Participantes {
		m.ParticipanteIDs = append(m.ParticipanteIDs, p.ID)
		if m.ParticipantesNomes != "" {
			m.ParticipantesNomes += ", "
		}
		m.ParticipantesNomes += p.Nome
	}
	for _, p := range m.Projetos {
		m.ProjetoIDs = append(m.ProjetoIDs, p.ID)
		if m.ProjetoNomes != "" {
			m.ProjetoNomes += ", "
		}
		m.ProjetoNomes += p.Nome
	}

	return &m, nil
}

// filterLinks separates incoming links into valid (http/https) and rejected ones.
// Links with blank name or URL are silently skipped.
func filterLinks(links []model.Link) (valid []model.Link, rejected []string) {
	for _, l := range links {
		nome := ""
		if l.Nome != nil {
			nome = strings.TrimSpace(*l.Nome)
		}
		u := strings.TrimSpace(l.URL)
		if nome == "" || u == "" {
			continue
		}
		if isAllowedURL(u) {
			trimmedNome := nome
			valid = append(valid, model.Link{Nome: &trimmedNome, URL: u})
		} else {
			rejected = append(rejected, u)
		}
	}
	return
}

// insertMeetingRelations inserts participant links, project links, pautas and
// links for a meeting inside an existing transaction.
func insertMeetingRelations(tx *sql.Tx, meetingID int64, participanteIDs, projetoIDs []int64, pautas []string, validLinks []model.Link) error {
	for _, pid := range participanteIDs {
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO reuniao_participante (reuniao_id, participante_id) VALUES (?, ?)`,
			meetingID, pid,
		); err != nil {
			return fmt.Errorf("insert participante %d: %w", pid, err)
		}
	}
	for _, prid := range projetoIDs {
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO reuniao_projeto (reuniao_id, projeto_id) VALUES (?, ?)`,
			meetingID, prid,
		); err != nil {
			return fmt.Errorf("insert projeto %d: %w", prid, err)
		}
	}
	for i, texto := range pautas {
		t := strings.TrimSpace(texto)
		if t == "" {
			continue
		}
		if _, err := tx.Exec(
			`INSERT INTO pauta (reuniao_id, texto, ordem) VALUES (?, ?, ?)`,
			meetingID, t, i,
		); err != nil {
			return fmt.Errorf("insert pauta %d: %w", i, err)
		}
	}
	for i, l := range validLinks {
		if _, err := tx.Exec(
			`INSERT INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)`,
			meetingID, l.Nome, l.URL, i,
		); err != nil {
			return fmt.Errorf("insert link %d: %w", i, err)
		}
	}
	return nil
}

// CreateMeeting inserts a meeting and its relations in a single transaction.
// URLs that are not http/https are returned in rejectedURLs and not stored.
func CreateMeeting(db *sql.DB, dataHora, tipo string, notas *string, participanteIDs, projetoIDs []int64, pautas []string, links []model.Link) (*model.Meeting, []string, error) {
	validLinks, rejected := filterLinks(links)

	var meetingID int64
	err := WithTx(db, func(tx *sql.Tx) error {
		res, err := tx.Exec(
			`INSERT INTO reuniao (data_hora, tipo, notas) VALUES (?, ?, ?)`,
			dataHora, tipo, notas,
		)
		if err != nil {
			return fmt.Errorf("insert reuniao: %w", err)
		}
		id, err := res.LastInsertId()
		if err != nil {
			return fmt.Errorf("last insert id: %w", err)
		}
		meetingID = id
		return insertMeetingRelations(tx, meetingID, participanteIDs, projetoIDs, pautas, validLinks)
	})
	if err != nil {
		return nil, nil, fmt.Errorf("CreateMeeting: %w", err)
	}

	m, err := GetMeeting(db, meetingID)
	if err != nil {
		return nil, nil, err
	}
	m.RejectedURLs = rejected
	return m, rejected, nil
}

// UpdateMeeting replaces a meeting's data and all its relations in a single
// transaction. URLs that are not http/https are returned in rejectedURLs.
func UpdateMeeting(db *sql.DB, id int64, dataHora, tipo string, notas *string, participanteIDs, projetoIDs []int64, pautas []string, links []model.Link) (*model.Meeting, []string, error) {
	validLinks, rejected := filterLinks(links)

	err := WithTx(db, func(tx *sql.Tx) error {
		res, err := tx.Exec(
			`UPDATE reuniao SET data_hora = ?, tipo = ?, notas = ? WHERE id = ?`,
			dataHora, tipo, notas, id,
		)
		if err != nil {
			return fmt.Errorf("update reuniao: %w", err)
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			return ErrNotFound
		}

		// Delete then reinsert join rows so ordering and membership are accurate.
		for _, stmt := range []string{
			`DELETE FROM reuniao_participante WHERE reuniao_id = ?`,
			`DELETE FROM reuniao_projeto WHERE reuniao_id = ?`,
			`DELETE FROM pauta WHERE reuniao_id = ?`,
			`DELETE FROM link WHERE reuniao_id = ?`,
		} {
			if _, err := tx.Exec(stmt, id); err != nil {
				return fmt.Errorf("delete relations: %w", err)
			}
		}
		return insertMeetingRelations(tx, id, participanteIDs, projetoIDs, pautas, validLinks)
	})
	if err != nil {
		return nil, nil, fmt.Errorf("UpdateMeeting: %w", err)
	}

	m, err := GetMeeting(db, id)
	if err != nil {
		return nil, nil, err
	}
	m.RejectedURLs = rejected
	return m, rejected, nil
}

// UpdateMeetingNotes updates only the notas field of a meeting.
// Returns ErrNotFound when no row matches.
func UpdateMeetingNotes(db *sql.DB, id int64, notas *string) error {
	res, err := db.Exec(`UPDATE reuniao SET notas = ? WHERE id = ?`, notas, id)
	if err != nil {
		return fmt.Errorf("UpdateMeetingNotes: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteMeeting removes a meeting. Cascade constraints in the schema handle
// child rows (participantes, projetos, pautas, links, arquivos).
// Returns ErrNotFound when no row matches.
func DeleteMeeting(db *sql.DB, id int64) error {
	res, err := db.Exec(`DELETE FROM reuniao WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("DeleteMeeting: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
