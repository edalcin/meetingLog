# Tasks: Melhorias nos Participantes — Lotação, Status Ativo/Inativo e Notas

**Input**: Design documents from `/specs/011-enhance-participantes/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Não solicitados — validação manual conforme `quickstart.md`.

**Organization**: Tarefas agrupadas por User Story para entrega incremental independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode ser executado em paralelo (arquivos diferentes, sem dependência de tarefas incompletas)
- **[Story]**: User story à qual a tarefa pertence (US1–US4)
- Arquivo exato em cada descrição

---

## Phase 1: Setup (Nenhuma — projeto existente)

Esta feature estende código existente. Não há setup de projeto.

---

## Phase 2: Foundational (Pré-requisito bloqueante)

**Purpose**: A migration deve ser criada e aplicada antes de qualquer implementação poder ser testada no banco.

**⚠️ CRITICAL**: Nenhuma user story pode ser testada no banco sem esta fase completa.

- [X] T001 Criar arquivo `migrations/015_add_participante_enhancements.sql` com ALTER TABLE adicionando colunas `lotacao`, `ativo` e `notas` à tabela `participante` (ver data-model.md para SQL exato)
- [ ] T002 Aplicar migration com `npm run migrate` (requer banco acessível via variáveis de ambiente)

**Checkpoint**: Migration aplicada — banco tem colunas `lotacao`, `ativo`, `notas` em `participante`.

---

## Phase 3: User Story 1 — Filtrar Participantes Inativos no Autocomplete (Priority: P1) 🎯 MVP

**Goal**: Participantes marcados como inativos não aparecem no autocomplete ao registrar reuniões.

**Independent Test**: Usar o formulário de reunião e verificar que o autocomplete retorna apenas participantes ativos (os existentes, que terão `ativo=TRUE` por padrão após a migration).

### Implementation for User Story 1

- [X] T003 [P] [US1] Backend — Em `src/routes/participants.js`: adicionar suporte ao query param `?ativo` no `GET /api/participants`; quando `ativo=1`, acrescentar `AND ativo = TRUE` ao WHERE; atualizar o SELECT para retornar o campo `ativo` em todos os registros
- [X] T004 [P] [US1] Frontend — Em `public/assets/app.js`: alterar `loadParticipants()` para chamar `/api/participants?limit=500&ativo=1`; adicionar `this.allParticipants = []` no início de `saveParticipant()` para invalidar o cache após qualquer alteração de participante

**Checkpoint**: Verificar que `/api/participants?ativo=1` retorna apenas ativos e que `loadParticipants()` usa esse filtro.

---

## Phase 4: User Story 2 — Gerenciar Status Ativo/Inativo de Participante (Priority: P2)

**Goal**: Usuário pode alternar o status ativo/inativo de qualquer participante na tela de manutenção. Lista de manutenção tem filtro "Todos / Ativos / Inativos" e exibe badge visual para inativos.

**Independent Test**: Editar um participante existente, marcar como inativo, salvar. Verificar que o badge "Inativo" aparece na lista. Usar filtro "Inativos" para confirmar que ele aparece. Usar filtro "Ativos" para confirmar que ele some.

### Implementation for User Story 2

- [X] T005 [P] [US2] Backend — Em `src/routes/participants.js`: atualizar `POST /api/participants` para aceitar campo `ativo` (default `true`); atualizar `PUT /api/participants/:id` para aceitar e persistir `ativo`; garantir que o campo `ativo` é retornado nos responses de POST (201) e PUT (200)
- [X] T006 [P] [US2] Frontend app.js — Em `public/assets/app.js`: adicionar estado `participantStatusFilter: ''`; criar getter `filteredParticipantList` que filtra `participantListAll` por status (replicar padrão `filteredProjectList`); adicionar campo `ativo: true` ao estado `participantForm`; atualizar `openNewParticipant()` para inicializar `ativo: true`; atualizar `openEditParticipant(p)` para carregar `p.ativo`; atualizar `saveParticipant()` para incluir `ativo: this.participantForm.ativo` no payload
- [X] T007 [US2] Frontend HTML — Em `public/index.html`: adicionar toggle/checkbox `ativo` (label "Ativo") no formulário de participante (após campo email); adicionar botões de filtro "Todos / Ativos / Inativos" à lista de manutenção de participantes (replicar padrão dos projetos, ligado a `participantStatusFilter`); adicionar badge visual "Inativo" nas linhas de participantes inativos na lista (replicar padrão visual dos projetos)

**Checkpoint**: Ciclo completo ativo→inativo→ativo funcionando via UI; filtros da lista funcionando corretamente.

---

## Phase 5: User Story 3 — Adicionar Campo Lotação ao Participante (Priority: P3)

**Goal**: Campo "Lotação" disponível em criação e edição, posicionado entre Instituição e Cargo. Campo pesquisável no autocomplete de reuniões.

**Independent Test**: Criar novo participante com Lotação preenchida. Verificar que a Lotação é salva e exibida. Abrir formulário de reunião, digitar texto da Lotação no campo de busca de participantes, verificar que o participante aparece nas sugestões.

### Implementation for User Story 3

- [X] T008 [P] [US3] Backend — Em `src/routes/participants.js`: adicionar `lotacao` à cláusula `WHERE` de busca (`OR lotacao LIKE ?`); adicionar `lotacao` ao SELECT do `GET /api/participants`; adicionar `lotacao` ao INSERT no `POST` e ao UPDATE no `PUT`; garantir que `lotacao` é retornado nos responses de POST e PUT
- [X] T009 [P] [US3] Frontend app.js — Em `public/assets/app.js`: adicionar campo `lotacao: ''` ao estado `participantForm`; atualizar `openNewParticipant()` para inicializar `lotacao: ''`; atualizar `openEditParticipant(p)` para carregar `p.lotacao || ''`; atualizar `saveParticipant()` para incluir `lotacao` no payload; atualizar getter `filteredParticipants` para incluir `(p.lotacao && p.lotacao.toLowerCase().includes(q))` na condição de busca; atualizar `filteredParticipantsForFilter` da mesma forma
- [X] T010 [US3] Frontend HTML — Em `public/index.html`: adicionar campo de texto `lotacao` no formulário de participante, posicionado entre os campos `instituicao` e `cargo` (label "Lotação"); exibir campo `lotacao` nas linhas da lista de manutenção de participantes (junto com instituição e cargo)

**Checkpoint**: Criar participante com Lotação; buscar no autocomplete de reunião pelo valor da Lotação; confirmar que aparece nas sugestões.

---

## Phase 6: User Story 4 — Adicionar Notas ao Participante (Priority: P4)

**Goal**: Editor Quill de notas disponível ao final do formulário de participante, tanto na criação quanto na edição. Notas persistidas e carregadas corretamente.

**Independent Test**: Criar participante com notas no editor Quill. Fechar o modal. Reabrir para edição. Verificar que o conteúdo das notas é carregado no editor.

### Implementation for User Story 4

- [X] T011 [P] [US4] Backend — Em `src/routes/participants.js`: adicionar `notas` ao INSERT no `POST` e ao UPDATE no `PUT`; adicionar `notas` ao SELECT do `GET /api/participants` (retornar em todos os registros para simplificar o carregamento no formulário de edição, consistente com o padrão de projetos); garantir que `notas` é retornado nos responses de POST e PUT
- [X] T012 [P] [US4] Frontend app.js — Em `public/assets/app.js`: declarar `let _quillParticipantEditor = null` junto com as outras variáveis Quill no topo da função `app()`; no `$watch('activeTab', ...)`, adicionar caso `tab === 'participants'` que inicializa `_quillParticipantEditor` em `#quill-participant-editor` (replicar configuração do `_quillProjectEditor` incluindo tema `snow`, toolbar e paste handler); adicionar campo `notas: ''` ao estado `participantForm`; atualizar `openNewParticipant()` para chamar `_quillParticipantEditor.setContents([{ insert: '\n' }])` via `requestAnimationFrame`; atualizar `openEditParticipant(p)` para chamar `loadNotasIntoQuill(_quillParticipantEditor, p.notas)` via `requestAnimationFrame`; atualizar `saveParticipant()` para extrair conteúdo com `_quillParticipantEditor ? _quillParticipantEditor.root.innerHTML : null`
- [X] T013 [US4] Frontend HTML — Em `public/index.html`: adicionar `<div id="quill-participant-editor"></div>` ao final do modal de participante (após todos os outros campos), com a mesma estrutura de container e label usada pelo editor de notas dos projetos (`#quill-project-editor`)

