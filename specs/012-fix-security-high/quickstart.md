# Quickstart: Correção das Vulnerabilidades de Alta Prioridade

**Feature**: 012-fix-security-high  
**Date**: 2026-04-08

## Verificações Pós-Deploy

### H1 — Security Headers
```bash
curl -I http://localhost:3000/
# Deve conter:
# x-content-type-options: nosniff
# x-frame-options: DENY
# content-security-policy: default-src 'self'; ...
# referrer-policy: strict-origin-when-cross-origin
```

### H2 — Rate Limiting no PIN
```bash
for i in $(seq 1 6); do
  curl -s -X POST http://localhost:3000/api/auth/check \
    -H "Content-Type: application/json" \
    -d '{"pin":"0000"}'
  echo " (tentativa $i)"
done
# 1ª–5ª: {"ok":false}  (HTTP 200)
# 6ª:    {"ok":false}  (HTTP 429) — bloqueado
```

### H3 — URL Validation
```bash
# Na UI: adicionar link com URL javascript:alert(1) → aviso, link não salvo
# Na UI: clicar em link legado com javascript: → href="#", sem execução
# Via API: links com URL válida são salvos normalmente
```

### H4 — Container não-root
```bash
docker exec <container_id> whoami   # → appuser
docker exec <container_id> id       # → uid=NNN(appuser) ... (não 0)
```

## Sem Migrations SQL
Esta feature não requer nenhuma migration de banco de dados.
