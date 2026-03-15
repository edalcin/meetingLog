# Tasks: Tabela de Participantes e Seleção em Reuniões

**Input**: Design documents from `/specs/002-add-participantes/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅

**Tests**: Não solicitados — sem tarefas de testes automatizados.

**Organization**: Tarefas agrupadas por user story para permitir implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: User story da spec.md (US1, US2, US3, US4)

---

## Phase 1: Setup

**Purpose**: Configuração de infraestrutura compartilhada antes de qualquer user story

- [x] T001 Adicionar `docs/source/scripts/` ao `.gitignore` na raiz do repositório

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema e API base que DEVEM estar completos antes de qualquer user story

**⚠️ CRÍTICO**: Nenhuma user story pode começar até esta fase estar completa

- [x] T002 Criar `migrations/003_add_participantes.sql`: tabela `participante` (id, nome VARCHAR UNIQUE NOT NULL, instituicao, cargo, email, criado_em) + tabela `reuniao_participante` (reuniao_id FK CASCADE, participante_id FK CASCADE, PK composta)
- [x] T003 [P] Criar `src/routes/participants.js`: rota `GET /api/participants?q=&limit=` que consulta tabela `participante` com filtro LIKE por nome e instituição, retorna `{ data: [{id, nome, instituicao, cargo, email}], total }`
- [x] T004 Registrar `participantsRouter` em `src/server.js` no caminho `/api/participants` (após importar `participants.js`)

**Checkpoint**: Migration 003 aplicada + GET /api/participants funcional — user stories podem começar ✅

---

## Phase 3: User Story 1 — Seleção de Participantes no Formulário (Priority: P1) 🎯 MVP

**Goal**: Substituir o campo de texto livre de participantes por um componente de multi-seleção que carrega participantes do banco e permite busca por nome/instituição

**Independent Test**: Abrir formulário de nova reunião → verificar que lista de participantes aparece pesquisável → selecionar 2+ participantes → salvar → verificar que reunião foi criada → abrir edição → verificar que os participantes selecionados estão pré-marcados

### Implementation for User Story 1

- [x] T005 [US1] Atualizar função `validate()` em `src/routes/meetings.js`: remover validação de `participantes` string; adicionar validação de `participante_ids` (array, ≥ 1 elemento, todos inteiros)
- [x] T006 [US1] Modificar `GET /` em `src/routes/meetings.js`: adicionar LEFT JOIN com `reuniao_participante` e `participante`, usar `GROUP_CONCAT(participante.nome ORDER BY participante.nome)` AS `participantes_nomes` e `GROUP_CONCAT(participante.id)` AS `participante_ids_str`, adicionar `GROUP BY reuniao.id`; remover `participantes` do `ALLOWED_SORT`
- [x] T007 [US1] Modificar `GET /:id` em `src/routes/meetings.js`: retornar `participantes: [{id, nome, instituicao, cargo, email}]` e `participante_ids: [number]` via JOIN separado (SELECT FROM reuniao_participante JOIN participante)
- [x] T008 [US1] Modificar `POST /` em `src/routes/meetings.js`: ler `participante_ids` do body; INSERT INTO reuniao; depois INSERT INTO `reuniao_participante` (reuniao_id, participante_id) para cada id; retornar reunião com participantes expandidos
- [x] T009 [US1] Modificar `PUT /:id` em `src/routes/meetings.js`: ler `participante_ids` do body; UPDATE reuniao; depois DELETE FROM `reuniao_participante` WHERE reuniao_id = ?; depois INSERT INTO `reuniao_participante` para cada novo id; retornar reunião atualizada com participantes expandidos
- [x] T010 [P] [US1] Adicionar estado do multi-select em `public/assets/app.js`: propriedades `allParticipants: []`, `selectedParticipantIds: new Set()`, `participantSearch: ''`, `showParticipantDropdown: false`; getter `filteredParticipants` (filtra `allParticipants` por `participantSearch` em nome e instituição); método `loadParticipants()` (GET /api/participants?limit=500, popula `allParticipants`); método `toggleParticipant(id)` (add/remove do Set); método `isSelected(id)` (verifica Set)
- [x] T011 [US1] Modificar `openForm()` em `public/assets/app.js`: chamar `loadParticipants()`; inicializar `selectedParticipantIds = new Set()`; remover `participantes: ''` do `formData`
- [x] T012 [US1] Modificar `editMeeting(m)` em `public/assets/app.js`: chamar `loadParticipants()`; inicializar `selectedParticipantIds = new Set(m.participante_ids || [])`; remover `participantes: m.participantes` do `formData`
- [x] T013 [US1] Modificar `saveMeeting()` em `public/assets/app.js`: incluir `participante_ids: Array.from(this.selectedParticipantIds)` no payload em vez de `participantes`
- [x] T014 [US1] Em `public/index.html`: substituir `<textarea x-model="formData.participantes">` pelo componente multi-select — campo de busca `x-model="participantSearch"`, botão toggle `@click="showParticipantDropdown = !showParticipantDropdown"` mostrando contagem de selecionados, dropdown `x-show="showParticipantDropdown"` com `@click.away="showParticipantDropdown = false"` listando `filteredParticipants` via `x-for`, cada item com checkbox visual `@click="toggleParticipant(p.id)"` e `:class` para destacar selecionados, tags dos selecionados acima da lista com botão de remover, mensagem de erro `formErrors.participante_ids`

**Checkpoint**: US1 completamente funcional — formulário de reunião usa multi-select de participantes ✅

---

## Phase 4: User Story 2 — Dados de Participantes Disponíveis (Priority: P2)

**Goal**: Importar todos os participantes do CSV para o banco de dados via script idempotente

**Independent Test**: Executar `node docs/source/scripts/migrate-participantes.js` → verificar que GET /api/participants retorna ~383 participantes → executar script novamente → verificar que total não aumentou (idempotência)

### Implementation for User Story 2

- [x] T015 [US2] Criar `docs/source/scripts/migrate-participantes.js` — Fase 1 (CSV import): conectar com mysql2 usando credenciais root (`root` / `***REMOVED***`, host/port/db de variável de ambiente ou argumento); ler `docs/source/memoriaReunioes-Participantes.csv` com separador `;`; para cada linha com nome não vazio: `INSERT IGNORE INTO participante (nome, instituicao, cargo, email) VALUES (?, ?, ?, ?)` (trim em todos os campos, NULL se vazio); exibir total de inseridos e total ignorados (já existentes)

**Checkpoint**: US2 funcional — script importa CSV e é idempotente; participantes disponíveis para seleção ✅

---

## Phase 5: User Story 3 — Migração de Dados Legados (Priority: P2)

**Goal**: Migrar associações de participantes do campo TEXT legado para a tabela de junção e remover a coluna TEXT

**Depends on**: US2 completa (tabela `participante` populada com nomes do CSV)

**Independent Test**: Executar fase legada do script → verificar que reuniões históricas têm registros em `reuniao_participante` → executar migration 004 → verificar que coluna `participantes` não existe mais em `reuniao`

### Implementation for User Story 3

- [x] T016 [US3] Adicionar Fase 2 (migração legada) ao `docs/source/scripts/migrate-participantes.js`: SELECT id, participantes FROM reuniao WHERE participantes IS NOT NULL AND participantes != ''; para cada reunião: tokenizar o texto por vírgula (e/ou ponto e vírgula); para cada token (trim): SELECT id FROM participante WHERE nome = ? (trim); se encontrado: INSERT IGNORE INTO reuniao_participante (reuniao_id, participante_id) VALUES (?, ?); se não encontrado: registrar em array de não-associados; ao final exibir log de nomes não associados por reunião
- [x] T017 [US3] Criar `migrations/004_drop_participantes_col.sql`: `ALTER TABLE reuniao DROP COLUMN participantes;`

**Checkpoint**: US3 funcional — dados legados migrados; column TEXT removida após execução da migration 004 ✅

---

## Phase 6: User Story 4 — Visualizar Participantes na Listagem (Priority: P3)

**Goal**: Exibir nomes de participantes de forma legível na tabela de reuniões e no detalhe

**Depends on**: US1 completa (API já retorna `participantes_nomes` e `participantes` array)

**Independent Test**: Abrir listagem de reuniões → verificar que coluna Participantes exibe nomes legíveis (não IDs) → verificar que reunião com múltiplos participantes lista todos os nomes

### Implementation for User Story 4

- [x] T018 [P] [US4] Em `public/index.html`: atualizar célula da coluna Participantes na tabela — substituir `:title="m.participantes" x-text="m.participantes"` por `:title="m.participantes_nomes" x-text="m.participantes_nomes"`
- [x] T019 [US4] Em `public/assets/app.js`: remover `'participantes'` do array `ALLOWED_SORT` (ou equivalente no frontend se existir); atualizar `sortCol` padrão se estava em `participantes`

**Checkpoint**: US4 funcional — participantes exibidos por nome na listagem de reuniões ✅

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T020 Executar `npm run migrate` para aplicar `003_add_participantes.sql` e verificar sem erros
- [ ] T021 [P] Verificar que `docs/source/scripts/` está no `.gitignore` e que `git status` não lista o diretório
- [ ] T022 Executar `node docs/source/scripts/migrate-participantes.js` e confirmar: CSV importado + legado migrado + log de não-associados exibido
- [ ] T023 Executar `npm run migrate` para aplicar `004_drop_participantes_col.sql` após confirmar T022
- [ ] T024 [P] Verificar `GET /api/participants?q=Eduardo` retorna resultados filtrados corretamente
- [ ] T025 [P] Verificar busca com acentos e cedilha no frontend (ex: "Viviane", "João", "Cristiana")
- [ ] T026 Validar sequência completa do `quickstart.md` em ambiente limpo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: Depende de Setup — **BLOQUEIA todas as user stories**
- **US1 (Phase 3)**: Depende de Foundational completo
- **US2 (Phase 4)**: Depende de Foundational completo — pode rodar em paralelo com US1
- **US3 (Phase 5)**: Depende de US2 completo (precisa de participantes no banco para matching)
- **US4 (Phase 6)**: Depende de US1 completo (API já retorna `participantes_nomes`)
- **Polish (Final)**: Depende de todas as user stories desejadas

### User Story Dependencies

```
Setup → Foundational → US1 ──────────────→ US4
                    └─→ US2 → US3
