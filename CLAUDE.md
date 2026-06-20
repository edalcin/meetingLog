# meetingLog Development Guidelines

Last updated: 2026-06-20

## Project Overview

Aplicação web para registro e consulta de reuniões. Binário único Go (chi) servindo REST API + frontend Svelte 5 embutido via `go:embed`, banco de dados SQLite (modernc.org/sqlite — puro Go, sem CGO). Implantado no UNRAID via Docker distroless (~20 MB).

## Stack Atual

- **Runtime**: Go 1.25 (`CGO_ENABLED=0`, binário estático)
- **Framework HTTP**: chi v5
- **Banco de dados**: SQLite via `modernc.org/sqlite` (puro Go, WAL mode, `SetMaxOpenConns(1)`)
- **Frontend**: Svelte 5 + Vite + TipTap + Tailwind CSS (build-time, sem CDN) + Chart.js
- **Uploads**: `golang.org/x/image/draw` (thumbnails PNG/JPEG); PDF → ícone estático embutido
- **Docker**: 3-stage (`node:22-alpine` → `golang:1.25-alpine` → `distroless/static-debian12:nonroot`)

## Estrutura do Projeto

```text
cmd/meetinglog/main.go          # Entry point, -healthcheck flag, graceful shutdown
internal/
  config/config.go              # Env vars (nomes mantidos do Node: APP_PIN, DB_PATH, etc.)
  model/types.go                # Structs Go com JSON tags (Meeting, Participant, Project,
                                #   Institution, Settings, MaintenanceAffected, ...)
  store/
    open.go                     # Abre DB, aplica schema, backfill Delta→HTML
    schema.sql                  # Schema SQLite idempotente (IF NOT EXISTS), embutido via go:embed
                                #   Inclui tabela settings (key TEXT PK, value TEXT NOT NULL)
    quilldelta.go               # Conversor Quill Delta JSON → HTML (backfill único no startup)
    settings.go                 # GetSetting, SetSetting, GetAutosaveIntervalSeconds + constantes
    meetings.go participants.go projects.go institutions.go
    dashboard.go files.go sharelinks.go backup.go
    errors.go tx.go
  server/
    server.go                   # Server struct, chi router, buildRouter()
    assets.go                   # //go:embed all:web/dist
    respond.go                  # writeJSON, parseID, handleStoreErr
    handlers_{auth,health,meetings,participants,projects,institutions,
              dashboard,files,maintenance,sharelinks,public,settings}.go
    middleware_{security,auth,csrf,throttle}.go
    web/dist/                   # Output do Vite (gerado em build, embutido no binário)
  security/                     # password, tokens, csrf, sanitize, paths
  sessions/store.go             # Sessões server-side (SQLite-backed)
  storage/local.go              # Backend local para uploads
  thumbnail/thumbnail.go        # Thumbnails PNG/JPEG + ícone PDF embutido
frontend/                       # Svelte 5 + Vite (npm run build → internal/server/web/dist)
  src/
    App.svelte lib/api.js lib/stores/auth.js
    lib/components/
      LoginPage.svelte
      MeetingsTab.svelte           # Lista com ícones PDF/imagem, nomes clicáveis
      MeetingFormModal.svelte      # Auto-save unificado (POST/PUT debounced)
      MeetingInfoModal.svelte
      MeetingView.svelte
      ParticipantsTab.svelte       # Usa ParticipantInfoModal
      ParticipantInfoModal.svelte  # Ficha reutilizável (MeetingsTab + ParticipantsTab)
      ProjectsTab.svelte           # Usa ProjectInfoModal
      ProjectInfoModal.svelte      # Ficha reutilizável (MeetingsTab + ProjectsTab)
      InstitutionsTab.svelte
      DashboardTab.svelte
      MaintenanceTab.svelte        # Compõe ReplaceEntitySection × 2 + Configurações
      ReplaceEntitySection.svelte  # Substituição genérica de entidade (projetos ou participantes)
      SharedView.svelte
      RichEditor.svelte
  public/
    manifest.webmanifest          # PWA manifest com ícones 192/512
    sw.js                         # Service worker: network-first nav + SWR assets
    favicon.ico favicon-*.png
    icons/                        # icon-192.png, icon-512.png, icon.svg, apple-touch-icon.png
.github/workflows/              # CI: build-and-publish, promote-to-prod, ghcr-cleanup
```

## Comandos