**Checkpoint**: Criar participante com notas; editar o participante; confirmar que as notas aparecem no editor carregadas corretamente.

---

## Phase 7: Polish & Validação Final

- [X] T014 [P] Revisar contrato da API: verificar que o campo `notas` retornado no GET não excede limites de payload para o número esperado de participantes (aceitável para single-user com ~centenas de registros)
- [X] T015 Executar validação completa conforme `specs/011-enhance-participantes/quickstart.md`
- [ ] T016 Commit de todos os arquivos modificados no branch `011-enhance-participantes` e merge para `main` (conforme constitution VI — único branch principal)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: Sem dependências — iniciar imediatamente. **BLOQUEIA todas as user stories**.
- **US1 (Phase 3)**: Depende de Phase 2 (migration aplicada). Independente de US2, US3, US4.
- **US2 (Phase 4)**: Depende de Phase 2 + T003 (backend precisa retornar `ativo`). Independente de US3, US4.
- **US3 (Phase 5)**: Depende de Phase 2. T008 modifica o mesmo arquivo que T003/T005 — executar após ambos. Independente de US2, US4.
- **US4 (Phase 6)**: Depende de Phase 2. T011 modifica o mesmo arquivo que T003/T005/T008 — executar por último no backend. Independente de US2, US3 para o frontend.
- **Polish (Phase 7)**: Depende de todas as user stories.

