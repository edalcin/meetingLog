# Tasks: Notas e Links em Projetos

**Input**: Design documents from `/specs/010-project-notes-links/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Tests**: Não solicitados — validação manual via smoke test na fase final.

**Organization**: Tarefas agrupadas por user story para entrega independente e incremental.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: A qual user story a tarefa pertence (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Criar as migrations que são pré-requisito de ambas as user stories.

- [x] T001 Criar `migrations/013_add_projeto_notas.sql` com `ALTER TABLE projeto ADD COLUMN notas TEXT NULL AFTER ativo`
- [x] T002 [P] Criar `migrations/014_add_projeto_link.sql` com `CREATE TABLE IF NOT EXISTS projeto_link` (id, projeto_id FK, nome NULL, url, ordem, criado_em; UNIQUE KEY em projeto_id+url; FK CASCADE)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Endpoint GET /api/projects/:id/detail — pré-requisito compartilhado por US1 e US2, pois o frontend chama este endpoint ao abrir o formulário de edição para obter notas + links juntos.

**⚠️ CRITICAL**: Nenhuma user story pode ser iniciada antes que esta fase esteja completa.

- [x] T003 Adicionar endpoint `GET /api/projects/:id/detail` em `src/routes/projects.js` que retorna o projeto completo com `notas` e array `links: [{id, nome, url, ordem}]` (SELECT projeto + SELECT projeto_link WHERE projeto_id = ? ORDER BY ordem ASC)

**Checkpoint**: Endpoint de detalhe funcional — base para inicialização do formulário de edição.

---

## Phase 3: User Story 1 — Adicionar e editar notas em um projeto (Priority: P1) 🎯 MVP

**Goal**: O editor Quill aparece na ficha de edição de projetos. Notas são persistidas e carregadas corretamente.

**Independent Test**: Abrir edição de um projeto → digitar texto formatado no editor → Salvar → Fechar → Reabrir → verificar que notas persistem com formatação correta. Salvar com editor vazio → reabrir → editor vazio sem erros.

### Backend

- [x] T004 [US1] Atualizar `fetchProjectById` em `src/routes/projects.js` para incluir `notas` no SELECT (necessário para que POST/PUT retornem notas no objeto de resposta)
- [x] T005 [US1] Estender `POST /api/projects` em `src/routes/projects.js`: extrair `notas = body.notas ?? null` do body e incluir no INSERT (`INSERT INTO projeto (nome, ativo, notas)`)
- [x] T006 [US1] Estender `PUT /api/projects/:id` em `src/routes/projects.js`: extrair `notas = body.notas ?? null` e incluir no UPDATE (`UPDATE projeto SET nome=?, ativo=?, notas=?`)

### Frontend — Estado e lógica (`public/assets/app.js`)

- [x] T007 [P] [US1] Adicionar variável de módulo `let _quillProjectEditor = null` e método `loadProjectNotasIntoQuill(quill, notas)` em `public/assets/app.js` (mesmo padrão de `loadNotasIntoQuill` existente)
- [x] T008 [US1] Adicionar `notas: ''` ao `projectForm`; atualizar o caminho de edição (`editProject` / `openProjectForm` com projeto existente) para chamar `GET /api/projects/:id/detail` e inicializar `_quillProjectEditor` no elemento `#quill-project-editor` em `public/assets/app.js`
- [x] T009 [US1] Atualizar `saveProject()` em `public/assets/app.js` para ler o delta Quill de `_quillProjectEditor` e incluir `notas` no payload do PUT/POST (mesmo padrão do `notasPayload` nas reuniões)

### Frontend — HTML (`public/index.html`)

- [x] T010 [US1] Adicionar seção de notas com container `#quill-project-editor` (e wrapper div com altura fixa, mesmo padrão do `#quill-editor-wrapper`) ao modal de edição de projetos em `public/index.html`

**Checkpoint**: US1 completamente funcional — notas de projetos operando de ponta a ponta.

---

## Phase 4: User Story 2 — Adicionar e remover links em um projeto (Priority: P2)

**Goal**: O usuário pode adicionar, visualizar e remover links na ficha de edição de projetos. Links persistem entre sessões.

**Independent Test**: Abrir edição de um projeto → adicionar dois links (um com nome, um só com URL) → Salvar → Fechar → Reabrir → verificar que ambos aparecem e são clicáveis. Remover um → Salvar → verificar que apenas o restante persiste. Verificar que o botão Adicionar fica desabilitado com URL vazia.

