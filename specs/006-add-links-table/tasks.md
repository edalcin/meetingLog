# Tasks: Adicionar Tabela de Links às Reuniões

**Input**: Design documents from `/specs/006-add-links-table/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅ | quickstart.md ✅

**Tests**: Não solicitados — aplicação single-user sem suite automatizada.

**Organization**: Tasks organizadas por user story para entrega incremental independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: User Story correspondente (US1–US5)

---

## Phase 1: Setup — Migration SQL e Script de Dados

**Purpose**: Criar os artefatos de infraestrutura que BLOQUEIAM todas as user stories.

**⚠️ CRÍTICO**: Concluir esta fase antes de qualquer implementação de user story.

- [x] T001 Criar `migrations/010_add_link.sql` com `CREATE TABLE IF NOT EXISTS link (id INT UNSIGNED PK AUTO_INCREMENT, reuniao_id INT UNSIGNED NOT NULL FK→reuniao.id CASCADE, nome VARCHAR(500) NOT NULL, url VARCHAR(2048) NOT NULL, ordem SMALLINT UNSIGNED NOT NULL DEFAULT 0, criado_em DATETIME NOT NULL DEFAULT NOW(), UNIQUE KEY uq_link(reuniao_id, url(500)), KEY idx_link_reuniao_ordem(reuniao_id, ordem)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` — ver data-model.md para DDL completo
- [x] T002 [P] Criar `docs/source/scripts/migrate-links.js` — script Node.js ES module que: (1) lê `docs/source/memoriaReunioes-DocsRelacionados.csv` (separador `;`); (2) aplica regex `/^\[(.+?)\]\s+(.+)$/` ao campo `linkDoc`; (3) converte data BRT `DD/MM/YYYY HH:MM` para UTC (+3h); (4) busca `reuniao.id` por `data_hora`; (5) executa `INSERT IGNORE INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)`; (6) loga skips e exibe resumo final — usar credenciais via `process.env.DB_*`

**Checkpoint**: Arquivos T001 e T002 criados. Aplicar migration no banco antes de continuar:
```bash
npm run migrate   # aplica 010_add_link.sql
DB_HOST=... DB_PASSWORD=... node docs/source/scripts/migrate-links.js
```

---

## Phase 2: Foundational — Backend API (meetings.js)

**Purpose**: Estender `src/routes/meetings.js` para suportar links. BLOQUEIA todas as user stories de frontend.

**⚠️ CRÍTICO**: Concluir antes de qualquer tarefa de frontend.

- [x] T003 Estender `GET /api/meetings/:id` em `src/routes/meetings.js` — adicionar query `SELECT id, nome, url, ordem FROM link WHERE reuniao_id = ? ORDER BY ordem ASC` e incluir resultado como `links: []` no response JSON (após `pautas`)
- [x] T004 Estender `POST /api/meetings` em `src/routes/meetings.js` — dentro da transação existente, após inserir pautas: iterar `body.links || []`, filtrar itens com `nome.trim()` e `url.trim()` não vazios, executar `INSERT INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)` para cada um (índice como `ordem`)
- [x] T005 Estender `PUT /api/meetings/:id` em `src/routes/meetings.js` — dentro da transação existente, após substituir pautas: executar `DELETE FROM link WHERE reuniao_id = ?`, depois reinserir todos os links de `body.links` com a mesma lógica do T004

**Checkpoint**: Com os endpoints prontos, chamar `GET /api/meetings/:id` e confirmar que `links: []` aparece no response. Testar `PUT` com `links: [{nome:"Teste", url:"https://example.com"}]` e verificar persistência.

---

## Phase 3: User Stories 1 & 2 — Visualizar e Adicionar Links no Formulário (Priority: P1) 🎯 MVP

**Goal**: O formulário de criação e edição de reuniões exibe a lista de links e permite adicionar novos links (nome + URL), persistindo ao salvar.

**Independent Test**: Criar uma nova reunião, adicionar dois links no card, salvar, reabrir o formulário de edição e verificar que ambos os links aparecem com nome e URL clicáveis.

- [x] T006 [US1] Adicionar estado Alpine.js para links em `public/assets/app.js` — no objeto `data()`: `links: []` (array de `{id, nome, url, ordem}` da reunião atual), `novoLinkNome: ''`, `novoLinkUrl: ''`
- [x] T007 [P] [US1] Implementar método `addLink()` em `public/assets/app.js` — validar que `novoLinkNome.trim()` e `novoLinkUrl.trim()` não estão vazios; fazer push de `{nome: novoLinkNome.trim(), url: novoLinkUrl.trim()}` em `this.links`; limpar `novoLinkNome` e `novoLinkUrl`
- [x] T008 [P] [US1] Implementar método `removeLink(idx)` em `public/assets/app.js` — `this.links.splice(idx, 1)`
- [x] T009 [US1] Carregar links ao editar reunião em `public/assets/app.js` — em `editMeeting(m)`, após receber `full` da API, atribuir `this.links = (full.links || []).map(l => ({...l}))` (cópia para evitar mutação do cache)
- [x] T010 [US1] Resetar links ao criar nova reunião em `public/assets/app.js` — em `newMeeting()`, atribuir `this.links = []`, `this.novoLinkNome = ''`, `this.novoLinkUrl = ''`
- [x] T011 [US2] Incluir links no payload de `saveMeeting()` em `public/assets/app.js` — adicionar `links: this.links.map(l => ({nome: l.nome, url: l.url}))` no objeto `payload` enviado via POST/PUT
- [x] T012 [US1] Adicionar card de links no formulário de reunião em `public/index.html` — logo após o card de pautas existente, seguindo o mesmo padrão visual (Tailwind): seção com título "Links", lista `x-for="(link, idx) in links"` exibindo `<a :href="link.url" target="_blank" x-text="link.nome">` e botão de remover por item; linha de entrada com dois campos `<input x-model="novoLinkNome" placeholder="Nome">` e `<input x-model="novoLinkUrl" placeholder="URL">` e botão "+" que chama `addLink()` (desabilitado se nome ou url vazios)
- [x] T013 [US1] Resetar `novoLinkNome` e `novoLinkUrl` em `cancelForm()` em `public/assets/app.js`

**Checkpoint**: Formulário de reunião exibe card de links. Adicionar dois links, salvar, reabrir e confirmar persistência. Clicar nos links e confirmar que abrem em nova aba.

---

## Phase 4: User Story 3 — Remover Link (Priority: P2)

**Goal**: O usuário pode remover um link individual da lista no formulário antes de salvar.

**Independent Test**: Editar uma reunião com dois links, clicar no botão de remoção do primeiro, salvar e confirmar que apenas o segundo persiste.

> **Nota**: O método `removeLink(idx)` já foi implementado em T008 (Phase 3). Esta fase valida a integração visual e o comportamento ao salvar.

- [x] T014 [US3] Verificar que o botão de remoção no card de links em `public/index.html` (adicionado em T012) chama `removeLink(idx)` corretamente e que o item desaparece imediatamente da lista sem reload
- [x] T015 [US3] Verificar que a remoção é persistida: após `removeLink(idx)` e `saveMeeting()`, confirmar via `GET /api/meetings/:id` que o link removido não existe mais no banco

**Checkpoint**: Remoção de link funciona no formulário e persiste ao salvar.

---

## Phase 5: User Story 4 — Painel de Detalhes (Somente-leitura) (Priority: P2)

**Goal**: O painel de visualização detalhada da reunião exibe os links como lista clicável em modo somente-leitura.

**Independent Test**: Abrir o painel de detalhes de uma reunião com links migrados e verificar que os links aparecem como âncoras clicáveis que abrem em nova aba.

- [x] T016 [US4] Adicionar seção de links no painel de detalhes em `public/index.html` — no modal/painel `openMeetingInfo`, após a seção de pautas existente: lista `x-for="link in meetingInfo.links || []"` com `<a :href="link.url" target="_blank" x-text="link.nome">` em nova linha; ocultar seção se `meetingInfo.links?.length === 0`
- [x] T017 [US4] Verificar que `openMeetingInfo()` em `public/assets/app.js` já inclui `links` no `meetingInfo` após o T003 (GET /:id já retorna links) — nenhuma alteração adicional necessária ao método, apenas confirmar que `meetingInfo.links` existe

**Checkpoint**: Painel de detalhes exibe lista de links clicáveis. Clicar em cada link e confirmar abertura em nova aba.

---

## Phase 6: User Story 5 — Editar Link Existente (Priority: P3)

**Goal**: O usuário pode editar o nome ou a URL de um link já na lista, sem remover e adicionar novamente.

**Independent Test**: Editar o nome de um link existente no card, salvar a reunião e verificar que o novo nome persiste.

- [x] T018 [US5] Adicionar campo `editando: false` aos objetos link no estado Alpine.js em `public/assets/app.js` — em `editMeeting()`, ao atribuir `this.links`, mapear para `[...l, editando: false]`; em `addLink()`, incluir `editando: false` no objeto pushado
- [x] T019 [US5] Implementar toggle de edição em `public/assets/app.js` — método `toggleEditLink(idx)`: `this.links[idx].editando = !this.links[idx].editando`
- [x] T020 [US5] Adicionar modo de edição inline ao item de link em `public/index.html` — no `x-for` do card de links: exibir campos `<input x-model="link.nome">` e `<input x-model="link.url">` quando `link.editando === true`; exibir `<a>` clicável e botão de editar quando `link.editando === false`; botão para confirmar edição (`toggleEditLink(idx)`)

**Checkpoint**: Editar nome e URL de um link existente, salvar e reabrir para confirmar persistência.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Validação final e ajustes transversais.

- [x] T021 [P] Validar sequência completa do quickstart.md: migration aplicada, script rodado, dados visíveis no formulário de edição de reuniões históricas
- [x] T022 [P] Verificar idempotência: rodar `migrate-links.js` uma segunda vez e confirmar que `SELECT COUNT(*) FROM link` retorna o mesmo valor
- [x] T023 Resetar `links: []` em `cancelForm()` em `public/assets/app.js` (já coberto por T013 para os campos de input — confirmar que o array `links` também é resetado)
- [x] T024 [P] Verificar comportamento com reunião sem links: formulário de edição exibe card vazio, painel de detalhes oculta a seção (ou exibe "Nenhum link cadastrado")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependências — iniciar imediatamente
- **Phase 2 (Foundational)**: Depende da migration aplicada (T001 + `npm run migrate`) — BLOQUEIA todas as user stories
- **Phase 3 (US1+US2)**: Depende de Phase 2 completa
- **Phase 4 (US3)**: Depende de Phase 3 (usa `removeLink` implementado em T008)
- **Phase 5 (US4)**: Depende de Phase 2 (GET /:id já retorna links via T003)
- **Phase 6 (US5)**: Depende de Phase 3 (estado `links[]` e UI do card já existem)
- **Phase 7 (Polish)**: Depende de todas as fases anteriores desejadas

### User Story Dependencies

- **US1+US2 (P1)**: Pode iniciar após Phase 2 — sem dependência de outras US
- **US3 (P2)**: `removeLink()` já implementado em US1+US2; fase valida integração
- **US4 (P2)**: Pode iniciar após Phase 2 (independente de US1+US2)
- **US5 (P3)**: Depende de US1+US2 (estado `links[]` e card existentes)

### Parallel Opportunities

- T001 e T002 podem rodar em paralelo (arquivos diferentes)
- T003, T004, T005 são sequenciais no mesmo arquivo (`meetings.js`)
- T006, T007, T008 podem rodar em paralelo (métodos independentes em `app.js`)
- T016 e T017 podem rodar em paralelo

---

## Parallel Example: Phase 3 (US1+US2)

```
Parallel batch 1 (diferentes métodos em app.js):
  T006 — adicionar estado links[], novoLinkNome, novoLinkUrl
  T007 — implementar addLink()
  T008 — implementar removeLink(idx)

