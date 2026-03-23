# Tasks: Projetos Multi-Institucionais

**Input**: Design documents from `/specs/008-multi-institution-projects/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Não solicitados. Validação manual via `quickstart.md`.

**Organization**: Tarefas agrupadas por user story. US1 é o MVP completo e pode ser entregue independentemente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode ser executada em paralelo com outras tarefas do mesmo grupo (arquivos diferentes)
- **[Story]**: A qual user story a tarefa pertence
- Caminhos absolutos a partir da raiz do repositório

---

## Phase 1: Foundational (Pré-requisitos que bloqueiam todas as stories)

**Purpose**: Infraestrutura compartilhada que deve ser concluída ANTES de qualquer user story

**⚠️ CRÍTICO**: Nenhuma user story pode ser iniciada antes desta fase estar completa

- [x] T001 Criar `migrations/012_drop_projeto_instituicao_col.sql` com `ALTER TABLE projeto DROP COLUMN instituicao`
- [x] T002 Criar `docs/source/scripts/migrate_projeto_instituicao.js` — ler `projeto.instituicao`, fazer match case-insensitive com `instituicao.sigla`, INSERT IGNORE em `projeto_instituicao`, logar registros sem correspondência (ver data-model.md seção "Script de Migração de Dados")
- [x] T003 Reescrever `GET /api/projects` em `src/routes/projects.js` — substituir SELECT direto por LEFT JOINs com `projeto_instituicao` e `instituicao`, adicionar `GROUP_CONCAT(DISTINCT i.sigla ...) AS instituicao_nomes` e `GROUP_CONCAT(DISTINCT i.id ...) AS instituicao_ids_str`, atualizar filtro de texto para incluir `i.sigla LIKE ?` e `i.nome LIKE ?`, usar `COUNT(DISTINCT p.id)` no count, parsear `instituicao_ids_str` → array em cada row (ver data-model.md seção "Queries principais")
- [x] T004 Remover propagação de sigla para projetos em `src/routes/institutions.js` — apagar a linha `await pool.query('UPDATE projeto SET instituicao=? WHERE instituicao=?', [...])` (~linha 72), que se tornará inválida após a migration 012

**Checkpoint**: Backend GET funcional + migration preparada. User stories podem iniciar.

---

## Phase 2: User Story 1 — Associar múltiplas instituições a um projeto (Priority: P1) 🎯 MVP

**Goal**: Usuário pode vincular, remover e salvar múltiplas instituições em um projeto via formulário com tags removíveis.

**Independent Test**: Criar um novo projeto sem sair da ficha de projeto, vincular 2 instituições já cadastradas, salvar e verificar que ambas aparecem ao reabrir o projeto para edição. Verificar que a lista de projetos exibe ambas as siglas.

### Implementação — Backend

- [x] T005 [P] [US1] Reescrever `POST /api/projects` em `src/routes/projects.js` — remover campo `instituicao`, aceitar `body.instituicao_ids` (array, default `[]`), usar `pool.getConnection()` + `beginTransaction/commit/rollback`, INSERT em `projeto` sem `instituicao`, INSERT IGNORE em `projeto_instituicao` para cada ID recebido, retornar projeto com `instituicao_nomes` e `instituicao_ids` (ver contracts/api-projects.md)
- [x] T006 [P] [US1] Reescrever `PUT /api/projects/:id` em `src/routes/projects.js` — remover campo `instituicao`, aceitar `body.instituicao_ids` (array, default `[]`), usar transação: UPDATE `projeto` + DELETE FROM `projeto_instituicao` WHERE `projeto_id=?` + INSERT IGNORE para cada ID, retornar projeto atualizado com `instituicao_nomes` e `instituicao_ids`

### Implementação — Frontend `public/assets/app.js`

- [x] T007 [P] [US1] Atualizar estado do formulário de projeto em `public/assets/app.js` — mudar `projectForm` de `{ nome, ativo, instituicao: '' }` para `{ nome, ativo, instituicao_ids: new Set() }`; atualizar `openNewProject()` para inicializar `instituicao_ids: new Set()`; atualizar `openEditProject(p)` para inicializar `instituicao_ids: new Set(p.instituicao_ids || [])`; atualizar `cancelProjectForm()` para resetar o Set; remover pré-preenchimento de `projectInstSearch` com sigla legada
- [x] T008 [US1] Adicionar getter `selectedProjectInsts` e atualizar getter `filteredProjectInstOptions` em `public/assets/app.js` — `selectedProjectInsts`: retorna `institutionListAll.filter(i => projectForm.instituicao_ids.has(i.id))`; `filteredProjectInstOptions`: filtrar instituições já selecionadas do resultado, retornar todas não selecionadas quando query vazia (ver data-model.md seção "Getter filteredProjectInstOptions")
- [x] T009 [US1] Atualizar `selectProjectInst()` e adicionar `removeProjectInst()` em `public/assets/app.js` — `selectProjectInst(inst)`: aceitar objeto `inst` (não string sigla), adicionar `inst.id` ao Set `projectForm.instituicao_ids`, limpar `projectInstSearch` e fechar dropdown; remover `clearProjectInst()`; adicionar `removeProjectInst(id)`: chamar `projectForm.instituicao_ids.delete(id)`
- [x] T010 [US1] Atualizar `saveProject()` em `public/assets/app.js` — body da requisição: `{ nome, ativo, instituicao_ids: Array.from(this.projectForm.instituicao_ids) }`; remover campo `instituicao` do body

### Implementação — Frontend `public/index.html`

- [x] T011 [P] [US1] Substituir tag única de instituição por loop de tags múltiplas no formulário de projeto em `public/index.html` — substituir bloco `x-show="projectForm.instituicao"` por `<template x-for="inst in selectedProjectInsts" :key="inst.id">` com tag `×` chamando `removeProjectInst(inst.id)` para cada instituição; manter o campo de busca abaixo das tags (ver plan.md tarefa F1)

**Checkpoint**: US1 completamente funcional. Criar/editar projeto com múltiplas instituições funciona end-to-end.

---

## Phase 3: User Story 2 — Criar nova instituição com ENTER (Priority: P2)

**Goal**: Usuário digita uma sigla inexistente no campo de busca e pressiona ENTER — a instituição é criada no sistema e vinculada imediatamente ao projeto.

**Independent Test**: No formulário de projeto, digitar "TESTENOVA" (sigla inexistente) e pressionar ENTER. Verificar que a tag "TESTENOVA" aparece vinculada ao projeto, que a instituição existe na aba Instituições, e que uma segunda pressão de ENTER com a mesma sigla a seleciona sem criar duplicata.

### Implementação — Frontend `public/assets/app.js`

- [x] T012 [P] [US2] Adicionar `handleProjectInstEnter()` em `public/assets/app.js` — se query vazia: retornar; buscar match exato case-insensitive em `institutionListAll`; se encontrado e não selecionado: chamar `selectProjectInst(exact)`, limpar search, fechar dropdown; se não encontrado: chamar `createAndSelectProjectInst(q.trim())` (padrão idêntico ao `handleParticipantEnter()` em linha ~503)
- [x] T013 [US2] Atualizar `createAndSelectProjectInst(sigla)` em `public/assets/app.js` — após criar com sucesso: adicionar `body` ao `institutionListAll`, adicionar `body.id` ao Set `projectForm.instituicao_ids` (substituir `selectProjectInst(body.sigla)` por `projectForm.instituicao_ids.add(body.id)`); também atualizar getter `showProjectInstCreateOption` para verificar que a sigla digitada não está entre as instituições já selecionadas

### Implementação — Frontend `public/index.html`

- [x] T014 [P] [US2] Adicionar `@keydown.enter.prevent="handleProjectInstEnter()"` no input de busca de instituições do formulário de projeto em `public/index.html` — no mesmo input que já tem `@keydown.escape`, adicionar o handler de ENTER (ver plan.md tarefa F2)

**Checkpoint**: US1 + US2 funcionais. Criar instituição inline com ENTER funciona.

---

## Phase 4: User Story 3 — Visualizar instituições nas listagens e detalhes (Priority: P3)

**Goal**: Todas as listagens (aba Projetos, dropdown de projetos na ficha de reunião) e o painel de detalhes exibem as instituições vinculadas usando o campo `instituicao_nomes`, substituindo completamente `p.instituicao`.

**Independent Test**: Verificar que a coluna "Instituição" na lista de projetos exibe as siglas separadas por vírgula; verificar que projetos sem instituição exibem "—"; verificar que a busca de projetos por nome de instituição retorna os projetos corretos; verificar que o filtro de instituição na aba Projetos continua funcionando.

### Implementação — Frontend `public/assets/app.js`

- [x] T015 [P] [US3] Atualizar getters de filtragem de projetos em `public/assets/app.js` — `projInstituicaoOptions` (~linha 132): trocar `p.instituicao` por `p.instituicao_nomes`; `filteredProjectList` (~linha 232): trocar filter por `p.instituicao` → `p.instituicao_nomes`; `filteredProjects` (formulário de reunião, ~linha 271): trocar `pr.instituicao` → `pr.instituicao_nomes`; `filteredProjectsForFilter` (~linha 120): trocar `pr.instituicao` → `pr.instituicao_nomes`
- [x] T016 [P] [US3] Remover handlers de propagação de sigla para projetos em `public/assets/app.js` — apagar as linhas `if (p.instituicao === oldSigla) p.instituicao = newSigla` (~linhas 1157, 1160, 1163) que atualizavam a sigla nos arrays em memória; a relação agora é por ID na junction table

### Implementação — Frontend `public/index.html`

- [x] T017 [P] [US3] Atualizar display de instituição na lista de projetos e dropdowns em `public/index.html` — substituir `x-text="p.instituicao ?? '—'"` → `x-text="p.instituicao_nomes || '—'"` (~linha 641); substituir `x-show="pr.instituicao"` e `x-text="' · ' + pr.instituicao"` → usar `pr.instituicao_nomes` nos dropdowns de projetos da ficha de reunião (~linhas 221, 260, 965)

**Checkpoint**: Todas as 3 user stories funcionais. Sistema completamente migrado para multi-instituição.

---

## Phase 5: Polish & Sequência de Deploy

**Purpose**: Validação final e execução da sequência de deploy documentada em `quickstart.md`

- [ ] T018 Executar `node docs/source/scripts/migrate_projeto_instituicao.js` e verificar os logs — confirmar que projetos com instituição preenchida foram migrados corretamente; registrar quaisquer `[UNMATCHED]` para revisão manual
- [ ] T019 Executar `npm run migrate` para aplicar `migrations/012_drop_projeto_instituicao_col.sql` — confirmar que a coluna `instituicao` foi removida da tabela `projeto`
- [ ] T020 Validar a sequência completa conforme `specs/008-multi-institution-projects/quickstart.md` — percorrer todos os 6 cenários de verificação pós-deploy

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: Sem dependências — iniciar imediatamente. Bloqueia todas as user stories.
- **US1 (Phase 2)**: Depende da conclusão da Phase 1
- **US2 (Phase 3)**: Depende de US1 estar completa (usa o Set e `selectProjectInst` de US1)
- **US3 (Phase 4)**: Depende da Phase 1 (GET retorna `instituicao_nomes`); pode ser feita em paralelo com US1/US2 pois toca arquivos e getters diferentes
- **Polish (Phase 5)**: Depende das 3 user stories estarem completas

### User Story Dependencies

- **US1**: Pode iniciar após Foundational — sem dependências em outras stories
- **US2**: Depende de US1 (usa o estado `instituicao_ids: Set` e `selectProjectInst` definidos em US1)
- **US3**: Pode iniciar após Foundational — pode ser feita em paralelo com US1 (toca getters e display, não o formulário)

### Dentro de cada User Story

- Backend (projects.js) e frontend (app.js, index.html) podem ser feitos em paralelo [P]
- Dentro do app.js: T007 → T008 → T009 → T010 (sequencial, mesmo arquivo)
- T011 (index.html) pode ser feito em paralelo com T007-T010 (arquivo diferente)

### Parallel Opportunities

```
Phase 1 (sequencial por dependências lógicas):
  T001 → T002 → T003 → T004

