# Quickstart: Tabela de Participantes

**Branch**: `002-add-participantes` | **Date**: 2026-03-15

## Pré-requisitos

- MariaDB rodando com acesso às variáveis de ambiente do projeto (`.env` ou equivalente)
- Node.js 22 instalado
- Arquivo `docs/source/memoriaReunioes-Participantes.csv` presente

## Sequência de Setup

### 1. Aplicar migration de schema (cria tabelas)

```bash
npm run migrate
# Aplica 003_add_participantes.sql:
# - Cria tabela `participante`
# - Cria tabela `reuniao_participante`
# (NÃO remove a coluna participantes TEXT ainda)
```

### 2. Executar script de dados (importa CSV + migra legado)

```bash
node docs/source/scripts/migrate-participantes.js
```

O script irá:
- Conectar ao banco com credenciais root
- Importar todos os participantes do CSV (idempotente — pode re-executar sem problemas)
- Percorrer todas as reuniões e migrar participantes legados do campo TEXT para a tabela de junção
- Exibir log de nomes não associados (sem falhar)

### 3. Aplicar migration de remoção da coluna legada

```bash
npm run migrate
# Aplica 004_drop_participantes_col.sql:
# - Remove coluna `participantes` TEXT da tabela `reuniao`
```

### 4. Iniciar servidor de desenvolvimento

```bash
npm run dev
```

## Estrutura de Arquivos Novos/Modificados

```text
migrations/
├── 003_add_participantes.sql       # Schema: cria participante + reuniao_participante
└── 004_drop_participantes_col.sql  # Schema: remove coluna TEXT

src/routes/
├── meetings.js     # Modificado: usa participante_ids, JOIN com participantes
└── participants.js # NOVO: GET /api/participants

src/server.js       # Modificado: registra rota /api/participants

public/assets/app.js     # Modificado: multi-select de participantes
public/index.html        # Modificado: substitui textarea por componente de seleção

docs/source/scripts/     # NUNCA commitado (.gitignore)
└── migrate-participantes.js   # Script de dados com credenciais admin
```

## Verificação Pós-Setup

```bash
# Verificar participantes importados
curl http://localhost:3000/api/participants?limit=5

# Verificar reunião com participantes
curl http://localhost:3000/api/meetings/1
```

## .gitignore

Certificar que `/docs/source/scripts/` está no `.gitignore`:

```
docs/source/scripts/
```

## Notas Operacionais

- O script `migrate-participantes.js` é idempotente: pode ser executado múltiplas vezes sem efeitos colaterais
- Nomes não associados na migração legada são apenas logados — não causam falha
- A migration `004` deve ser aplicada somente após confirmar que o script de dados rodou com sucesso
- Em ambiente Docker (UNRAID), o script de dados deve ser executado manualmente via `docker exec` antes de aplicar a migration `004`
