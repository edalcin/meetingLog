# Tasks: Adicionar Tabela de Pauta às Reuniões

**Input**: Design documents from `specs/004-.../`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅ | quickstart.md ✅

**Tests**: Não solicitados. Verificação por checklist manual (quickstart.md).

**Organization**: Tasks agrupadas por user story para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência de task incompleta)
- **[Story]**: User story à qual a task pertence (US1, US2, US3, US4)

---

## Phase 1: Setup (Migration e Script de Dados)

**Purpose**: Criar a tabela `pauta` no banco e importar os dados históricos do CSV.

**⚠️ CRÍTICO**: Seguir a sequência T001 → T002 → T003 → T004 nesta ordem. Não pular T002 antes de T004.

- [X] T001 Criar migration `migrations/008_add_pauta.sql` com CREATE TABLE pauta (conforme data-model.md): campos id, reuniao_id, texto VARCHAR(1000), ordem SMALLINT, criado_em; UNIQUE KEY uq_pauta(reuniao_id, texto(500)); FK → reuniao.id ON DELETE CASCADE
- [X] T002 Aplicar migration no banco de produção: `npm run migrate` (aplica apenas 008_add_pauta.sql; verificar com `SHOW TABLES LIKE 'pauta'` e `DESCRIBE pauta`)
- [X] T003 [P] Criar script `docs/source/scripts/migrate-pautas.js` com: conexão root ao MariaDB (DB_HOST:3333/reunioes), leitura do CSV `docs/source/memoriaReunioes-Pauta.csv` (separador `;`), normalização de timezone (-03:00 → UTC), lookup de reuniao_id via `DATE_FORMAT(data_hora,'%Y-%m-%dT%H:%i:%s')`, INSERT IGNORE INTO pauta(reuniao_id, texto, ordem), log de registros ignorados e resumo final
- [X] T004 Executar script de migração: `node docs/source/scripts/migrate-pautas.js` e verificar com `SELECT COUNT(*) FROM pauta` e amostra de 20 registros

**Checkpoint**: Tabela `pauta` criada e populada com dados históricos. Verificar idempotência executando T004 uma segunda vez (contagem não deve mudar).

---

## Phase 2: Foundational (Backend API)

**Purpose**: Modificar `src/routes/meetings.js` para suportar pautas no ciclo de load/save de reuniões.

**⚠️ CRÍTICO**: Backend deve estar pronto antes de qualquer trabalho de frontend (US1+).

- [X] T005 Adicionar endpoint `GET /api/meetings/:id` em `src/routes/meetings.js`: retorna dados completos de uma reunião pelo id, incluindo `pautas: [{id, texto, ordem}]` carregadas via `SELECT id, texto, ordem FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC`; retornar 404 se reunião não encontrada
- [X] T006 Modificar `POST /api/meetings` em `src/routes/meetings.js`: aceitar campo `pautas: string[]` no body; após INSERT da reunião, inserir cada pauta não-vazia (trim) com `INSERT INTO pauta (reuniao_id, texto, ordem)` em transação; retornar reunião criada com pautas no response
- [X] T007 Modificar `PUT /api/meetings/:id` em `src/routes/meetings.js`: aceitar campo `pautas: string[]` no body; dentro de transação, fazer `DELETE FROM pauta WHERE reuniao_id = ?` seguido de INSERT de cada pauta não-vazia com ordem = índice do array; retornar reunião atualizada com pautas

**Checkpoint**: Testar via curl ou browser:
- `GET /api/meetings/:id` retorna `pautas: [...]`
- `PUT /api/meetings/:id` com `{"pautas":["Texto A","Texto B"]}` persiste e retorna as pautas
- `PUT /api/meetings/:id` com `{"pautas":[]}` remove todas as pautas

---

## Phase 3: User Story 1 — Visualizar pautas no formulário (Priority: P1) 🎯 MVP

**Goal**: O formulário de criação/edição de reunião exibe as pautas já cadastradas em um card dedicado.

**Independent Test**: Editar uma reunião com dados históricos migrados → card de pautas mostra as pautas corretamente listadas, ordenadas, sem erros.

