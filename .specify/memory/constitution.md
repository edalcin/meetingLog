# meetingLog Constitution

## I. Princípios Fundamentais

### I.1 — Simplicidade Acima de Tudo
Este é um sistema single-user de uso pessoal. Toda decisão de design deve preferir a solução mais simples que funciona. Sem autenticação complexa, sem cache layers, sem abstrações desnecessárias. PIN simples + session storage é suficiente. Uma única rota por recurso é suficiente.

### I.2 — Sem Build Step no Frontend
O frontend usa Alpine.js CDN e Tailwind CSS CDN. **Nunca** introduzir bundler (Webpack, Vite, esbuild), framework (React, Vue) ou etapa de compilação. Todo JavaScript deve ser ES vanilla + Alpine.js direto em `public/assets/app.js` e `public/index.html`.

### I.3 — SQL Parametrizado Sempre
**Nunca** interpolar variáveis em strings SQL. Usar sempre `?` com array de parâmetros via `mysql2/promise`. Esta regra é inegociável — sem exceções.

### I.4 — Credenciais Nunca no Repositório Remoto
Scripts com credenciais de admin ficam em `docs/source/scripts/` que está no `.gitignore` e no `.dockerignore`. Credenciais root: ver scripts locais (nunca commitados). Credenciais da aplicação: `.env` local (nunca commitado).

### I.5 — Migrações são Imutáveis e Sequenciais
Arquivos em `migrations/` são commitados, nunca editados após aplicados. O runner (`npm run migrate`) aplica cada arquivo apenas uma vez (controle via `schema_migrations`). Nomenclatura: `NNN_descricao.sql` (zero-padded).

---

## II. Padrão de Dados — Tabelas Associadas à `reuniao`

### II.1 — Processo Canônico para Nova Tabela Associada

Toda nova tabela que se associa a `reuniao` segue este processo obrigatório, nesta ordem exata:

```
1. /speckit.specify  → especificar a feature com o data source
2. /speckit.clarify  → resolver ambiguidades (tipo de relação, unicidade)
3. /speckit.plan     → gerar data-model, contracts, research
4. /speckit.tasks    → gerar lista de tarefas
5. /speckit.implement → implementar
6. EXECUTAR migration SQL (apenas a que CRIA tabelas — NÃO a que dropa colunas)
7. EXECUTAR script de dados (docs/source/scripts/)
8. EXECUTAR migration SQL de remoção de coluna legada (se houver)
9. commit + push no main
```

**⚠️ LIÇÃO APRENDIDA (participantes, 2026-03-15)**: O `npm run migrate` aplica TODAS as migrations pendentes em sequência. Se houver uma migration que remove uma coluna legada (ex: `004_drop_participantes_col.sql`), ela será aplicada JUNTO com a migration de criação, ANTES do script de dados rodar. Isso destrói os dados legados.

**Solução obrigatória**: Separar claramente em duas execuções de migrate:
- Execução 1: migration de criação de tabelas (ex: 003)
- Script de dados (lê coluna legada, cria associações)
- Execução 2: migration de remoção de coluna (ex: 004)

**Como garantir isso**: A migration de remoção de coluna deve ter número POSTERIOR e o quickstart.md deve documentar explicitamente a sequência com aviso de que não se deve rodar `npm run migrate` uma única vez cobrindo ambas.

### II.2 — Tipos de Relação com `reuniao`

| Tipo | Quando usar | Estrutura |
|------|-------------|-----------|
| **N:N** (muitos-para-muitos) | Uma reunião tem vários X; um X aparece em várias reuniões | Tabela `x` + junction `reuniao_x(reuniao_id, x_id)` |
| **1:N** (um-para-muitos) | Uma reunião tem vários X; cada X pertence a uma reunião | Tabela `x` com `reuniao_id FK` |
| **N:1** (lookup/referência) | Uma reunião referencia um X; X é um registro reutilizável | Tabela `x` + `reuniao.x_id FK` substituindo coluna TEXT |

