package store

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildAcervo(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "t.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	for _, q := range []string{
		`INSERT INTO reuniao(id, data_hora, tipo, notas) VALUES (7, '2025-03-04T14:00', 'Remota', '<p>Decidimos A &amp; B</p><ul><li>item 1</li><li>item 2</li></ul>')`,
		`INSERT INTO participante(id, nome, instituicao, ativo) VALUES (1, 'Ana', 'JBRJ', 1), (2, 'Bruno', '', 0)`,
		`INSERT INTO projeto(id, nome, ativo) VALUES (1, 'Flora', 0)`,
		`INSERT INTO reuniao_participante VALUES (7, 1), (7, 2)`,
		`INSERT INTO reuniao_projeto VALUES (7, 1)`,
		`INSERT INTO instituicao(sigla, nome) VALUES ('JBRJ', 'Jardim Botânico')`,
	} {
		if _, err := db.Exec(q); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}

	got, err := BuildAcervo(db)
	if err != nil {
		t.Fatalf("BuildAcervo: %v", err)
	}
	for _, want := range []string{
		"## Reunião #7 — 2025-03-04 14:00 (Remota)",
		"Projetos: Flora (inativo)",
		"Participantes: Ana (JBRJ), Bruno (inativo)",
		"Notas:\nDecidimos A & B\n- item 1\n- item 2\n",
		"- JBRJ — Jardim Botânico",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("acervo missing %q\n---\n%s", want, got)
		}
	}
	if strings.Contains(got, "<p>") {
		t.Errorf("acervo still has HTML:\n%s", got)
	}
}