```bash
# Frontend
cd frontend && npm install
npm run build           # gera internal/server/web/dist/

# Backend
go build ./...          # compila todos os pacotes
go vet ./...
go test ./internal/store/...   # testes do store (settings + ReplaceParticipant)
go build -o meetinglog ./cmd/meetinglog  # binário final

# Docker
docker build .          # imagem distroless ~20MB
docker-compose up

# Desenvolvimento local (requer frontend já buildado)
APP_PIN=1234 DB_PATH=./data/meetinglog.sqlite FILES_PATH=./data/uploads go run ./cmd/meetinglog
```

## Estilo de Código

- Go puro, sem TypeScript, sem CGO
- `database/sql` + `modernc.org/sqlite` — API 100% síncrona
- SQL: somente queries parametrizadas (sem interpolação de strings)
- Handlers são funções simples `func(w http.ResponseWriter, r *http.Request)` ou closures retornadas por `http.HandlerFunc`
- Svelte 5: usar runes (`$state`, `$derived`, `$effect`, `$props`) em todos os componentes

## Padrões SQLite Importantes

### GROUP_CONCAT em subqueries derivados

SQLite não expõe alias de tabela do subquery interno para o externo:

```sql
-- CORRETO
(SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT p2.nome FROM participante p2 ...))
```

### Transações

```go
func WithTx(db *sql.DB, fn func(*sql.Tx) error) error // em internal/store/tx.go
```

### Backup

```go
store.BackupDB(db, dbDir)  // usa VACUUM INTO (não /tmp — distroless não tem /tmp)
```

### Restauração

`os.Rename` + `store.Open(newPath)` + `server.ReplaceDB(newDB)` — in-process sem reiniciar.

### Detecção de UNIQUE constraint

```go
strings.Contains(err.Error(), "UNIQUE constraint failed")  // → ErrConflict
```

### Backfill Delta→HTML

Executado automaticamente em `store.Open` na primeira inicialização. Converte notas Quill Delta JSON para HTML (TipTap). Idempotente — HTML não re-parseia como `{"ops":[...]}`.

### PDF em iframe

`/api/files/{id}/content` usa middleware `FileContentCSP` que define `X-Frame-Options: SAMEORIGIN` e `frame-ancestors 'self'` para o viewer `<iframe>`. PDFs não têm thumbnail — retorna ícone PNG embutido.

## Auto-save (MeetingFormModal)

- Intervalo configurável via `GET/PUT /api/settings` (`autosave_interval_seconds`, padrão 5 s, range 2–300 s)
- Auto-save unificado: faz `POST /api/meetings` na criação (quando data+hora + ≥1 participante) e `PUT /api/meetings/{id}` nas edições
- Não inclui upload de arquivos — apenas o payload JSON da reunião
- `handleClose()` faz flush antes de fechar o modal
- Endpoint `PATCH /api/meetings/{id}/notas` removido (sem consumidores)

## PWA

- `frontend/public/sw.js`: network-first para navegação (fallback ao shell em cache `/`); stale-while-revalidate para assets estáticos; network-only para `/api/*`
- Manifest: `scope="/"`, `display="standalone"`, ícones 192 + 512
- `GET /manifest.webmanifest`, `GET /sw.js`, `GET /favicon*` roteados em `buildRouter` antes do grupo autenticado

## Tabela `settings`

```sql
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

Chave atual: `autosave_interval_seconds`. Lida/escrita via `store.GetSetting` / `store.SetSetting`. `GetAutosaveIntervalSeconds` retorna o padrão (`5`) para valores ausentes, não-numéricos ou fora de `[2, 300]`.

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `APP_PIN` | — | PIN de acesso (obrigatório) |
| `DB_PATH` | `/data/db/meetinglog.sqlite` | Caminho do arquivo SQLite |
| `FILES_PATH` | — | Diretório de uploads |
| `APP_PORT` | `3000` | Porta HTTP |
| `BASE_URL` | — | URL base pública para links compartilhados |
| `ML_SESSION_IDLE_MINUTES` | `43200` (30 dias) | Timeout de sessão |
| `ML_MAX_FILE_MB` | `10` | Limite de upload |
| `ML_MAX_RESTORE_MB` | `512` | Limite de restore |
| `ML_TRUST_PROXY_HEADERS` | — | Confiar em X-Forwarded-For |

## Autenticação

- `POST /api/login {pin}` → cookie `meetinglog_session` (HttpOnly, 30 dias)
- Todo `/api/*` protegido por `AuthRequired` exceto `/api/login`, `/healthz`, `/api/p/{token}*`
- CSRF double-submit: cookie `meetinglog_csrf` + header `X-CSRF-Token`
- Throttle: 5 falhas → lockout 30 min (por IP)
- Links públicos read-only: `GET /api/p/{token}` e `GET /api/p/{token}/meetings`