### II.3 — Regras de Idempotência dos Scripts de Dados

- **INSERT IGNORE**: sempre usar para tabelas com UNIQUE KEY — nunca INSERT simples
- **Unicidade**: definir explicitamente durante `/speckit.clarify` — não assumir
- **Scripts são re-executáveis**: rodar o script duas vezes nunca deve criar duplicatas nem erros

### II.4 — Recuperação de Dados Legados

Quando uma coluna TEXT existente na `reuniao` precisa ser migrada para uma relação estruturada:
1. Ler o CSV original do data source (em `docs/source/`) como fonte de verdade
2. Matching por campo-chave (ex: nome, data+projeto) para localizar registros no banco
3. Log de registros não encontrados — nunca falhar silenciosamente
4. Se o matching for por data/hora: usar `DATE_FORMAT(data_hora,'%Y-%m-%dT%H:%i:%s')` no MariaDB

---

## III. Data Sources

### III.1 — Localização e Formato

Todos os data sources ficam em `docs/source/` (diretório gitignored). Formato padrão: **CSV com separador `;`**, codificação UTF-8.

| Arquivo | Colunas | Relação com `reuniao` | Status |
|---------|---------|----------------------|--------|
| `memoriaReunioes-Reuniao.csv` | `data;tipo;participantes;projeto` | — (tabela principal) | ✅ Migrado |
| `memoriaReunioes-Participantes.csv` | `nomeParticipante;instituicao;cargo;email` | N:N via `reuniao_participante` | ✅ Migrado |
| `memoriaReunioes-Pauta.csv` | `reuniao;pauta` | 1:N via `pauta.reuniao_id` | 🔜 Pendente |
| `memoriaReunioes-Projeto.csv` | `nomeProj;ativo;instituicaoProjeto` | N:1 ou N:N (a definir) | 🔜 Pendente |
| `memoriaReunioes-Instituicao.csv` | `sigla;nome` | Via `participante.instituicao` (a definir) | 🔜 Pendente |

### III.2 — Padrão de Matching entre CSV e banco

Para reuniões: matching por `data_hora` + `projeto` (ambos juntos identificam unicamente uma reunião com alta confiança). Para participantes: matching por `nome` (campo UNIQUE).

---

## IV. Padrões de Implementação

### IV.1 — Backend (Hono + Node.js 22)

- **Rota nova**: criar `src/routes/[recurso].js` + registrar em `src/server.js`
- **Padrão de rota**: `GET /api/[recurso]?q=&limit=` com filtro LIKE e paginação
- **Transações**: usar `pool.getConnection()` + `beginTransaction/commit/rollback` em operações multi-step (INSERT em reuniao + INSERT em junction)
- **Validação**: função `validate(body)` local no arquivo de rota, retornando `{ campo: 'mensagem' }`
- **Erros**: sempre retornar `{ error: 'mensagem' }` com status HTTP correto

### IV.2 — Frontend (Alpine.js + Tailwind)

**Multi-select para relações N:N** (padrão participantes — reutilizar para novas N:N):
- Estado: `allItems[]`, `selectedIds` (Set), `searchQuery`, `showDropdown`
- Getter reativo: `filteredItems` filtra por campos relevantes
- Inicialização: `loadItems()` chamado em `openForm()` e `editMeeting()` (cache: só carrega uma vez)
- Submissão: `Array.from(selectedIds)` → `item_ids: number[]`
- Pré-preenchimento: `new Set(m.item_ids || [])` ao editar

**Select simples para relações N:1** (lookup):
- `<select x-model="formData.x_id">` com `<option x-for>` carregado da API

**Exibição na tabela de listagem**: usar campo `_nomes` (string concatenada via GROUP_CONCAT) para evitar array rendering na tabela.

### IV.3 — Queries com JOIN

