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