Sequential após batch 1:
  T009 — carregar links em editMeeting()
  T010 — resetar links em newMeeting()
  T011 — incluir links em saveMeeting()
  T012 — card de links em index.html
  T013 — resetar campos em cancelForm()
```

---

## Implementation Strategy

### MVP (User Stories 1+2 apenas)

1. Completar Phase 1: criar migration + script de dados
2. Aplicar migration e rodar script de dados no banco
3. Completar Phase 2: estender meetings.js (T003, T004, T005)
4. Completar Phase 3: card de links no formulário (T006–T013)
5. **PARAR e VALIDAR**: criar reunião com links, editar, confirmar persistência e links clicáveis
6. Deploy se pronto

### Entrega Incremental

1. Phase 1 + 2 → Backend pronto
2. Phase 3 → Formulário funcional (MVP!)
3. Phase 4 → Remoção validada
4. Phase 5 → Painel de detalhes
5. Phase 6 → Edição inline
6. Phase 7 → Polish

---

## Notes

- [P] = arquivo diferente, sem dependência incompleta — pode rodar em paralelo
- `meetings.js` é modificado sequencialmente (T003 → T004 → T005) — mesmo arquivo
- `app.js` recebe múltiplas adições — organizar por método para commits atômicos
- `index.html` recebe adições no formulário (T012) e no painel de detalhes (T016) — seções independentes
- Script `migrate-links.js` fica em `docs/source/scripts/` — nunca commitado no repo
- Após cada fase, fazer commit no `main`
