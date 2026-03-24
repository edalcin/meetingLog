# Tasks: Menu Manutenção — Substituição de Projetos em Reuniões

**Input**: Design documents from `/specs/009-maintenance-project-replace/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Tests**: Não solicitados — validação manual via smoke test na fase final.

**Organization**: Tarefas agrupadas por user story para entrega independente e incremental.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: A qual user story a tarefa pertence (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Criar os arquivos novos e conectar a nova rota ao servidor — base obrigatória para ambas as user stories.

- [x] T001 Criar `src/routes/maintenance.js` com Hono router skeleton (sem lógica, apenas `export default maintenance`)
- [x] T002 Registrar `maintenanceRouter` em `src/server.js`: `import` + `app.route('/api/maintenance', maintenanceRouter)`
- [x] T003 Adicionar botão da aba "Manutenção" na navegação principal em `public/index.html` (mesmo padrão visual dos botões Reuniões/Participantes/Projetos/Instituições)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estado Alpine.js base + shell da seção de Manutenção no HTML — necessários antes de qualquer user story.

**⚠️ CRITICAL**: Nenhuma user story pode ser iniciada antes que esta fase esteja completa.

- [x] T004 Adicionar variáveis de estado para manutenção em `public/assets/app.js`
- [x] T005 [P] Adicionar computed `filteredMaintFromProjects` em `public/assets/app.js`
- [x] T006 [P] Adicionar computed `filteredMaintToProjects` em `public/assets/app.js`
- [x] T007 Adicionar seção Manutenção em `public/index.html` com card "Substituição de Projetos"

**Checkpoint**: Aba Manutenção visível no nav, card exibido ao clicar — sem funcionalidade ainda.

---

## Phase 3: User Story 1 — Substituir projeto existente por outro existente (Priority: P1) 🎯 MVP

**Goal**: O usuário seleciona dois projetos existentes (DE e PARA), simula o impacto (dry run com lista de reuniões afetadas com data + participantes), e confirma a substituição atômica.

**Independent Test**: Com reuniões vinculadas ao projeto A:
1. Abrir Manutenção → selecionar projeto A em DE e projeto B em PARA
2. Clicar "Simular" → verificar lista de reuniões com data e participantes + contagem correta
3. Clicar "Confirmar" → verificar mensagem de sucesso + form resetado
4. Verificar no banco que reuniões agora referenciam B (não A)
5. Verificar que reunião que já tinha B não criou duplicata

### Backend

- [x] T008 [US1] Implementar query de dry run em `src/routes/maintenance.js`
- [x] T009 [US1] Implementar execução atômica em `src/routes/maintenance.js`
- [x] T010 [US1] Adicionar validações em `src/routes/maintenance.js`

### Frontend

- [x] T011 [P] [US1] Adicionar campo DE (seletor do projeto de origem) em `public/index.html`
- [x] T012 [P] [US1] Adicionar campo PARA (seletor do projeto de destino) em `public/index.html`
- [x] T013 [US1] Adicionar validação visual em `public/index.html`
- [x] T014 [US1] Adicionar área de resultados do dry run em `public/index.html`
- [x] T015 [US1] Implementar método `maintSimulate()` em `public/assets/app.js`
- [x] T016 [US1] Implementar método `maintConfirm()` em `public/assets/app.js`

**Checkpoint**: US1 completamente funcional — substituição entre projetos existentes opera de ponta a ponta.

---

## Phase 4: User Story 2 — Substituir por projeto novo (a criar) (Priority: P2)

**Goal**: Quando o usuário digita um nome inexistente no campo PARA, o sistema oferece "Criar projeto '[nome]'". Após criar, o campo PARA é preenchido e o fluxo continua normalmente.

**Independent Test**:
1. Selecionar qualquer projeto em DE
2. Digitar um nome inexistente em PARA → verificar que aparece a opção "Criar projeto '[nome]'"
3. Clicar na opção → verificar que o projeto é criado e selecionado automaticamente em PARA
4. Executar dry run e confirmar → verificar que as reuniões foram atualizadas para o novo projeto

### Frontend

- [x] T017 [US2] Adicionar opção "Criar projeto '[nome]'" no dropdown PARA em `public/index.html`
- [x] T018 [US2] Implementar método `maintCreateProject(nome)` em `public/assets/app.js`

**Checkpoint**: US1 + US2 funcionais — fluxo completo incluindo criação inline de projeto.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Qualidade visual, consistência e volta ao main.

- [x] T019 [P] Consistência visual verificada em `public/index.html`
- [x] T020 [P] `loadProjects()` chamado ao acessar aba Manutenção em `public/assets/app.js`
- [ ] T021 Smoke test manual: executar todos os cenários de aceitação das 2 user stories + edge cases
- [ ] T022 Merge da branch `009-maintenance-project-replace` no `main` e delete da branch

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependências — iniciar imediatamente
- **Phase 2 (Foundational)**: Depende de Phase 1 — **bloqueia** todas as user stories
- **Phase 3 (US1)**: Depende de Phase 2
- **Phase 4 (US2)**: Depende de Phase 3
- **Phase 5 (Polish)**: Depende de Phase 3+4
