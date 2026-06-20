-- meetingLog schema — idempotent (all IF NOT EXISTS)
-- Merged from migrations/001_sqlite_init.sql + 002_shared_links.sql
-- PRAGMAs are set on the connection before this script runs; NOT here.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reuniao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_hora TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('Presencial', 'Remota', 'Hibrida', 'Telefone')),
  notas TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_data_hora ON reuniao(data_hora);

CREATE TRIGGER IF NOT EXISTS trg_reuniao_atualizado_em
AFTER UPDATE OF data_hora, tipo, notas ON reuniao
BEGIN
  UPDATE reuniao SET atualizado_em = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS participante (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  instituicao TEXT,
  lotacao TEXT,
  cargo TEXT,
  email TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  ativo_manual INTEGER NOT NULL DEFAULT 1,
  notas TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_participante_nome ON participante(nome);
CREATE INDEX IF NOT EXISTS idx_participante_instituicao ON participante(instituicao);
CREATE INDEX IF NOT EXISTS idx_participante_ativo ON participante(ativo);

CREATE TABLE IF NOT EXISTS reuniao_participante (
  reuniao_id INTEGER NOT NULL REFERENCES reuniao(id) ON DELETE CASCADE,
  participante_id INTEGER NOT NULL REFERENCES participante(id) ON DELETE CASCADE,
  PRIMARY KEY (reuniao_id, participante_id)
);

CREATE TABLE IF NOT EXISTS projeto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  ativo INTEGER NOT NULL DEFAULT 1,
  notas TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projeto_ativo ON projeto(ativo);

CREATE TABLE IF NOT EXISTS reuniao_projeto (
  reuniao_id INTEGER NOT NULL REFERENCES reuniao(id) ON DELETE CASCADE,
  projeto_id INTEGER NOT NULL REFERENCES projeto(id) ON DELETE CASCADE,
  PRIMARY KEY (reuniao_id, projeto_id)
);

CREATE TABLE IF NOT EXISTS instituicao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sigla TEXT NOT NULL UNIQUE,
  nome TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_instituicao_sigla ON instituicao(sigla);

CREATE TABLE IF NOT EXISTS projeto_instituicao (
  projeto_id INTEGER NOT NULL REFERENCES projeto(id) ON DELETE CASCADE,
  instituicao_id INTEGER NOT NULL REFERENCES instituicao(id) ON DELETE CASCADE,
  PRIMARY KEY (projeto_id, instituicao_id)
);

CREATE TABLE IF NOT EXISTS pauta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reuniao_id INTEGER NOT NULL REFERENCES reuniao(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reuniao_id, texto)
);

CREATE INDEX IF NOT EXISTS idx_pauta_reuniao_ordem ON pauta(reuniao_id, ordem);

CREATE TABLE IF NOT EXISTS link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reuniao_id INTEGER NOT NULL REFERENCES reuniao(id) ON DELETE CASCADE,
  nome TEXT,
  url TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reuniao_id, url)
);

CREATE INDEX IF NOT EXISTS idx_link_reuniao_ordem ON link(reuniao_id, ordem);

CREATE TABLE IF NOT EXISTS projeto_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id INTEGER NOT NULL REFERENCES projeto(id) ON DELETE CASCADE,
  nome TEXT,
  url TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (projeto_id, url)
);

CREATE INDEX IF NOT EXISTS idx_projeto_link_projeto_ordem ON projeto_link(projeto_id, ordem);

CREATE TABLE IF NOT EXISTS arquivo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reuniao_id INTEGER NOT NULL REFERENCES reuniao(id) ON DELETE CASCADE,
  filename_original TEXT NOT NULL,
  filename_stored TEXT NOT NULL,
  letter TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reuniao_id, letter)
);

CREATE INDEX IF NOT EXISTS idx_arquivo_reuniao_id ON arquivo(reuniao_id);

CREATE TABLE IF NOT EXISTS link_publico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  filter_type TEXT NOT NULL DEFAULT 'all',
  filter_value TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revogado INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_link_publico_token ON link_publico(token);

-- Sessions table for server-side auth (added by the Go rewrite).
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  ip          TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