Padrão para GET /api/meetings com múltiplas relações N:N:
```sql
SELECT r.*,
       GROUP_CONCAT(DISTINCT p.nome ORDER BY p.nome SEPARATOR ', ') AS participantes_nomes,
       GROUP_CONCAT(DISTINCT p.id ORDER BY p.nome) AS participante_ids_str
FROM reuniao r
LEFT JOIN reuniao_participante rp ON rp.reuniao_id = r.id
LEFT JOIN participante p ON p.id = rp.participante_id
[WHERE ...]
GROUP BY r.id
```
Cada nova relação N:N adiciona mais LEFT JOINs ao mesmo SELECT. Usar `DISTINCT` no GROUP_CONCAT para evitar duplicatas quando múltiplas joins estão ativas.

### IV.4 — Migrations

Nomenclatura sequencial:
- `001_init.sql` — schema inicial
- `002_add_tipos.sql` — alteração de enum
- `003_add_participantes.sql` — cria `participante` + `reuniao_participante`
- `004_drop_participantes_col.sql` — remove coluna legada
- `005_add_[próxima].sql` — próxima feature
- `006_drop_[próxima_col].sql` — remoção da coluna legada correspondente

**Regra**: migrations de criação e de remoção de coluna legada SEMPRE em arquivos separados e com números consecutivos.

---

## V. Banco de Dados de Produção

- **Host**: configurado via variáveis de ambiente (`DB_HOST`, `DB_PORT`)
- **Database**: `reunioes`
- **Engine**: MariaDB
- **Charset**: `utf8mb4` (obrigatório para suporte a acentos e emoji)
- **Infraestrutura**: UNRAID, container Docker

**Variáveis de ambiente da aplicação**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (em `.env` local, nunca commitado). Scripts admin usam credenciais root hardcoded em `docs/source/scripts/` (nunca commitado).

---

## VI. Workflow de Deploy

1. Desenvolver e testar localmente
2. `git commit` + `git push origin main` (branch único: `main`)
3. GitHub Actions (`.github/workflows/`) faz build e publica imagem no GHCR
4. UNRAID pull da nova imagem + restart do container
5. Migrations rodam via `docker exec` ou `npm run migrate` com env vars de produção

**Nunca criar branches** — todo commit vai direto no `main`. O speckit cria branches automaticamente: após implementar, sempre mergear no main e deletar o branch antes do push.

---

## VII. Estrutura do Projeto

```text
migrations/          # SQL migrations (commitado, imutável após aplicado)
src/
├── db.js            # Pool mysql2 (não modificar)
├── server.js        # Registrar novas rotas aqui
├── migrate.js       # Runner de migrations (não modificar)
└── routes/
    ├── meetings.js       # ⚠️ Modificar a cada nova relação com reuniao
    ├── participants.js   # GET /api/participants
    └── [novo].js         # Nova rota por recurso
public/
├── index.html            # ⚠️ Adicionar campos no formulário modal
└── assets/app.js         # ⚠️ Adicionar estado e métodos Alpine.js
docs/source/              # Data sources CSV (gitignored)
docs/source/scripts/      # Scripts de migração com credenciais (gitignored)
specs/                    # Documentação speckit por feature
```

---

## Governance

Esta constitution é a referência central para todas as features do meetingLog. Em caso de conflito com sugestões de ferramentas ou agentes, esta constitution prevalece.

Ao iniciar qualquer novo `/speckit.specify` para este projeto, o agente DEVE:
1. Consultar `data-model` da feature de participantes em `specs/002-add-participantes/` como exemplo canônico
2. Verificar a tabela de data sources (seção III.1) para entender o estado atual
3. Aplicar o processo canônico da seção II.1, especialmente o aviso sobre sequência de migrations
4. Propor número de migration a partir do último existente em `migrations/`

**Version**: 1.0.0 | **Ratified**: 2026-03-15 | **Last Amended**: 2026-03-15
