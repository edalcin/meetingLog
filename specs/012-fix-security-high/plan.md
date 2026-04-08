# Implementation Plan: Correção das Vulnerabilidades de Alta Prioridade

**Branch**: `012-fix-security-high` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/012-fix-security-high/spec.md`

## Summary

Corrigir as 4 vulnerabilidades classificadas como "High Priority" no relatório de auditoria de segurança:
- **H1**: Adicionar middleware de cabeçalhos de segurança HTTP (CSP, X-Frame-Options, etc.)
- **H2**: Adicionar rate limiting e comparação timing-safe no endpoint de autenticação por PIN
- **H3**: Validar protocolo de URLs nos campos de link (back + front), bloqueando `javascript:` e similares
- **H4**: Fazer o container Docker rodar como usuário não-root via `su-exec`

Nenhuma migration SQL, nenhuma nova dependência npm, sem alteração de schema de banco.

---

## Technical Context

**Language/Version**: Node.js 22, ES modules (`import`/`export`)  
**Primary Dependencies**: Hono 4.12.8, mysql2/promise, Alpine.js CDN, Tailwind CDN, Quill CDN  
**Storage**: MariaDB — sem alterações de schema  
**Testing**: Manual (curl + inspeção de navegador); sem framework de testes automatizados no projeto  
**Target Platform**: Docker (node:22-alpine) no UNRAID  
**Performance Goals**: N/A — feature é de segurança, sem impacto em throughput esperado  
**Constraints**: Sem breaking changes; sem build step; sem novas dependências npm; sem migrations  
**Scale/Scope**: 7 arquivos modificados; single-user application

---

## Constitution Check

| Princípio | Status | Observação |
|-----------|--------|------------|
| **I.1 Simplicidade** | ✅ Pass | Rate limiter usa `Map` nativo; sem dependências extras |
| **I.2 Sem Build Step** | ✅ Pass | Mudanças no frontend são Alpine.js vanilla sem bundler |
| **I.3 SQL parametrizado** | ✅ Pass | Nenhuma query SQL modificada |
| **I.4 Credenciais fora do repo** | ✅ Pass | Sem mudanças em credenciais ou configuração de segredos |
| **I.5 Migrations imutáveis** | ✅ Pass | Nenhuma migration necessária |

**Sem violações. Sem complexidade a justificar.**

---

## Project Structure

### Documentation (this feature)

```text
specs/012-fix-security-high/
├── plan.md              # Este arquivo
├── research.md          # Decisões técnicas e alternativas consideradas
├── data-model.md        # N/A — sem entidades novas
├── quickstart.md        # Verificação e deploy
└── tasks.md             # Gerado por /speckit.tasks
```

### Source Code (files affected)

```text
src/
├── server.js                   # ★ H1: middleware security headers | H2: rate limiting + timingSafeEqual
└── routes/
    ├── meetings.js             # ★ H3: isAllowedUrl() no filter de links (POST + PUT)
    └── projects.js             # ★ H3: isAllowedUrl() no filter de links (POST + PUT)

public/
├── index.html                  # ★ H3: :href="link.url" → :href="safeUrl(link.url)" (4 ocorrências)
└── assets/
    └── app.js                  # ★ H3: safeUrl() helper + fix printMeetingInfo()

Dockerfile                      # ★ H4: instalar su-exec, criar appuser/appgroup
docker-entrypoint.sh            # ★ H4: chown permissions fix + exec su-exec appuser node
```

**Structure Decision**: Projeto existente de arquivo único por camada. Sem novos arquivos de source necessários — todas as mudanças são modificações cirúrgicas em arquivos existentes.

---

## Phase 1: Design & Contracts

### H2 — Rate Limiting + Timing-Safe PIN

**Localização**: `src/server.js`, substituindo o handler atual `app.post('/api/auth/check', ...)` (linhas 42–46).

**Contrato da rota** (sem mudança de interface — mesma URL e body):

```
POST /api/auth/check
Body: { "pin": "string" }

