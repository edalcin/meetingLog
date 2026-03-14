# Instalação no UNRAID — Registro de Reuniões

## Pré-requisitos

- UNRAID com acesso ao painel Docker
- Instância do MariaDB já configurada e acessível na rede
- Banco de dados `reunioes` criado e usuário com permissões de leitura/escrita

## Instalação via Interface Gráfica (Docker → Add Container)

1. No painel do UNRAID, acesse **Docker** → **Add Container**
2. Preencha os campos conforme abaixo:

### Configuração do Container

| Campo | Valor |
|-------|-------|
| **Name** | `meetinglog` |
| **Repository** | `ghcr.io/edalcin/meetinglog:latest` |
| **Network Type** | `Bridge` |
| **WebUI** | `http://[IP]:[APP_PORT:3000]/` |
| **Icon URL** | *(deixe em branco ou use URL de ícone customizado)* |

### Mapeamento de Porta

| Campo | Valor |
|-------|-------|
| **Container Port** | `3000` |
| **Host Port** | `3000` *(ou outra porta disponível)* |
| **Connection Type** | `TCP` |

### Variáveis de Ambiente

Adicione cada variável clicando em **Add another Path, Port, Variable, Label or Device** → **Variable**:

| Key | Value | Descrição |
|-----|-------|-----------|
| `DB_HOST` | `your-mariadb-host` | IP do servidor MariaDB |
| `DB_PORT` | `3333` | Porta do MariaDB |
| `DB_NAME` | `reunioes` | Nome do banco de dados |
| `DB_USER` | `your-db-user` | Usuário do banco |
| `DB_PASSWORD` | `your-db-password` | Senha do banco |
| `APP_PIN` | `seu-pin-aqui` | PIN de acesso à aplicação |
| `APP_PORT` | `3000` | Porta interna do container (opcional) |

3. Clique em **Apply**

## Importação dos Dados Históricos (Primeira Instalação)

Após o container estar em execução, importe os dados do CSV:

```bash
docker exec meetinglog node scripts/import-csv.js
```

> **Nota**: Este comando só funciona se o arquivo CSV estiver dentro do container.
> Para importar externamente, copie o CSV primeiro:
> ```bash
> docker cp docs/source/memoriaReunioes-Reuniao.csv meetinglog:/app/docs/source/
> docker exec meetinglog node scripts/import-csv.js
> ```

## Verificação

Após a instalação, acesse `http://[IP-UNRAID]:3000` no navegador.
Você deve ver a tela de PIN. Digite o PIN configurado na variável `APP_PIN`.

## Troubleshooting

### Container não inicia
- Verifique se as variáveis `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `APP_PIN` estão preenchidas
- Verifique os logs: **Docker** → `meetinglog` → **Log**

### Erro de conexão com o banco de dados
- Confirme que o MariaDB está acessível no IP/porta configurados
- Confirme que o usuário tem permissões `SELECT, INSERT, UPDATE` no banco `reunioes`
- O container tenta reconectar por 30 segundos antes de desistir

### Esqueceu o PIN
- No painel Docker, edite o container e altere a variável `APP_PIN`
- Reinicie o container

### Atualizar para nova versão
No terminal do UNRAID:
```bash
docker pull ghcr.io/edalcin/meetinglog:latest
```
Depois, no painel Docker, clique em **Recreate** no container `meetinglog`.
