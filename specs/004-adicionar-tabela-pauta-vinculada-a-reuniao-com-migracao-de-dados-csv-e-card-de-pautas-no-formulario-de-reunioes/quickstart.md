# Quickstart: Deploy da Feature Pauta

**Date**: 2026-03-19

> ⚠️ **ATENÇÃO**: Seguir a sequência exata abaixo. Não executar `npm run migrate` uma única vez cobrindo todas as migrations — leia o passo 2 com cuidado.

---

## Sequência de Deploy (Produção)

### Passo 1 — Aplicar migration de criação da tabela

```bash
npm run migrate
# Aplica: 008_add_pauta.sql
# Resultado: tabela `pauta` criada no banco
```

Verificar:
```sql
SHOW TABLES LIKE 'pauta';
DESCRIBE pauta;
```

---

### Passo 2 — Executar script de migração dos dados históricos

```bash
node docs/source/scripts/migrate-pautas.js
# Lê: docs/source/memoriaReunioes-Pauta.csv
# Grava: tabela pauta (INSERT IGNORE — idempotente)
# Gera: log de registros ignorados no console
```

O script é **idempotente** — pode ser executado mais de uma vez sem duplicar registros.

Verificar:
```sql
SELECT COUNT(*) FROM pauta;
-- Deve refletir o número de registros válidos do CSV
SELECT r.data_hora, p.texto, p.ordem
FROM pauta p
JOIN reuniao r ON r.id = p.reuniao_id
ORDER BY r.data_hora DESC, p.ordem ASC
LIMIT 20;
```

---

### Passo 3 — Deploy da aplicação

```bash
git push origin main
# GitHub Actions faz build e publica imagem no GHCR
# UNRAID: pull nova imagem + restart container
```

---

### Passo 4 — Verificação funcional

1. Abrir a aplicação e editar uma reunião com data histórica (ex: 2026-03-13 14:00)
2. Verificar que o card de pautas mostra as pautas migradas
3. Adicionar uma nova pauta via botão "+", salvar e reabrir para confirmar persistência
4. Remover uma pauta, salvar e reabrir para confirmar remoção

---

## Estrutura do Script de Migração

**Localização**: `docs/source/scripts/migrate-pautas.js`
**Credenciais**: via variáveis de ambiente (DB_USER / DB_PASSWORD) — arquivo nunca commitado
**Banco**: host/porta via `DB_HOST`/`DB_PORT` / database `reunioes`

### Lógica do script

1. Lê `docs/source/memoriaReunioes-Pauta.csv` (separador `;`, UTF-8)
2. Para cada linha:
   - Skip se `data_hora` vazio
   - Skip se `pauta` vazio (após trim)
   - Normaliza timestamp: converte offset `-03:00` para UTC (`+3h`)
   - Busca `reuniao.id` por `data_hora` exato: `WHERE DATE_FORMAT(data_hora,'%Y-%m-%dT%H:%i:%s') = ?`
   - Se não encontrar reunião: log "SKIPPED: reunião não encontrada para [timestamp]"
   - Se encontrar: `INSERT IGNORE INTO pauta (reuniao_id, texto, ordem) VALUES (?, ?, ?)`
3. Exibe resumo: total processados / inseridos / ignorados

---

## Rollback (se necessário)

```sql
-- Remove todos os dados de pauta (mantém estrutura)
DELETE FROM pauta;

-- Remove a tabela (se necessário reverter completamente)
DROP TABLE IF EXISTS pauta;
-- Após dropar, remover entrada de 008_add_pauta.sql em schema_migrations:
DELETE FROM schema_migrations WHERE filename = '008_add_pauta.sql';
```

---

## Notas de Desenvolvimento Local

```bash
# Variáveis de ambiente para rodar localmente
DB_HOST=<db-host> DB_PORT=<db-port> DB_NAME=reunioes DB_USER=seu_user DB_PASSWORD=sua_senha npm run dev
```
