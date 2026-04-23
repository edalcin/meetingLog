# Registro de Reuniões

Aplicação web para registrar e consultar reuniões, com interface moderna e responsiva. Roda em um único container Docker com banco de dados SQLite embutido — sem dependências externas.

## Funcionalidades

- Listagem, registro e edição de reuniões
- Participantes por instituição, com cargo e lotação
- Projetos vinculados às reuniões e às instituições
- Pautas e links por reunião
- Notas ricas por reunião e por projeto (editor Quill)
- Gestão de arquivos anexados por reunião
- Backup e restauração do banco de dados pela própria interface
- Autenticação via PIN
- PWA — instalável em dispositivos móveis

## Quick Start com Docker

```bash
docker run -d \
  --name meetinglog \
  --restart unless-stopped \
  -p 3000:3000 \
  -e APP_PIN=seu-pin \
  -e DB_PATH=/data/db/meetinglog.sqlite \
  -v /caminho/local/db:/data/db \
  ghcr.io/edalcin/meetinglog:latest
```

Acesse: `http://localhost:3000`

## Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `APP_PIN` | Sim | — | PIN de acesso à aplicação |
| `DB_PATH` | Não | `/data/db/meetinglog.sqlite` | Caminho do arquivo SQLite dentro do container |
| `FILES_PATH` | Não | — | Diretório para upload de arquivos dentro do container |
| `APP_PORT` | Não | `3000` | Porta HTTP do container |

## Backup e Restauração

Na seção **Manutenção** da interface:

- **Backup** — baixa o arquivo `.sqlite` completo com todos os dados
- **Restaurar** — sobe um arquivo `.sqlite`; o servidor reinicia automaticamente após a restauração

## Desenvolvimento

```bash
npm install       # instala dependências
npm run dev       # inicia com hot reload (nodemon)
npm run migrate   # aplica migrations SQLite pendentes
npm test          # executa testes
docker build .    # constrói a imagem Docker
```

## Instalação no UNRAID

Consulte [docs/unraid-install.md](docs/unraid-install.md) para instruções detalhadas.