- [X] T008 [US1] Adicionar estado `pautas: []` e método `loadMeetingPautas(id)` (chama `GET /api/meetings/:id` e popula `this.pautas`) em `public/assets/app.js`
- [X] T009 [US1] Modificar `editMeeting(m)` em `public/assets/app.js`: após abrir o form, chamar `await this.loadMeetingPautas(m.id)` para popular `this.pautas`
- [X] T010 [US1] Modificar `openForm()` em `public/assets/app.js`: inicializar `this.pautas = []` ao criar nova reunião
- [X] T011 [US1] Modificar `cancelForm()` em `public/assets/app.js`: resetar `this.pautas = []` ao fechar/cancelar o formulário
- [X] T012 [US1] Adicionar seção card de pautas ao formulário de reunião em `public/index.html`: label "Pautas", lista de pautas existentes com `x-for="(p, i) in pautas"` exibindo `p.texto`, visível sempre (inclusive vazia na criação)

**Checkpoint**: US1 completa — abrir edição de reunião histórica e ver pautas listadas no card.

---

## Phase 4: User Story 2 — Adicionar pautas no formulário (Priority: P1)

**Goal**: O usuário pode adicionar novas pautas via campo de texto + botão "+" antes de salvar a reunião.

**Independent Test**: Criar nova reunião, adicionar duas pautas com botão "+", salvar → reabrir edição e confirmar que as duas pautas aparecem.

- [X] T013 [US2] Adicionar estado `novaPauta: ''` e método `addPauta()` em `public/assets/app.js`: `addPauta()` adiciona `{texto: this.novaPauta.trim(), ordem: this.pautas.length}` ao array `this.pautas` se texto não-vazio, depois reseta `this.novaPauta = ''`
- [X] T014 [US2] Modificar `saveMeeting()` em `public/assets/app.js`: incluir `pautas: this.pautas.map(p => p.texto)` no payload enviado ao backend (POST e PUT)
- [X] T015 [US2] Adicionar campo de texto (`x-model="novaPauta"`) e botão "+" (`@click="addPauta()"`) ao card de pautas em `public/index.html`: botão desabilitado se `novaPauta.trim()` vazio; campo reseta após adição

**Checkpoint**: US2 completa — criar reunião com duas pautas via botão "+", salvar e verificar persistência.

---

## Phase 5: User Story 3 — Remover pauta do formulário (Priority: P2)

**Goal**: O usuário pode remover uma pauta individual do card antes de salvar.

**Independent Test**: Editar reunião com duas pautas, clicar no × da primeira, salvar → reabrir e confirmar que só a segunda permanece.

- [X] T016 [US3] Adicionar método `removePauta(index)` em `public/assets/app.js`: remove o item no índice especificado do array `this.pautas` e reordena o campo `ordem`
- [X] T017 [US3] Adicionar botão × por item de pauta no card em `public/index.html`: `@click="removePauta(i)"` com classe `@mousedown.prevent` para evitar perda de foco; estilo hover vermelho consistente com os outros campos

**Checkpoint**: US3 completa — remover uma pauta e verificar que apenas as restantes são salvas.

---

## Phase 6: User Story 4 — Editar texto de pauta existente (Priority: P3)

**Goal**: O usuário pode editar o texto de uma pauta já adicionada ao card, sem precisar remover e adicionar novamente.

**Independent Test**: Editar texto de uma pauta no card, salvar → reabrir e confirmar que o novo texto foi persistido.

- [X] T018 [US4] Modificar array `pautas` em `public/assets/app.js` para suportar edição inline: cada item tem `editando: false`; adicionar método `toggleEditPauta(index)` para alternar modo de edição
- [X] T019 [US4] Modificar card de pautas em `public/index.html`: exibir `<input x-model="p.texto">` quando `p.editando === true`, `<span x-text="p.texto">` quando false; botão de lápis para ativar edição; tecla Enter ou blur confirma edição (`p.editando = false`)

**Checkpoint**: US4 completa — clicar no lápis de uma pauta, editar, salvar e verificar novo texto persiste.