Respostas:
  200 { "ok": true }          — PIN correto
  200 { "ok": false }         — PIN incorreto (indistinguível do bloqueio, por design — FR-004)
  429 { "ok": false }         — bloqueado por excesso de tentativas (retorno 429 para automações,
                                mas body idêntico ao erro de PIN para não revelar estado)
```

**Estado em memória**:
```js
// Fora do handler, no escopo do módulo:
const authAttempts = new Map() // ip → { count: number, lockedUntil: number (timestamp ms) }
const AUTH_MAX = 5
const AUTH_LOCK_MS = 15 * 60 * 1000
```

**Extração de IP**:
```js
const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim()
         ?? c.env?.incoming?.socket?.remoteAddress
         ?? 'unknown'
```

**Comparação timing-safe** (buffers de mesmo tamanho obrigatório — `timingSafeEqual` lança se tamanhos diferentes):
```js
import { timingSafeEqual } from 'node:crypto'

const pinBuf  = Buffer.from(String(pin ?? ''))
const appBuf  = Buffer.from(String(process.env.APP_PIN ?? ''))
const ok = pinBuf.length === appBuf.length && timingSafeEqual(pinBuf, appBuf)
```

---

### H1 — Security Headers Middleware

**Localização**: `src/server.js`, novo middleware registrado ANTES de todas as rotas (antes de `app.get('/api/health', ...)`).

**CSP construída a partir das CDNs reais do projeto** (analisadas em `public/index.html`):
- Scripts: `self`, `cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `'unsafe-inline'` (Alpine event handlers + Tailwind runtime)
- Styles: `self`, `cdn.jsdelivr.net`, `'unsafe-inline'` (Tailwind injeta estilos inline)
- Images: `self`, `data:`, `blob:` (thumbnails PDF)
- Connect: `self` (todas chamadas de API são same-origin)
- Frame ancestors: `none` (bloqueia clickjacking)

**Middleware pattern**:
```js
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net 'unsafe-inline'",
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; '))
})
```

> ⚠️ **`await next()` ANTES dos `c.header()`**: No Hono, os headers de resposta devem ser definidos após o handler downstream processar a requisição. O padrão `await next(); c.header(...)` garante isso.

---

### H3 — Validação de URL (Backend)

**Helper reutilizável** (duplicado em `meetings.js` e `projects.js` — sem arquivo de utils compartilhado, conforme I.1):

```js
function isAllowedUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}
```

**Mudança em `meetings.js`** (POST e PUT — 2 locais):

```js
// ANTES:
const validLinks = Array.isArray(links)
  ? links.filter(l => l?.nome?.trim() && l?.url?.trim())
  : []

// DEPOIS:
const validLinks = []
const rejectedUrls = []
for (const l of (Array.isArray(links) ? links : [])) {
  if (!l?.nome?.trim() || !l?.url?.trim()) continue
  if (isAllowedUrl(l.url.trim())) {
    validLinks.push(l)
  } else {
    rejectedUrls.push(l.url.trim())
  }
}
```

A resposta do POST/PUT passa a incluir `rejected_urls: rejectedUrls` no body JSON para que a UI possa exibir o aviso.

**Mudança em `projects.js`** (POST e PUT — 2 locais): mesma lógica, campo `body.links`.

**Mudança em `public/index.html`** (4 ocorrências de `:href="link.url"` e `:href="l.url"`):
- Linhas 1283, 1627, 1974, 2089: substituir por `:href="safeUrl(link.url)"` / `:href="safeUrl(l.url)"`

**Mudança em `public/assets/app.js`**:

```js
// Novo helper (adicionado no objeto Alpine, junto dos outros métodos utilitários):
safeUrl(url) {
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : '#'
  } catch { return '#' }
},
```

