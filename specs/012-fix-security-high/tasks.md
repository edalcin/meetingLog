# Tasks: Correção das Vulnerabilidades de Alta Prioridade

**Input**: Design documents from `/specs/012-fix-security-high/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ quickstart.md ✅

**Tests**: Não solicitados — verificação manual via quickstart.md.

**Organization**: Tarefas agrupadas por user story. Cada story pode ser implementada, testada e deployada de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode executar em paralelo (arquivos diferentes, sem dependências entre si)
- **[Story]**: User story correspondente (US1–US4)

---

## Phase 1: Setup

**Purpose**: Sem setup necessário — projeto existente, nenhum arquivo novo a criar para esta feature.

*(Fase vazia — prosseguir diretamente para as user stories)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Sem dependências cruzadas entre as 4 stories. Todas as stories tocam arquivos diferentes, exceto US1 e US3 que ambas modificam `src/server.js` — por isso US1 deve ser concluída antes de US3.

**Ordem obrigatória**: US1 → US3 (mesmo arquivo `src/server.js`). US2 e US4 são totalmente independentes entre si e das outras.

*(Fase vazia — constraints documentados acima)*

---

## Phase 3: User Story 1 — Rate Limiting no PIN (Priority: P1) 🎯 MVP

**Goal**: Bloquear ataques de força bruta ao endpoint de autenticação por PIN após 5 tentativas erradas do mesmo IP, com bloqueio de 15 minutos. Usar comparação timing-safe.

**Independent Test**: Disparar 6 POSTs seguidos para `/api/auth/check` com PIN errado e verificar que a 6ª retorna HTTP 429. Verificar que autenticação correta reseta o contador.

### Implementation

- [x] T001 [US1] Adicionar `import { timingSafeEqual } from 'node:crypto'` e o Map `authAttempts` com constantes `AUTH_MAX=5` e `AUTH_LOCK_MS=900000` no topo de `src/server.js` (antes do handler de auth)

- [x] T002 [US1] Substituir o handler `app.post('/api/auth/check', ...)` em `src/server.js` (linhas 42–46) pelo novo handler com: extração de IP via `x-forwarded-for` / socket, verificação de bloqueio ativo (retorna 429 com `{ok:false}`), comparação timing-safe via `timingSafeEqual(pinBuf, appBuf)`, incremento de contador em falha e reset em sucesso

**Checkpoint US1**: `curl -X POST /api/auth/check` com PIN errado 5 vezes → 6ª tentativa retorna HTTP 429. PIN correto após reset → HTTP 200 `{ok:true}`.

---

## Phase 4: User Story 2 — Bloqueio de Links Maliciosos (Priority: P2)

**Goal**: Validar protocolo de URLs nos campos de link de reuniões e projetos. Links com protocolo inválido (`javascript:`, `ftp:`, `data:`, etc.) são descartados com aviso; links válidos (`http:`/`https:`) são salvos normalmente.

**Independent Test**: Salvar reunião com link `javascript:alert(1)` → link descartado, resposta inclui `rejected_urls`. Clicar em link legado com `javascript:` na UI → `href="#"`, sem execução de código.

### Implementation — Backend

- [x] T003 [P] [US2] Adicionar função `isAllowedUrl(url)` (usando `new URL()` + verificação de `protocol`) e atualizar os dois `validLinks` filters (POST create + PUT update) em `src/routes/meetings.js` para separar `validLinks` de `rejectedUrls`; incluir `rejected_urls: rejectedUrls` no body das respostas de sucesso (ambos handlers)

- [x] T004 [P] [US2] Adicionar função `isAllowedUrl(url)` e atualizar os dois `validLinks` filters (POST create + PUT update) em `src/routes/projects.js` para separar `validLinks` de `rejectedUrls`; incluir `rejected_urls: rejectedUrls` no body das respostas de sucesso (ambos handlers)

### Implementation — Frontend

- [x] T005 [P] [US2] Adicionar método `safeUrl(url)` ao objeto Alpine em `public/assets/app.js` (retorna a URL original se protocolo for `http:`/`https:`, retorna `'#'` caso contrário); atualizar `printMeetingInfo()` para usar `this.safeUrl(l.url)` no lugar de `esc(l.url)` na geração do `href`

- [x] T006 [P] [US2] Substituir todas as 4 ocorrências de `:href="link.url"` / `:href="l.url"` em `public/index.html` por `:href="safeUrl(link.url)"` / `:href="safeUrl(l.url)"` (linhas 1283, 1627, 1974, 2089)

- [x] T007 [US2] Nos métodos de salvar reunião (`saveMeeting` ou equivalente) e salvar projeto em `public/assets/app.js`, verificar se a resposta contém `rejected_urls` com itens e, se sim, exibir aviso visível ao usuário (ex.: `alert()` ou notificação inline) listando as URLs descartadas

**Checkpoint US2**: Salvar reunião/projeto com mix de URLs válidas e inválidas → válidas salvas, inválidas descartadas com aviso na UI. Clicar em link legado malicioso → sem execução de JavaScript.

---

## Phase 5: User Story 3 — Cabeçalhos de Segurança HTTP (Priority: P3)

**Goal**: Todas as respostas HTTP da aplicação incluem cabeçalhos `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Content-Security-Policy`.

**Independent Test**: `curl -I http://localhost:3000/` exibe os 5 cabeçalhos de segurança. A aplicação continua funcionando normalmente (CDNs carregam, uploads funcionam).