### Backend

- [x] T011 [US2] Estender `POST /api/projects` em `src/routes/projects.js`: após INSERT projeto, fazer loop `INSERT IGNORE INTO projeto_link (projeto_id, nome, url, ordem)` para cada link válido do array `body.links` (filtro: `l.url?.trim()` — nome pode ser null/vazio)
- [x] T012 [US2] Estender `PUT /api/projects/:id` em `src/routes/projects.js`: antes dos INSERTs de links, executar `DELETE FROM projeto_link WHERE projeto_id = ?`; depois loop INSERT links (mesmo padrão do POST)

### Frontend — Estado e lógica (`public/assets/app.js`)

- [x] T013 [P] [US2] Adicionar estado `projectLinks: []`, `projectLinkNome: ''`, `projectLinkUrl: ''` e métodos `addProjectLink()` (push + clear) e `removeProjectLink(index)` (splice) em `public/assets/app.js`
- [x] T014 [US2] Atualizar o caminho de edição em `public/assets/app.js` para popular `projectLinks` a partir do campo `links` retornado pelo `GET /api/projects/:id/detail` (chamado em T008); também limpar `projectLinks` no caminho de novo projeto (depende de T008)
- [x] T015 [US2] Atualizar `saveProject()` em `public/assets/app.js` para incluir `links: this.projectLinks.map(l => ({ nome: l.nome || null, url: l.url }))` no payload (depende de T009)

### Frontend — HTML (`public/index.html`)

- [x] T016 [US2] Adicionar seção de links ao modal de edição de projetos em `public/index.html`: campo URL (`x-model="projectLinkUrl"`), campo Nome opcional (`x-model="projectLinkNome"`), botão Adicionar (`:disabled="!projectLinkUrl.trim()"` + `@click="addProjectLink()"`), lista de links com `x-for` mostrando nome ou URL + botão remover (depende de T010 — mesmo modal)

**Checkpoint**: US1 + US2 funcionais — notas e links de projetos operando de ponta a ponta.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Limpeza de estado, consistência e merge final.

- [x] T017 [P] Atualizar `closeProjectForm()` (ou equivalente de reset do formulário) em `public/assets/app.js` para limpar `projectLinks`, `projectLinkNome`, `projectLinkUrl` e resetar `_quillProjectEditor = null` ao fechar o modal
- [ ] T018 Smoke test manual: executar todos os acceptance scenarios das 2 user stories + edge cases do quickstart.md
- [ ] T019 Merge da branch `010-project-notes-links` no `main` e delete da branch

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependências — iniciar imediatamente
- **Phase 2 (Foundational)**: Depende de Phase 1 — **bloqueia** todas as user stories
- **Phase 3 (US1)**: Depende de Phase 2
- **Phase 4 (US2)**: Depende de Phase 3 (T014 depende de T008; T015 depende de T009; T016 depende de T010)
- **Phase 5 (Polish)**: Depende de Phase 3+4

### Within-Story Dependencies

- T008 → T009 (Quill inicializado antes de ler delta no save)
- T007 pode rodar em paralelo com T008 (arquivo mesmo, mas loadProjectNotasIntoQuill é helper independente)
- T008 → T014 (editProject já chama detail endpoint; T014 apenas adiciona o populate de links)
- T009 → T015 (saveProject já salva notas; T015 adiciona links ao mesmo payload)
- T010 → T016 (links section adicionada ao mesmo modal após editor Quill)

### Parallel Opportunities

- T001 e T002 (Phase 1): arquivos diferentes — paralelos
- T004, T005, T006 (US1 backend) podem rodar juntos se tratados com cuidado (mesmo arquivo `projects.js`)
- T007 e T013 são adições de estado independentes em `app.js` — podem ser feitas juntas

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001, T002)
2. Completar Phase 2: Foundational (T003)
3. Completar Phase 3: User Story 1 (T004–T010)
4. **STOP e VALIDAR**: notas funcionando de ponta a ponta
5. Continuar com US2

### Incremental Delivery

1. Setup + Foundational → infraestrutura pronta
2. US1 completa → editor Quill funcional em projetos (MVP!)
3. US2 completa → links adicionados
4. Polish → smoke test + merge