### User Story Dependencies (mesmo arquivo — `src/routes/participants.js`)

Todas as tarefas de backend modificam o mesmo arquivo. Ordem obrigatória de execução:

```
T003 (US1 — adiciona ativo ao GET)
  → T005 (US2 — adiciona ativo ao POST/PUT)
    → T008 (US3 — adiciona lotacao ao GET/POST/PUT)
      → T011 (US4 — adiciona notas ao GET/POST/PUT)
```

### Frontend `public/assets/app.js` — Ordem recomendada

```
T004 (US1 — loadParticipants + cache invalidation)
  → T006 (US2 — status filter + ativo no form)
    → T009 (US3 — lotacao no form + getter de busca)
      → T012 (US4 — Quill + notas)
```

### Frontend `public/index.html` — Podem ser feitas em sequência após app.js

```
T007 (US2 — toggle ativo + filtro lista)
T010 (US3 — campo lotacao no form e lista)
T013 (US4 — div quill-participant-editor)
```

### Parallel Opportunities

- T003 (backend) e T004 (app.js) são em arquivos diferentes → **[P]** dentro de US1
- T005 (backend) e T006 (app.js) são em arquivos diferentes → **[P]** dentro de US2
- T008 (backend) e T009 (app.js) são em arquivos diferentes → **[P]** dentro de US3
- T011 (backend) e T012 (app.js) são em arquivos diferentes → **[P]** dentro de US4
- T007, T010, T013 (todos em index.html) são sequenciais entre si (mesmo arquivo), mas paralelos às tarefas de backend e app.js de suas respectivas stories

---

## Parallel Example: User Story 2

```
# Executar em paralelo (arquivos diferentes):
Task T005: "Atualizar POST/PUT em src/routes/participants.js para aceitar ativo"
Task T006: "Atualizar estado Alpine e métodos em public/assets/app.js para ativo"

# Após T006 completo:
Task T007: "Adicionar toggle e filtros em public/index.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only — ~2 tarefas)

1. Completar Phase 2: Foundational (T001, T002)
2. Completar Phase 3: US1 (T003, T004)
3. **PARAR e VALIDAR**: autocomplete de reuniões funciona sem mostrar inativos?
4. Continuar com US2 → US3 → US4

### Incremental Delivery

| Story | Tarefas | Entrega |
|-------|---------|---------|
| Foundation | T001, T002 | Banco preparado |
| US1 | T003, T004 | Autocomplete filtrado ✅ |
| US2 | T005, T006, T007 | Toggle + filtro lista ✅ |
| US3 | T008, T009, T010 | Campo Lotação ✅ |
| US4 | T011, T012, T013 | Notas com Quill ✅ |
| Polish | T014, T015, T016 | Validado e commitado ✅ |

---

## Notes

- [P] = arquivos diferentes, sem dependência de tarefas incompletas
- Todas as modificações em `participants.js` são sequenciais (mesmo arquivo) — seguir ordem T003 → T005 → T008 → T011
- Todas as modificações em `app.js` são sequenciais — seguir ordem T004 → T006 → T009 → T012
- `loadParticipantList()` (aba de manutenção) chama a mesma rota mas SEM `?ativo=1` — retorna todos os participantes para a lista de manutenção
- Após T011, verificar que `notas` no GET de listagem não causa problemas de performance (aceitável para single-user)
- A cache invalidation em T004 (`this.allParticipants = []`) garante que mudanças de status feitas em US2 sejam refletidas no autocomplete de reuniões da mesma sessão
