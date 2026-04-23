# Instalação no UNRAID — Registro de Reuniões

## Pré-requisitos

- UNRAID com acesso ao painel Docker
- Diretório no array para persistência do banco de dados (ex: `/mnt/user/Storage/appsdata/arquivosReunioes/db`)
- Diretório no array para upload de arquivos (ex: `/mnt/user/Storage/appsdata/arquivosReunioes`)

Não é necessário MariaDB nem nenhum serviço externo — o banco de dados SQLite fica gravado em um volume local.

## Instalação via Interface Gráfica (Docker → Add Container)

1. No painel do UNRAID, acesse **Docker** → **Add Container**
2. Preencha os campos conforme abaixo:

### Configuração do Container

| Campo | Valor |
|-------|-------|
| **Name** | `meetingLog` |
| **Repository** | `ghcr.io/edalcin/meetinglog:latest` |
| **Network Type** | `Bridge` |
| **WebUI** | `http://[IP]:[PORT:3773]/` |
| **Icon URL** | `https://raw.githubusercontent.com/edalcin/meetingLog/refs/heads/main/meeting.png` |
| **Restart Policy** | `unless-stopped` |

### Mapeamento de Porta

| Container Port | Host Port | Tipo |
|----------------|-----------|------|
| `3000` | `3773` *(ou outra porta disponível)* | TCP |

### Variáveis de Ambiente

| Key | Value | Descrição |
|-----|-------|-----------|
| `APP_PIN` | `seu-pin` | PIN de acesso à aplicação |
| `DB_PATH` | `/data/db/meetinglog.sqlite` | Caminho do SQLite dentro do container |
| `FILES_PATH` | `/app/data/uploads` | Diretório de uploads dentro do container |

### Mapeamento de Volumes

| Host Path | Container Path | Modo |
|-----------|---------------|------|
| `/mnt/user/Storage/appsdata/arquivosReunioes/db` | `/data/db` | `rw` |
| `/mnt/user/Storage/appsdata/arquivosReunioes` | `/app/data/uploads` | `rw` |

3. Clique em **Apply**

## Migração de Dados do MariaDB (Primeira Instalação)

Se você possui dados em um banco MariaDB existente, o container pode migrá-los automaticamente na primeira inicialização. Basta adicionar as seguintes variáveis de ambiente **apenas na primeira vez**:

| Key | Value |
|-----|-------|
| `MARIADB_HOST` | IP do servidor MariaDB |
| `MARIADB_PORT` | Porta do MariaDB (ex: `3306`) |
| `MARIADB_DB` | Nome do banco (ex: `reunioes`) |
| `MARIADB_USER` | Usuário do banco |
| `MARIADB_PASS` | Senha do banco |

Na inicialização, o entrypoint detecta que o arquivo SQLite não existe e que `MARIADB_HOST` está definido, executa a migração completa e só então inicia o servidor.

Acompanhe os logs em **Docker** → `meetingLog` → **Log**. Quando aparecer:

```
[migrate] Concluído! Arquivo SQLite criado em: /data/db/meetinglog.sqlite
[entrypoint] Data migration from MariaDB complete.
[entrypoint] Starting application...
```

A migração concluiu. Nas próximas inicializações, o arquivo SQLite já existe e as variáveis `MARIADB_*` são ignoradas — você pode removê-las do container.

## Backup e Restauração

Na seção **Manutenção** da interface web:

- **Backup** — baixa o arquivo `.sqlite` completo para o seu computador
- **Restaurar** — sobe um arquivo `.sqlite`; o servidor reinicia automaticamente após a restauração (o Docker reinicia o container por conta do `restart: unless-stopped`)

## Atualização para Nova Versão

No terminal do UNRAID:

```bash
docker pull ghcr.io/edalcin/meetinglog:latest
docker stop meetingLog && docker rm meetingLog
```

Depois recrie o container com os mesmos parâmetros (ou use **Recreate** no painel Docker) e execute `docker start meetingLog`.

O banco de dados SQLite fica no volume e não é afetado pela atualização.

## Troubleshooting

### Container não inicia
- Verifique se `APP_PIN` e `DB_PATH` estão preenchidos
- Verifique os logs: **Docker** → `meetingLog` → **Log**
- Certifique-se de que o diretório host do volume `/data/db` existe e tem permissões de escrita

### Nenhum dado aparece após a primeira inicialização
- Se havia dados no MariaDB, confirme que as variáveis `MARIADB_*` estavam presentes **antes** da criação do arquivo SQLite
- Se o arquivo SQLite foi criado vazio, apague-o no host (`rm .../db/meetinglog.sqlite`), adicione as variáveis `MARIADB_*` e reinicie o container

### Esqueceu o PIN
- No painel Docker, edite o container e altere a variável `APP_PIN`
- Reinicie o container

### Erro de permissão no diretório do banco
- O entrypoint cria o diretório `/data/db` como root e transfere a propriedade para `appuser` antes de iniciar o servidor
- Se o diretório já existia com permissões erradas, corrija no host: `chown -R 1000:1000 /mnt/user/Storage/appsdata/arquivosReunioes/db`
