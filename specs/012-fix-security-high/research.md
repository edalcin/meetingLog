# Research: Correção das Vulnerabilidades de Alta Prioridade

**Phase**: 0 — Research  
**Date**: 2026-04-08  
**Feature**: 012-fix-security-high

---

## H2 — Rate Limiting no PIN (in-memory vs. dependência externa)

**Decision**: `Map` nativo em memória do processo Node.js — sem dependência externa.

**Rationale**: A aplicação é single-container, single-user. Um `Map<ip, {count, lockedUntil}>` cobre 100% do caso de uso. Soluções como `hono-rate-limiter` ou `express-rate-limit` adicionariam uma dependência sem ganho. O estado não precisa ser persistido entre restarts — aceitável pela spec (Assumptions).

**IP extraction**: `c.req.header('x-forwarded-for') ?? c.env?.incoming?.socket?.remoteAddress ?? 'unknown'`. No UNRAID com acesso direto à porta, o IP real chega via socket. Com reverse proxy, chega via `x-forwarded-for`.

**Timing-safe comparison**: `timingSafeEqual` de `node:crypto` (built-in). Exige buffers de mesmo tamanho — verificação de tamanho antes da comparação (buffers de comprimentos diferentes resultam em `false` sem chamar `timingSafeEqual`).

**Alternatives considered**:
- `hono-rate-limiter` npm package — rejected: dependência desnecessária para uso single-user.
- Redis-based counter — rejected: sem Redis na stack, viola I.1 (simplicidade).
- IP via `c.req.raw` header — same result, less portable.

---

## H3 — Validação de URL (`new URL()` vs. regex)

**Decision**: `new URL(url)` da API WHATWG de URL (built-in em Node.js 22), verificando `u.protocol`.

**Rationale**: Mais robusto que regex — lida corretamente com URLs codificadas, URL relativas (lança erro), e edge cases de protocolo (ex.: `JAVASCRIPT:` maiúsculo). Sem dependência adicional.

```js
function isAllowedUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}
```

**Frontend guard**: `safeUrl(url)` adicionado ao objeto Alpine retorna `'#'` para URLs inválidas. A mesma lógica no `printMeetingInfo()` substitui `esc(l.url)` por `safeUrl(l.url)`.

**Behavior com múltiplos links (clarificado na spec)**: Links válidos são salvos; links inválidos são descartados. A resposta da API inclui a lista de URLs descartadas para exibição de aviso na UI. Os routes (meetings.js e projects.js) devem separar `validLinks` de `rejectedLinks` e incluir os rejeitados no body da resposta.

**Alternatives considered**:
- Regex `^https?://` — rejected: não lida com maiúsculas em protocolo (`JAVASCRIPT:`).
- DOMPurify no backend — rejected: desnecessário, problema é de protocolo, não de HTML.

---

## H1 — Cabeçalhos de Segurança (middleware manual vs. `secureHeaders`)

**Decision**: Middleware manual `app.use('*', ...)` no `server.js`, antes das rotas.

**Rationale**: Hono tem um `secureHeaders()` middleware built-in, mas o CSP requer conhecimento das CDNs exatas usadas pela aplicação. Escrever o middleware manualmente dá controle total sobre o valor do CSP sem depender do que `secureHeaders()` gera. O esforço é equivalente.

**CSP necessário** (baseado em análise do `public/index.html`):
- `script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net 'unsafe-inline'` — Tailwind CDN usa script, Alpine.js via jsdelivr, 'unsafe-inline' necessário para Alpine event handlers
- `style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'` — Quill CSS via jsdelivr, Tailwind injeta estilos inline
- `img-src 'self' data: blob:` — thumbnails de PDF podem usar data URIs
- `connect-src 'self'` — todas as chamadas de API são same-origin
- `frame-ancestors 'none'` — bloqueia iframe embedding
- `default-src 'self'`

**Placement**: O middleware DEVE ser registrado ANTES de todas as rotas (`app.route(...)` calls) para garantir que todas as respostas incluam os cabeçalhos.

**Alternatives considered**:
- `secureHeaders()` do Hono — viable, but CSP customization requires same config work anyway.
- Nginx-level headers — rejected: não há Nginx na stack; aplicação serve diretamente.

---

## H4 — Docker não-root (`su-exec` vs. `USER` + `gosu` vs. fixup em entrypoint)

**Decision**: `su-exec` (pacote Alpine) + entrypoint roda como root, corrige permissões, depois faz `exec su-exec appuser node src/server.js`.

**Rationale**: O `Dockerfile` define o usuário com `USER appuser` no final — mas isso significa o `ENTRYPOINT` também roda como `appuser`, impossibilitando a correção de permissões com `chown`. A solução padrão em Alpine é usar `su-exec` (equivalente ao `gosu` do Debian, mas menor). O entrypoint permanece com `root` como user efetivo durante a inicialização, corrige permissões dos volumes, e depois substitui o processo por `exec su-exec appuser node src/server.js`. O processo final (Node.js) roda como não-root.

**Sem `USER` no Dockerfile**: Ao usar `su-exec`, não se define `USER appuser` no Dockerfile — o `su-exec` faz a troca no runtime. Isso é intencional para permitir a correção de permissões no entrypoint.

**Permission fix**: `chown -R appuser:appgroup ${FILES_PATH:-/app/data}` — corrige diretório de uploads existente no host.

**Alternatives considered**:
- `USER appuser` no Dockerfile sem su-exec — rejected: entrypoint não pode corrigir permissões sem root.
- `gosu` — viable mas `su-exec` é mais leve e é o padrão Alpine.
- Volume init container — rejected: adiciona complexidade ao docker-compose desnecessariamente.

---

## Arquivos Afetados (mapa completo)

| Arquivo | Mudança | Vulnerabilidade |
|---------|---------|----------------|
| `src/server.js` | Rate limiter + security headers middleware | H2, H1 |
| `src/routes/meetings.js` | `isAllowedUrl()` no filter de links (POST + PUT) | H3 |
| `src/routes/projects.js` | `isAllowedUrl()` no filter de links (POST + PUT) | H3 |
| `public/index.html` | `:href="link.url"` → `:href="safeUrl(link.url)"` (4 lugares) | H3 |
| `public/assets/app.js` | Adicionar `safeUrl()`, fixar `printMeetingInfo()` | H3 |
| `Dockerfile` | Adicionar `su-exec`, criar `appuser` | H4 |
| `docker-entrypoint.sh` | `chown` fix + `exec su-exec appuser node src/server.js` | H4 |

**Sem migrations SQL** — nenhuma alteração de schema necessária.  
**Sem novas dependências npm** — todos os recursos usados são built-in ou já instalados.