Phase 2 (US1):
  Paralelo: [T005 + T006] (backend) com [T007 → T008 → T009 → T010] (app.js) e [T011] (index.html)

Phase 3 (US2):
  Paralelo: [T012 + T013] (app.js) com [T014] (index.html)

Phase 4 (US3):
  Paralelo: [T015 + T016] (app.js) com [T017] (index.html)
```

---

## Implementation Strategy

### MVP (User Story 1 apenas)

1. Concluir Phase 1: Foundational
2. Concluir Phase 2: US1 (backend POST/PUT + frontend multi-tag)
3. **PARAR e VALIDAR**: Testar criação e edição de projeto com múltiplas instituições
4. Usuário pode vincular múltiplas instituições — valor entregue

### Entrega Incremental

1. Phase 1 (Foundational) → base estável
2. Phase 2 (US1) → multi-seleção funciona, MVP entregue
3. Phase 3 (US2) → ENTER-to-create disponível
4. Phase 4 (US3) → todas as listagens atualizadas
5. Phase 5 (Polish) → deploy completo com migração de dados

---

## Notes

- [P] = arquivos diferentes, sem dependência entre si
- US2 depende de US1 (não são independentes na implementação)
- A sequência T018 → T019 em Phase 5 é **obrigatória nesta ordem** — ver aviso em `quickstart.md`
- Nunca executar `npm run migrate` (T019) antes de `migrate_projeto_instituicao.js` (T018)
- Commit recomendado após cada Phase completa
