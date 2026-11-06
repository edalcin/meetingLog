package store

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/edalcin/meetinglog/internal/security"
)

// BuildAcervo serializes every record the Chat can read (Reuniões and the
// Participante, Projeto and Instituição records) as compact Markdown.
// Output is deterministic (fixed ORDER BY) so the prompt prefix stays
// identical between questions and the Gemini implicit cache can hit.
// ponytail: rebuilt on every question (few ms for ~600 Reuniões); add a
// fingerprint-keyed in-memory copy if this shows up in profiling.
func BuildAcervo(db *sql.DB) (string, error) {
	var b strings.Builder

	// name lists per meeting: participants, projects, pautas, links, files.
	type lists struct{ part, proj, pauta, link, file []string }
	per := map[int64]*lists{}
	get := func(id int64) *lists {
		if l, ok := per[id]; ok {
			return l
		}
		l := &lists{}
		per[id] = l
		return l
	}
	collect := func(q string, add func(l *lists, v string)) error {
		rows, err := db.Query(q)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			var v string
			if err := rows.Scan(&id, &v); err != nil {
				return err
			}
			add(get(id), v)
		}
		return rows.Err()
	}
	queries := []struct {
		q   string
		add func(l *lists, v string)
	}{
		{`SELECT rp.reuniao_id, p.nome || COALESCE(' (' || NULLIF(p.instituicao, '') || ')', '') || CASE WHEN p.ativo = 0 THEN ' (inativo)' ELSE '' END
		  FROM reuniao_participante rp JOIN participante p ON p.id = rp.participante_id ORDER BY rp.reuniao_id, p.nome`,
			func(l *lists, v string) { l.part = append(l.part, v) }},
		{`SELECT rp.reuniao_id, p.nome || CASE WHEN p.ativo = 0 THEN ' (inativo)' ELSE '' END
		  FROM reuniao_projeto rp JOIN projeto p ON p.id = rp.projeto_id ORDER BY rp.reuniao_id, p.nome`,
			func(l *lists, v string) { l.proj = append(l.proj, v) }},
		{`SELECT reuniao_id, texto FROM pauta ORDER BY reuniao_id, ordem, id`,
			func(l *lists, v string) { l.pauta = append(l.pauta, v) }},
		{`SELECT reuniao_id, COALESCE(NULLIF(nome, '') || ' ', '') || '<' || url || '>' FROM link ORDER BY reuniao_id, ordem, id`,
			func(l *lists, v string) { l.link = append(l.link, v) }},
		{`SELECT reuniao_id, filename_original FROM arquivo ORDER BY reuniao_id, letter`,
			func(l *lists, v string) { l.file = append(l.file, v) }},
	}
	for _, q := range queries {
		if err := collect(q.q, q.add); err != nil {
			return "", fmt.Errorf("BuildAcervo: %w", err)
		}
	}

	b.WriteString("# Reuniões\n")
	rows, err := db.Query(`SELECT id, data_hora, tipo, COALESCE(notas, '') FROM reuniao ORDER BY data_hora, id`)
	if err != nil {
		return "", fmt.Errorf("BuildAcervo: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var dataHora, tipo, notas string
		if err := rows.Scan(&id, &dataHora, &tipo, &notas); err != nil {
			return "", fmt.Errorf("BuildAcervo: %w", err)
		}
		fmt.Fprintf(&b, "\n## Reunião #%d — %s (%s)\n", id, strings.Replace(dataHora, "T", " ", 1), tipo)
		l := get(id)
		writeList(&b, "Projetos", l.proj, ", ")
		writeList(&b, "Participantes", l.part, ", ")
		writeList(&b, "Pautas", l.pauta, "; ")
		writeList(&b, "Links", l.link, ", ")
		writeList(&b, "Anexos", l.file, ", ")
		writeNotas(&b, notas)
	}
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("BuildAcervo: %w", err)
	}

	if err := writeParticipantes(db, &b); err != nil {
		return "", err
	}
	if err := writeProjetos(db, &b); err != nil {
		return "", err
	}
	if err := writeInstituicoes(db, &b); err != nil {
		return "", err
	}
	return b.String(), nil
}

