# Registro de Reuniões

Aplicação web para registrar e consultar reuniões, com interface moderna e responsiva. Roda em um único container Docker (~20 MB) com banco de dados SQLite embutido — sem dependências externas.

## Funcionalidades

- **Reuniões** — listagem com rolagem infinita, ordenação por colunas, filtros por participante e projeto, notas ricas, pautas e links
- **Auto-save em background** — reunião e notas salvas automaticamente após pausa na edição; intervalo configurável em Manutenção → Configurações (padrão: 5 s)
- **Participantes** — cadastro com instituição, cargo, lotação, e-mail, status ativo/inativo, notas; nomes clicáveis na lista de reuniões abrem a ficha
- **Projetos** — vínculo com instituições e participantes, links, notas, status ativo/inativo; nomes clicáveis na lista de reuniões abrem a ficha
- **Instituições** — cadastro de sigla e nome
- **Arquivos** — upload de imagens (PNG/JPEG) e PDFs por reunião; ícones distintos (PDF vermelho, imagem azul) com contagem na lista de reuniões; visualização em modal
- **Dashboard** — gráficos de reuniões por mês, top participantes, top projetos, horários e dias da semana, filtros por ano/projeto/participante
- **Links compartilháveis** — URLs públicas read-only por reunião ou filtro
- **Manutenção**
  - Substituição de projetos em reuniões (com dry-run)
  - Substituição de participantes em reuniões (com dry-run)
  - Configurações: intervalo de auto-save (2–300 s)
  - Backup e restauração do banco de dados
- **Autenticação via PIN** — sessão server-side, throttle de 5 tentativas, lockout de 30 min
- **PWA** — instalável em dispositivos móveis; app shell disponível offline

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Go 1.25 — binário estático, `CGO_ENABLED=0` |
| HTTP | [chi v5](https://github.com/go-chi/chi) |
| Banco de dados | SQLite via [`modernc.org/sqlite`](https://gitlab.com/cznic/sqlite) (puro Go, WAL mode) |
| Frontend | [Svelte 5](https://svelte.dev) + [Vite](https://vitejs.dev) + [Tailwind CSS](https://tailwindcss.com) |
| Editor de texto | [TipTap](https://tiptap.dev) (baseado em ProseMirror) |
| Gráficos | [Chart.js](https://www.chartjs.org) |
| Thumbnails | `golang.org/x/image/draw` (CatmullRom) — sem CGO, sem sharp |
| Docker | 3 estágios: `node:22-alpine` → `golang:1.25-alpine` → `distroless/static-debian12:nonroot` |
| Imagem final | ~20 MB, usuário não-root (UID 65532) |

## Quick Start com Docker

```bash
docker run -d \
  --name meetinglog \
  --restart unless-stopped \
  -p 3000:3000 \
  -e APP_PIN=seu-pin \
  -e DB_PATH=/data/db/meetinglog.sqlite \
  -e FILES_PATH=/data/uploads \
  -v /caminho/local/data:/data \
  ghcr.io/edalcin/meetinglog:latest
```

Acesse: `http://localhost:3000`

## Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `APP_PIN` | Sim | — | PIN de acesso à aplicação |
| `DB_PATH` | Não | `/data/db/meetinglog.sqlite` | Caminho do arquivo SQLite |
| `FILES_PATH` | Não | — | Diretório para uploads |
| `APP_PORT` | Não | `3000` | Porta HTTP |
| `BASE_URL` | Não | — | URL base pública para links compartilháveis |
| `ML_SESSION_IDLE_MINUTES` | Não | `43200` (30 dias) | Timeout de sessão |
| `ML_MAX_FILE_MB` | Não | `10` | Limite por upload em MB |
| `ML_MAX_RESTORE_MB` | Não | `512` | Limite para restauração de backup em MB |
| `ML_TRUST_PROXY_HEADERS` | Não | — | Confiar em `X-Forwarded-For` (reverse proxy) |

## Configurações (interface)

Em **Manutenção → Configurações** é possível ajustar o intervalo de auto-save (2–300 segundos). O valor é armazenado na tabela `settings` do SQLite — não é uma variável de ambiente.

## Desenvolvimento

### Pré-requisitos

- Go 1.25+
- Node.js 22+

### Comandos

```bash
# Frontend (Svelte 5 + Vite)
cd frontend
npm install
npm run build          # gera internal/server/web/dist/
npm run dev            # servidor Vite com HMR (frontend isolado)

# Backend (Go)
go build ./...         # compila todos os pacotes
go vet ./...           # verificação estática
go test ./internal/store/...  # testes unitários do store
go build -o meetinglog ./cmd/meetinglog  # binário final

# Executar localmente (requer frontend buildado primeiro)
APP_PIN=1234 DB_PATH=./data/meetinglog.sqlite FILES_PATH=./data/uploads \
  go run ./cmd/meetinglog

# Docker
docker build .
docker-compose up
```

## Backup e Restauração

Na seção **Manutenção** da interface:

- **Backup** — baixa o arquivo `.sqlite` completo (usa `VACUUM INTO`)
- **Restaurar** — sobe um arquivo `.sqlite`; a troca é feita em memória sem reiniciar o servidor

## Instalação no UNRAID

Consulte [docs/unraid-install.md](docs/unraid-install.md) para instruções detalhadas.

## Segurança

- Sessões server-side armazenadas no SQLite (não em JWT ou cookies com dados)
- CSRF double-submit: cookie `meetinglog_csrf` + header `X-CSRF-Token`
- Throttle de login: 5 falhas → lockout de 30 min por IP
- Uploads sanitizados: apenas PNG, JPEG e PDF aceitos; PDFs servidos com `X-Frame-Options: SAMEORIGIN`
- Container distroless, usuário não-root (UID 65532)
- SQL 100% parametrizado — sem interpolação de strings
