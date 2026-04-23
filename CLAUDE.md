# meetingLog Development Guidelines

Last updated: 2026-04-23

## Project Overview

Aplicação web para registro e consulta de reuniões. Container único Node.js (Hono) servindo REST API + frontend Alpine.js, com banco de dados SQLite local (better-sqlite3). Implantado no UNRAID via Docker.

## Stack Atual

- **Runtime**: Node.js 22, ES modules (`import`/`export`)
- **Framework**: Hono 4.x (`@hono/node-server`)
- **Banco de dados**: SQLite via `better-sqlite3` (síncrono, WAL mode)
- **Frontend**: Alpine.js CDN + Tailwind CSS CDN + Quill CDN (sem build step)
- **Uploads**: `sharp` para geração de thumbnails
- **Docker**: `node:22-alpine`, multi-stage build, `su-exec` para troca de usuário

## Estrutura do Projeto

```text
src/
  server.js         # Entry point Hono, health check, graceful shutdown
  db.js             # Singleton better-sqlite3 (WAL + foreign keys)
  migrate.js        # Runner de migrations SQLite (migrations/*.sql)
  routes/
    meetings.js     # CRUD de reuniões
    participants.js # CRUD de participantes
    projects.js     # CRUD de projetos
    institutions.js # CRUD de instituições
    files.js        # Upload/download de arquivos
    maintenance.js  # Substituição de projeto + backup/restore SQLite
migrations/
  001_sqlite_init.sql   # Schema completo SQLite (idempotente)
  mariadb/              # Migrations históricas MariaDB (arquivo)
scripts/
  migrate-mariadb-to-sqlite.js  # Migração one-time MariaDB → SQLite (node:sqlite)
public/             # Frontend estático (HTML, Alpine.js, PWA assets)
docs/               # Documentação (guia UNRAID, dados fonte)
.github/workflows/  # CI/CD (publica no GHCR a cada push no main)
```

## Comandos

```bash
npm install          # instala dependências
npm run dev          # servidor dev com hot reload (nodemon)
npm run migrate      # aplica migrations SQLite pendentes
npm test             # testes unitários
docker build .       # build da imagem Docker
```

## Estilo de Código

- ES modules (`import`/`export`), async/await onde necessário
- Sem TypeScript — ferramenta interna de uso único
- Hono: validação de body com validadores embutidos
- SQL: somente queries parametrizadas (sem interpolação de strings)
- API SQLite é **síncrona** — handlers Hono são `async` apenas para `await c.req.json()`

## Padrões SQLite Importantes

### GROUP_CONCAT em subqueries derivados

SQLite não expõe alias de tabela do subquery interno para o externo. A forma correta é referenciar a coluna pelo nome simples:

```sql
-- ERRADO (p2.nome não existe no escopo externo)
(SELECT GROUP_CONCAT(p2.nome, ', ') FROM (SELECT p2.nome FROM participante p2 ...))

-- CORRETO
(SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT p2.nome FROM participante p2 ...))
```

### Transações

```js
const result = db.transaction(() => {
  const { lastInsertRowid } = db.prepare('INSERT INTO ...').run(...)
  db.prepare('INSERT INTO ...').run(Number(lastInsertRowid), ...)
  return Number(lastInsertRowid)
})()
```

### Backup online

```js
await db.backup('/tmp/backup.sqlite')  // consistente mesmo com WAL ativo
```

### Restauração

Após swap atômico do arquivo: `process.exit(0)` — o Docker reinicia automaticamente (restart: unless-stopped).

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DB_PATH` | `/data/db/meetinglog.sqlite` | Caminho do arquivo SQLite |
| `APP_PIN` | — | PIN de acesso (obrigatório) |
| `APP_PORT` | `3000` | Porta HTTP |
| `FILES_PATH` | — | Diretório de uploads |
| `MARIADB_HOST` | — | Ativa migração one-time na ausência do SQLite |
| `MARIADB_PORT` | `3306` | Porta MariaDB (só para migração) |
| `MARIADB_DB` | — | Banco MariaDB (só para migração) |
| `MARIADB_USER` | — | Usuário MariaDB (só para migração) |
| `MARIADB_PASS` | — | Senha MariaDB (só para migração) |

## Entrypoint (docker-entrypoint.sh)

1. Define `DB_PATH` padrão se não definido
2. Cria diretório do DB como root e transfere para `appuser`
3. Se `MARIADB_HOST` definido **e** SQLite não existe → executa migração one-time
4. Executa `src/migrate.js` (aplica migrations SQL pendentes)
5. `exec su-exec appuser node src/server.js`