func writeList(b *strings.Builder, label string, items []string, sep string) {
	if len(items) > 0 {
		fmt.Fprintf(b, "%s: %s\n", label, strings.Join(items, sep))
	}
}

func writeNotas(b *strings.Builder, html string) {
	if t := security.HTMLToText(html); t != "" {
		b.WriteString("Notas:\n")
		b.WriteString(t)
		b.WriteString("\n")
	}
}

func writeParticipantes(db *sql.DB, b *strings.Builder) error {
	rows, err := db.Query(`SELECT nome, ativo, COALESCE(instituicao, ''), COALESCE(lotacao, ''), COALESCE(cargo, ''), COALESCE(email, ''), COALESCE(notas, '')
		FROM participante ORDER BY nome`)
	if err != nil {
		return fmt.Errorf("BuildAcervo participantes: %w", err)
	}
	defer rows.Close()
	b.WriteString("\n# Participantes\n")
	for rows.Next() {
		var nome, inst, lot, cargo, email, notas string
		var ativo bool
		if err := rows.Scan(&nome, &ativo, &inst, &lot, &cargo, &email, &notas); err != nil {
			return fmt.Errorf("BuildAcervo participantes: %w", err)
		}
		b.WriteString("\n## " + nome + inativo(ativo) + "\n")
		writeList(b, "Dados", nonEmpty(inst, lot, cargo, email), "; ")
		writeNotas(b, notas)
	}
	return rows.Err()
}

func writeProjetos(db *sql.DB, b *strings.Builder) error {
	rows, err := db.Query(`SELECT p.nome, p.ativo, COALESCE(p.notas, ''),
		COALESCE((SELECT GROUP_CONCAT(sigla, ', ') FROM (SELECT i.sigla FROM projeto_instituicao pi JOIN instituicao i ON i.id = pi.instituicao_id WHERE pi.projeto_id = p.id ORDER BY i.sigla)), ''),
		COALESCE((SELECT GROUP_CONCAT(l, ', ') FROM (SELECT COALESCE(NULLIF(pl.nome, '') || ' ', '') || '<' || pl.url || '>' AS l FROM projeto_link pl WHERE pl.projeto_id = p.id ORDER BY pl.ordem, pl.id)), '')
		FROM projeto p ORDER BY p.nome`)
	if err != nil {
		return fmt.Errorf("BuildAcervo projetos: %w", err)
	}
	defer rows.Close()
	b.WriteString("\n# Projetos\n")
	for rows.Next() {
		var nome, notas, insts, links string
		var ativo bool
		if err := rows.Scan(&nome, &ativo, &notas, &insts, &links); err != nil {
			return fmt.Errorf("BuildAcervo projetos: %w", err)
		}
		b.WriteString("\n## " + nome + inativo(ativo) + "\n")
		writeList(b, "Instituições", nonEmpty(insts), "")
		writeList(b, "Links", nonEmpty(links), "")
		writeNotas(b, notas)
	}
	return rows.Err()
}

func writeInstituicoes(db *sql.DB, b *strings.Builder) error {
	rows, err := db.Query(`SELECT sigla, COALESCE(nome, '') FROM instituicao ORDER BY sigla`)
	if err != nil {
		return fmt.Errorf("BuildAcervo instituições: %w", err)
	}
	defer rows.Close()
	b.WriteString("\n# Instituições\n")
	for rows.Next() {
		var sigla, nome string
		if err := rows.Scan(&sigla, &nome); err != nil {
			return fmt.Errorf("BuildAcervo instituições: %w", err)
		}
		if nome != "" {
			sigla += " — " + nome
		}
		b.WriteString("- " + sigla + "\n")
	}
	return rows.Err()
}

func inativo(ativo bool) string {
	if ativo {
		return ""
	}
	return " (inativo)"
}

func nonEmpty(vals ...string) []string {
	var out []string
	for _, v := range vals {
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}