---

## Phase 7: Polish & Verificação Final

**Purpose**: Verificação de integridade, idempotência e qualidade cross-cutting.

- [X] T020 Verificar idempotência do script: reexecutar `node docs/source/scripts/migrate-pautas.js` e confirmar que `SELECT COUNT(*) FROM pauta` retorna o mesmo valor
- [X] T021 [P] Verificar que pautas em branco não são salvas: submeter form com campo de pauta vazio e confirmar ausência no banco
- [X] T022 [P] Verificar cascata: excluir uma reunião e confirmar que suas pautas são removidas automaticamente (`SELECT COUNT(*) FROM pauta WHERE reuniao_id = ?`)
- [X] T023 Executar checklist completo do quickstart.md: migrate → script → verificação funcional → confirmação visual no formulário

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependências — iniciar imediatamente
- **Phase 2 (Foundational)**: Depende de T001+T002 (migration aplicada) — bloqueia todas as user stories
- **Phase 3 (US1)**: Depende de Phase 2 completa
- **Phase 4 (US2)**: Depende de Phase 3 completa (precisa do estado `pautas` inicializado)
- **Phase 5 (US3)**: Depende de Phase 4 completa (lista de pautas precisa existir para remover)
- **Phase 6 (US4)**: Depende de Phase 5 completa (item de pauta precisa existir no array)
- **Phase 7 (Polish)**: Depende de todas as user stories desejadas completas

### User Story Dependencies

- **US1**: Requer backend T005 (GET /:id com pautas) → independente das demais US
- **US2**: Requer US1 completa (estado `pautas[]` existente) + backend T006/T007 (POST/PUT com pautas)
- **US3**: Requer US2 completa (pautas adicionáveis antes de remover)
- **US4**: Requer US3 completa (item de pauta com estado no array)

### Within Each Phase

- Backend (T005, T006, T007): app.js antes de index.html; dentro de cada US, mesmo padrão
- T001 (migration SQL) → T002 (aplicar) → T003 (script) → T004 (executar)

### Parallel Opportunities

- T003 pode iniciar em paralelo com T001 (arquivos diferentes)
- Dentro de cada US: tasks de `app.js` e `index.html` são independentes
- T020, T021, T022 na fase de Polish podem rodar em paralelo

---

## Parallel Example: Phase 2 (Foundational)

```bash
# T005, T006, T007 modificam o mesmo arquivo (meetings.js) — executar sequencialmente
# Mas T003 (script CSV) pode rodar em paralelo com T001 (migration SQL):
Task: "T001 Criar migrations/008_add_pauta.sql"
Task: "T003 [P] Criar docs/source/scripts/migrate-pautas.js"
# Depois: T002 → T004 em sequência
```

---

## Implementation Strategy

### MVP (US1 + US2 — P1 apenas)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational — backend (T005-T007)
3. Complete Phase 3: US1 — visualizar (T008-T012)
4. Complete Phase 4: US2 — adicionar (T013-T015)
5. **STOP e VALIDAR**: criar reunião com pautas, salvar, reabrir → pautas visíveis ✅
6. Deploy se pronto

### Entrega Incremental Completa

1. Setup + Foundational → Base pronta
2. US1 (visualizar) → Dados históricos visíveis no formulário ✅
3. US2 (adicionar) → Novas pautas podem ser criadas ✅
4. US3 (remover) → Correção de pautas adicionadas ✅
5. US4 (editar) → Edição inline sem remover+adicionar ✅
6. Polish → Verificação de integridade e cascata ✅

---

## Notes

- [P] = arquivos diferentes, sem dependências de tasks incompletas
- Cada US é independentemente testável após sua phase completa
- `app.js` é modificado incrementalmente — cada US adiciona ao estado/métodos existentes
- `meetings.js` recebe todas as modificações de API na Phase 2 (Foundational)
- Seguir constituição: SQL parametrizado sempre; transações para operações multi-step; sem build step
- Script de migração em `docs/source/scripts/` (nunca commitar)
- Commit após cada phase ou grupo lógico de tasks