```

- **US1 (P1)**: Pode começar após Foundational — sem dependência de outras stories
- **US2 (P2)**: Pode começar após Foundational — sem dependência de US1
- **US3 (P2)**: Depende de US2 (tabela `participante` deve estar populada)
- **US4 (P3)**: Depende de US1 (API de meetings deve retornar `participantes_nomes`)

### Within Each User Story

- Backend antes de frontend (US1: T005–T009 antes de T010–T014)
- Fase CSV antes de fase legada (US2: T015 antes de US3: T016)

### Parallel Opportunities

- T003 e T004 podem rodar em paralelo (Foundational)
- T010 e T014 podem rodar em paralelo dentro de US1 (app.js e index.html são arquivos diferentes)
- US1 e US2 podem rodar em paralelo após Foundational

---

## Parallel Example: User Story 1

```bash
# Backend (T005–T009) e inicialização do estado frontend (T010) em paralelo:
Task T005: "Atualizar validate() em src/routes/meetings.js"
Task T010: "Adicionar estado multi-select em public/assets/app.js"

# Após T005–T009 completos, T014 (HTML) e T011–T013 (app.js) em paralelo:
Task T011: "Modificar openForm() em public/assets/app.js"
Task T014: "Substituir textarea pelo componente em public/index.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001)
2. Completar Phase 2: Foundational (T002–T004) — **CRÍTICO**
3. Completar Phase 3: US1 (T005–T014)
4. **PARAR e VALIDAR**: testar formulário de reunião com multi-select
5. Fazer deploy se validado — **feature core entregue**

### Incremental Delivery

1. Setup + Foundational → Base pronta
2. US1 → Formulário com multi-select funcional (MVP!)
3. US2 → Participantes do CSV disponíveis para seleção
4. US3 → Histórico migrado + coluna TEXT removida
5. US4 → Listagem exibe nomes legíveis
6. Cada story adiciona valor sem quebrar as anteriores

---

## Notes

- `[P]` = arquivos diferentes, sem dependências — podem rodar em paralelo
- `[Story]` mapeia cada tarefa para a user story correspondente
- Cada user story é independentemente testável após seu checkpoint
- Migration `004` DEVE ser executada somente após confirmar que o script de dados rodou (T022 antes de T023)
- O diretório `docs/source/scripts/` contém credenciais — nunca commitar (T001 + T021)
- Commit após cada checkpoint de user story