**⚠️ Dependência**: Deve ser implementada APÓS US1 (T001–T002), pois ambas modificam `src/server.js`.

### Implementation

- [x] T008 [US3] Adicionar middleware de segurança `app.use('*', async (c, next) => { await next(); c.header(...) })` em `src/server.js` ANTES de `app.get('/api/health', ...)` com os cabeçalhos: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, e `Content-Security-Policy` com diretivas para `cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `'unsafe-inline'`, `img-src 'self' data: blob:`, `connect-src 'self'`, `frame-ancestors 'none'`

**Checkpoint US3**: `curl -I http://localhost:3000/` retorna todos os 5 cabeçalhos. Abrir a aplicação no navegador → sem erros de CSP no console, todas as CDNs carregam.

---

## Phase 6: User Story 4 — Container Docker Não-Root (Priority: P4)

**Goal**: O processo Node.js dentro do container roda como usuário não-privilegiado (`appuser`). O entrypoint corrige automaticamente permissões dos diretórios de dados ao iniciar.

**Independent Test**: `docker exec <id> whoami` retorna `appuser`. Upload de arquivo e geração de thumbnail funcionam normalmente.

### Implementation

- [x] T009 [P] [US4] Modificar `Dockerfile` (stage runner): adicionar `su-exec` ao `apk add --no-cache` e incluir `RUN addgroup -S appgroup && adduser -S appuser -G appgroup` após o `WORKDIR /app` (sem adicionar `USER appuser` — o su-exec faz a troca no runtime)

- [x] T010 [P] [US4] Modificar `docker-entrypoint.sh`: adicionar bloco de correção de permissões (`chown -R appuser:appgroup "$FILES_PATH"`) após o `set -e` e antes do wait de MariaDB; substituir a linha final `exec node src/server.js` por `exec su-exec appuser node src/server.js`

**Checkpoint US4**: Build da imagem Docker + start do container → `docker exec whoami` = `appuser`. Aplicação funciona normalmente (uploads, thumbnails, API).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificação final integrada de todas as 4 stories em conjunto.

- [ ] T011 [P] Executar verificações do `specs/012-fix-security-high/quickstart.md` (verificação manual pós-deploy): H1 (curl -I), H2 (brute-force loop), H3 (link javascript: via UI), H4 (docker exec whoami)

