# Instalação no UNRAID — Registro de Reuniões

## Pré-requisitos

- UNRAID com acesso ao painel Docker
- Diretório no array para persistência do banco de dados
- Diretório no array para upload de arquivos

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
| **WebUI** | `http://[IP]:[PORT:3000]/` |
| **Icon URL** | `https://raw.githubusercontent.com/edalcin/meetingLog/refs/heads/main/meeting.png` |
| **Restart Policy** | `unless-stopped` |

### Mapeamento de Porta

| Container Port | Host Port | Tipo |
|----------------|-----------|------|
| `3000` | `3000` *(ou outra porta disponível)* | TCP |

### Variáveis de Ambiente

| Key | Value | Descrição |
|-----|-------|-----------|
| `APP_PIN` | `seu-pin` | PIN de acesso à aplicação |
| `DB_PATH` | `/data/db/meetinglog.sqlite` | Caminho do SQLite dentro do container |
| `FILES_PATH` | `/app/data/uploads` | Diretório de uploads dentro do container |

### Mapeamento de Volumes

| Host Path | Container Path | Modo |
|-----------|---------------|------|
| `/mnt/user/appdata/meetinglog/db` | `/data/db` | `rw` |
| `/mnt/user/appdata/meetinglog/uploads` | `/app/data/uploads` | `rw` |

3. Clique em **Apply**

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

### Esqueceu o PIN
- No painel Docker, edite o container e altere a variável `APP_PIN`
- Reinicie o container

### Erro de permissão no diretório do banco
- O entrypoint cria o diretório `/data/db` como root e transfere a propriedade para `appuser` antes de iniciar o servidor
- Se o diretório já existia com permissões erradas, corrija no host com `chown -R 1000:1000 <seu-diretório-host>`