**Fix em `printMeetingInfo()`** (linha ~1259):
```js
// ANTES:
`<li><a href="${esc(l.url)}">${esc(l.nome || l.url)}</a></li>`

// DEPOIS:
`<li><a href="${safeUrl(l.url)}">${esc(l.nome || l.url)}</a></li>`
```
> Nota: `safeUrl` aqui é a função local `safeUrl` — como `printMeetingInfo` é um método do Alpine component, pode acessar `this.safeUrl(l.url)`.

---

### H4 — Docker Não-Root

**Mudança no `Dockerfile`**:

```dockerfile
# Stage 2: Runtime
FROM node:22-alpine AS runner
RUN apk add --no-cache mysql-client poppler-utils su-exec   # ← adicionar su-exec

WORKDIR /app

# Criar usuário não-privilegiado
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV NODE_ENV=production

# Sem USER appuser aqui — o entrypoint usa su-exec para trocar de usuário
# após corrigir permissões dos volumes (que podem pertencer a root)
ENTRYPOINT ["./docker-entrypoint.sh"]
```

**Mudança no `docker-entrypoint.sh`**:

```sh
#!/bin/sh
set -e

# Fix permissions on data directory (volumes montados podem pertencer a root)
if [ -n "$FILES_PATH" ]; then
  chown -R appuser:appgroup "$FILES_PATH" 2>/dev/null || true
fi

echo "[entrypoint] Waiting for MariaDB to be ready..."
# ... (lógica de wait existente, sem alteração) ...

echo "[entrypoint] Running database migrations..."
# ... (lógica de migration existente, sem alteração) ...

echo "[entrypoint] Migrations complete. Starting application as appuser..."
exec su-exec appuser node src/server.js   # ← substituir "exec node src/server.js"
```

> **`exec su-exec appuser`**: Substitui o processo shell pelo processo Node.js rodando como `appuser`. Sinais (SIGTERM, SIGINT) são entregues diretamente ao processo Node.js. O container inspecionado mostrará o processo como `appuser` (UID não-zero).

---

## Quickstart (Verification)

Salvo em: [quickstart.md](./quickstart.md)

### Verificar H1 (Security Headers)

```bash
curl -I http://localhost:3000/
# Esperar ver:
# x-content-type-options: nosniff
# x-frame-options: DENY
# content-security-policy: default-src 'self'; ...
# referrer-policy: strict-origin-when-cross-origin
```

### Verificar H2 (Rate Limiting)

```bash
for i in $(seq 1 6); do
  curl -s -X POST http://localhost:3000/api/auth/check \
    -H "Content-Type: application/json" \
    -d '{"pin":"0000"}' | cat
  echo " (tentativa $i)"
done
# Após 5 tentativas: { "ok": false } com HTTP 429
```

### Verificar H3 (URL Validation)

```bash
# Deve ser rejeitado (URL inválida):
curl -s -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"...", "links": [{"nome": "Teste", "url": "javascript:alert(1)"}]}' | cat
# Resperar: links normais salvos; rejected_urls contendo javascript:alert(1)

# Deve ser aceito:
# links: [{"nome": "Site", "url": "https://exemplo.com.br"}]
```

Na UI: Adicionar link com URL `javascript:alert(1)` → aviso visível. Clicar no link → sem execução de código.

### Verificar H4 (Non-root container)

```bash
docker exec <container_id> whoami
# Esperado: appuser (não root)

docker exec <container_id> id
# Esperado: uid != 0
```

---

## Sequência de Deploy (Produção)

1. Implementar todas as mudanças nos arquivos listados
2. `git commit` + `git push origin main`
3. GitHub Actions faz build e publica nova imagem no GHCR
4. UNRAID: pull da nova imagem + restart do container
5. **Nenhuma migration SQL necessária**
6. Verificar com os comandos do Quickstart acima

> ⚠️ No primeiro deploy com a imagem não-root, o entrypoint corrige automaticamente as permissões do `FILES_PATH` volume. Não é necessária nenhuma ação manual.