- [ ] T012 Verificar que nenhuma funcionalidade existente foi quebrada: criar reunião com links legítimos, fazer upload de arquivo, gerar thumbnail de PDF, acessar todas as telas

- [x] T013 Fazer merge do branch `012-fix-security-high` no `main` e deletar o branch antes do push (conforme Constitution VI)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 3 (US1)**: Sem dependências — pode começar imediatamente
- **Phase 4 (US2)**: Sem dependências — pode começar em paralelo com US1
- **Phase 5 (US3)**: **Depende de Phase 3 (US1)** — ambas modificam `src/server.js`
- **Phase 6 (US4)**: Sem dependências — pode rodar em paralelo com qualquer outra story
- **Phase 7 (Polish)**: Depende de todas as phases anteriores

### User Story Dependencies

- **US1 (P1)**: Independente — começar aqui
- **US2 (P2)**: Independente de US1 — pode começar em paralelo
- **US3 (P3)**: Depende de US1 (mesmo arquivo `src/server.js`) — aguardar T001–T002
- **US4 (P4)**: Independente de todas — pode ser feita em qualquer momento

### Within Each User Story

- US1: T001 → T002 (sequencial — mesmo arquivo)
- US2: T003 ∥ T004 → T005 ∥ T006 → T007
- US3: T008 (único task)
- US4: T009 ∥ T010 (arquivos diferentes — paralelos)

### Parallel Opportunities

- T003 (meetings.js) ∥ T004 (projects.js) — arquivos distintos
- T005 (app.js safeUrl) ∥ T006 (index.html hrefs) — arquivos distintos
- T009 (Dockerfile) ∥ T010 (docker-entrypoint.sh) — arquivos distintos
- T011 (verificações) ∥ T012 (smoke test) — independentes

---

## Parallel Example: User Story 2

```
# Batch 1 — Backend (paralelo):
T003: "Add isAllowedUrl() + update validLinks in src/routes/meetings.js"
T004: "Add isAllowedUrl() + update validLinks in src/routes/projects.js"

# Batch 2 — Frontend (paralelo, após ou durante Batch 1):
T005: "Add safeUrl() helper + fix printMeetingInfo() in public/assets/app.js"
T006: "Replace :href bindings in public/index.html (4 occurrences)"

# Batch 3 — UI warning (após T005):
T007: "Display rejected_urls warning in save methods in public/assets/app.js"
```

---

## Implementation Strategy

### MVP First (US1 Only — 2 tasks)

1. Completar Phase 3: T001 → T002
2. **STOP e VALIDAR**: testar brute-force bloqueado após 5 tentativas
3. Deploy se aprovado — H2 já está corrigido em produção

### Incremental Delivery

1. US1 (T001–T002) → deploy → H2 corrigido ✓
2. US2 (T003–T007) → deploy → H3 corrigido ✓
3. US3 (T008) → deploy → H1 corrigido ✓
4. US4 (T009–T010) → deploy → H4 corrigido ✓
5. Cada deploy é independente e não quebra o anterior

### Ordem Recomendada para Desenvolvedor Solo

```
T001 → T002 (US1, server.js auth)
T003 → T004 (US2 backend, paralelo em sessões diferentes)
T005 → T006 (US2 frontend, paralelo em sessões diferentes)
T007       (US2 warning)
T008       (US3, server.js middleware — após US1)
T009 → T010 (US4, Docker)
T011 → T012 → T013 (Polish)
```

---

## Notes

- Sem migrations SQL — nenhuma alteração de schema
- Sem novas dependências npm — `node:crypto` é built-in, `su-exec` é pacote Alpine
- [P] tasks = arquivos diferentes, sem dependências entre si
- US3 NÃO pode ser implementada antes de US1 (mesmo arquivo `src/server.js`)
- Após T013: deletar branch `012-fix-security-high` e garantir que está no `main`
