# Tasks: Add Projetos e Menu de Navegação

**Input**: Design documents from `/specs/003-add-projetos/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅ | quickstart.md ✅

**Organization**: Tasks grouped by user story — each phase is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US4) matching spec.md priorities
- Exact file paths included in every task description

---

## Phase 1: Setup (Infraestrutura Compartilhada)

**Purpose**: Garantir que o diretório de scripts nunca seja commitado.

- [x] T001 Verify/add `docs/source/scripts/` to `.gitignore` and `.dockerignore` (per constitution I.4) in `.gitignore` and `.dockerignore`

---

## Phase 2: Foundational (Pré-requisito Bloqueante)

**Purpose**: Schema SQL criado antes de qualquer user story poder ser testada.

**⚠️ CRÍTICO**: Nenhuma user story pode ser iniciada antes desta fase.

- [x] T002 Create `migrations/005_add_projetos.sql` — CREATE TABLE `projeto` (id, nome UNIQUE, ativo BOOLEAN, instituicao NULL, criado_em) + CREATE TABLE `reuniao_projeto` (reuniao_id FK, projeto_id FK, PK composta) per `data-model.md`

**Checkpoint**: Migration SQL pronta para ser aplicada na US1.

---

## Phase 3: User Story 1 — Migrar Dados de Projetos do CSV (Priority: P1) 🎯 MVP

**Goal**: Tabela `projeto` populada com 49 registros + associações `reuniao_projeto` criadas a partir da coluna `reuniao.projeto` TEXT legada. Pré-requisito obrigatório para todo o resto.

**Independent Test**: Executar o script e consultar o banco — `SELECT COUNT(*) FROM projeto` retorna 49; `SELECT COUNT(*) FROM reuniao_projeto` retorna valor > 0.

### Implementation for User Story 1

- [x] T003 [US1] Create `docs/source/scripts/migrate-projetos.js` — connect to MariaDB (`DB_HOST:3333`, user root, password `***REMOVED***`), read `docs/source/memoriaReunioes-Projeto.csv` (sep `;`), INSERT IGNORE into `projeto` (convert VERDADEIRO→1/FALSO→0 for `ativo`), then read `reuniao.projeto` TEXT for each reunião, split by `,` + trim, lookup each name in `projeto` by exact nome match, INSERT IGNORE into `reuniao_projeto`, log unmatched names
- [ ] T004 [US1] Execute `npm run migrate` — applies `005_add_projetos.sql` only (006 does not exist yet); verify tables `projeto` and `reuniao_projeto` exist and `reuniao.projeto` column still present
- [ ] T005 [US1] Execute `node docs/source/scripts/migrate-projetos.js` — verify 49 rows in `projeto` and associations in `reuniao_projeto`; review log for unmatched project names

**Checkpoint**: `projeto` populada com 49 registros. US2, US3, US4 podem começar.

---

## Phase 4: User Story 2 — Visualizar Lista de Projetos (Priority: P2)

**Goal**: Endpoint `GET /api/projects` funcional + seção "Projetos" na interface listando todos os projetos (ativos e inativos) com indicação visual de status.

**Independent Test**: Acessar a seção "Projetos" (ou chamar `GET /api/projects`) e verificar que todos os 49 projetos aparecem com nome, status ativo/inativo e instituição.

### Implementation for User Story 2

- [x] T006 [P] [US2] Create `src/routes/projects.js` — export Hono router with `GET /api/projects`: query params `q` (LIKE filter on nome/instituicao), `activeOnly` (boolean, default false), `limit` (default 200, max 500); SQL uses parameterized `?`; response `{ data: [...], total: N }` per `contracts/api.md`
- [x] T007 [US2] Register `GET /api/projects` route in `src/server.js` — import and mount `src/routes/projects.js` following existing pattern for participants route
- [x] T008 [P] [US2] Add projetos section HTML to `public/index.html` — table with columns "Nome", "Status" (badge ativo/inativo), "Instituição"; empty state message; section initially hidden (controlled by Alpine.js `activeTab`)
- [x] T009 [US2] Add projetos Alpine.js state and methods to `public/assets/app.js` — `allProjects: []`, `loadProjects()` (calls `GET /api/projects`, caches result), called on app init or when tab is activated

**Checkpoint**: `GET /api/projects` returns 49 projects; projetos section shows full list.

---

## Phase 5: User Story 3 — Associar Projetos a uma Reunião (Priority: P3)

**Goal**: Formulário de criação/edição de reunião inclui multi-select de projetos (mesmo padrão dos participantes); reuniões salvas mantêm associações; modo leitura exibe projetos associados.

**Independent Test**: Criar reunião com 2 projetos, salvar, reabrir — ambos aparecem pré-selecionados. Reunião existente com projeto inativo — projeto inativo aparece pré-selecionado mas não na lista de opções.

### Implementation for User Story 3

- [x] T010 [US3] Modify `src/routes/meetings.js` — add `LEFT JOIN reuniao_projeto rpj ON rpj.reuniao_id = r.id LEFT JOIN projeto pr ON pr.id = rpj.projeto_id` to all SELECT queries; add `GROUP_CONCAT(DISTINCT pr.nome ORDER BY pr.nome SEPARATOR ', ') AS projeto_nomes` and `GROUP_CONCAT(DISTINCT pr.id ORDER BY pr.nome) AS projeto_ids_str` to GROUP BY queries; accept `projeto_ids: []` (optional) in POST/PUT body validation; replace DELETE+INSERT pattern for `reuniao_projeto` (same as participantes); return `projeto_nomes`, `projeto_ids`, `projetos[]` in responses per `contracts/api.md`; remove `projeto` TEXT field from all responses after migration 006 is applied
- [x] T011 [P] [US3] Add projetos multi-select state to `public/assets/app.js` — follow exact constitution IV.2 pattern: `selectedProjectIds` (Set), `projectSearchQuery`, `showProjectDropdown`, reactive getter `filteredProjects` (filters `allProjects` to active-only, excludes already-selected; includes inactive if already in `selectedProjectIds` as pré-selecionado with flag); `loadProjects()` with cache (activeOnly=false to get all for pre-population, filter in getter); `Array.from(selectedProjectIds)` → `projeto_ids` on submit; `new Set(m.projeto_ids || [])` on edit open
- [x] T012 [US3] Modify `public/index.html` — add projeto multi-select field to meeting create/edit form (same HTML pattern as participantes: dropdown with search input, selected tags, remove button); display `projeto_nomes` in meetings list table column; display `projetos[]` array in meeting detail/view panel following participantes display pattern; show inactive projects in edit form with visual indicator (e.g., "(inativo)" suffix or greyed badge)

**Checkpoint**: POST/PUT meetings accept `projeto_ids`; GET meetings return `projeto_nomes`; form multi-select works for ativos; inativos pré-selecionados aparecem corretamente.

---

## Phase 6: User Story 4 — Navegar pelo Menu Principal (Priority: P4)

**Goal**: Menu fixo no topo com tabs "Reuniões", "Participantes", "Projetos"; item ativo destacado; navegação por clique entre seções.

**Independent Test**: Clicar em cada tab e verificar que a seção correta é exibida e o item ativo é destacado visualmente.

### Implementation for User Story 4

- [x] T013 [P] [US4] Modify `public/index.html` — add top navigation bar with three tabs: "Reuniões", "Participantes", "Projetos"; use `x-on:click="activeTab = 'meetings'"` pattern; active tab highlighted with Tailwind class conditionally applied via `:class`; all content sections wrapped with `x-show="activeTab === '...'"` directives
- [x] T014 [P] [US4] Modify `public/assets/app.js` — add `activeTab: 'meetings'` to Alpine.js app state (default shows meetings list on load); ensure `loadProjects()` is triggered when `activeTab` changes to `'projects'` (use `x-effect` or `@click` handler)
- [x] T015 [US4] Create `migrations/006_drop_projeto_col.sql` — `ALTER TABLE reuniao DROP INDEX idx_projeto, DROP COLUMN projeto;` with comment warning to only apply after migrate-projetos.js has run successfully

**Checkpoint**: Navegação por tabs funcional. Todos os 4 user stories completos e validados — pronto para executar migration 006.

---

## Phase 7: Polish & Deploy

**Purpose**: Migration de limpeza, validação final e commit.

- [ ] T016 Execute `npm run migrate` — applies `006_drop_projeto_col.sql`; verify `DESCRIBE reuniao` no longer shows `projeto` column; verify app still functions correctly (projeto_nomes comes from JOIN)
- [x] T017 [P] Run `npm test` — confirm no regressions in existing tests
- [ ] T018 Commit and push — `git add migrations/ src/ public/ specs/003-add-projetos/ .gitignore .dockerignore && git commit && git push origin main`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: Depende do Setup — bloqueia todas as user stories
- **US1 (Phase 3)**: Depende da Foundational — **bloqueia US2, US3, US4** (dados devem existir antes)
- **US2, US3, US4 (Phases 4–6)**: Dependem de US1 completa; podem ser feitas em sequência
- **Polish (Phase 7)**: Depende de todos os user stories concluídos e validados

### User Story Dependencies

- **US1 (P1)**: Pré-requisito crítico — sem dados, nada funciona
- **US2 (P2)**: Depende de US1 (tabela `projeto` populada); independente de US3/US4
- **US3 (P3)**: Depende de US1 (tabela `projeto` e `reuniao_projeto`); independente de US4
- **US4 (P4)**: Depende de US2 (seção projetos a ser mostrada); independente de US3

### Parallel Opportunities Per Story

- **US2**: T006 (routes/projects.js) e T008 (index.html seção) podem rodar em paralelo
- **US3**: T011 (app.js state) pode rodar em paralelo com T010 (meetings route) — arquivos diferentes
- **US4**: T013 (index.html nav) e T014 (app.js state) podem rodar em paralelo

---

## Implementation Strategy

### MVP (US1 apenas)

1. Phase 1: Setup (T001)
2. Phase 2: Foundational (T002)
3. Phase 3: US1 completa (T003→T005)
4. **PARAR e VALIDAR**: `SELECT COUNT(*) FROM projeto` = 49 ✅
5. Continuar com US2

### Entrega Incremental

1. Setup + Foundational → Base pronta
2. US1 → Dados migrados → validar banco ✅
3. US2 → Lista de projetos visível ✅
4. US3 → Projetos associáveis a reuniões ✅
5. US4 → Menu de navegação completo ✅
6. Polish → Migration 006 + commit + push ✅

---

## Notes

- `[P]` = arquivos diferentes, sem dependência de tarefas incompletas
- `[US?]` = rastreabilidade para a user story na spec.md
- **Nunca executar `npm run migrate` cobrindo 005 e 006 juntos** — ver quickstart.md
- T004 aplica apenas 005 (006 não existe ainda); T016 aplica apenas 006 (após validação completa)
- Script T003 deve usar `INSERT IGNORE` — executar duas vezes não cria duplicatas
- Padrão multi-select de projetos é idêntico ao de participantes — ver constitution IV.2
