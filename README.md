# Registro de Reuniões

Aplicação web para registrar e consultar reuniões, com interface moderna e responsiva.

## Funcionalidades

- Listagem de reuniões com filtro e ordenação
- Registro de novas reuniões
- Edição de reuniões existentes
- Autenticação via PIN
- Suporte a PWA (instalável em dispositivos móveis)

## Quick Start com Docker

```bash
docker run -d \
  --name meetinglog \
  -p 3000:3000 \
  -e DB_HOST=your-mariadb-host \
  -e DB_PORT=3306 \
  -e DB_NAME=reunioes \
  -e DB_USER=your-db-user \
  -e DB_PASSWORD=your-db-password \
  -e APP_PIN=1234 \
  ghcr.io/edalcin/meetinglog:latest
```

Acesse: `http://localhost:3000`

## Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `DB_HOST` | Sim | — | Host do MariaDB |
| `DB_PORT` | Sim | — | Porta do MariaDB |
| `DB_NAME` | Sim | — | Nome do banco de dados |
| `DB_USER` | Sim | — | Usuário do banco |
| `DB_PASSWORD` | Sim | — | Senha do banco |
| `APP_PIN` | Sim | — | PIN de acesso |
| `APP_PORT` | Não | `3000` | Porta HTTP do container |

## Desenvolvimento Local

```bash
cp .env.example .env
# edite .env com suas credenciais

npm install
docker compose up -d db   # sobe apenas o MariaDB
npm run migrate           # cria as tabelas
node scripts/import-csv.js  # importa dados históricos
npm run dev               # inicia servidor com hot reload
```

## Importação de Dados Históricos

```bash
node scripts/import-csv.js
```

## Instalação no UNRAID

Consulte [docs/unraid-install.md](docs/unraid-install.md) para instruções detalhadas.
