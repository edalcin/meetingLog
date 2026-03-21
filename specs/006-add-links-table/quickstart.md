# Quickstart: Deploy da Feature Links

**Date**: 2026-03-21

> ⚠️ **ATENÇÃO**: Seguir a sequência exata abaixo. A migration `010_add_link.sql` cria apenas a tabela — não há coluna legada a remover, portanto `npm run migrate` pode ser executado uma única vez.

---

## Sequência de Deploy (Produção)

### Passo 1 — Aplicar migration de criação da tabela

```bash
npm run migrate
# Aplica: 010_add_link.sql
# Resultado: tabela `link` criada no banco
```

Verificar:
```sql
SHOW TABLES LIKE 'link';
DESCRIBE link;
```

---

### Passo 2 — Executar script de migração dos dados históricos

```bash
DB_HOST=192.168.1.10 DB_PORT=3333 DB_NAME=reunioes DB_USER=root DB_PASSWORD=<senha> \
  node docs/source/scripts/migrate-links.js
# Lê: docs/source/memoriaReunioes-DocsRelacionados.csv
# Grava: tabela link (INSERT IGNORE — idempotente)
# Gera: log de registros ignorados no console
```

O script é **idempotente** — pode ser executado mais de uma vez sem duplicar registros (chave única: `reuniao_id` + `url`).

Verificar:
```sql
SELECT COUNT(*) FROM link;
-- Esperado: ~número de registros válidos do CSV

SELECT r.data_hora, l.nome, l.url, l.ordem
FROM link l
JOIN reuniao r ON r.id = l.reuniao_id
ORDER BY r.data_hora DESC, l.ordem ASC
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

1. Abrir a aplicação e editar uma reunião com links históricos (ex: 02/06/2022 10:00 — "Panorama da STI")
2. Verificar que o card de links mostra os links migrados com nome e URL clicável
3. Adicionar um novo link via botão "+", salvar e reabrir para confirmar persistência
4. Remover um link, salvar e reabrir para confirmar remoção
5. Clicar em um link e verificar que abre em nova aba
6. Abrir o painel de detalhes de uma reunião com links e verificar exibição somente-leitura

---

## Estrutura do Script de Migração

**Localização**: `docs/source/scripts/migrate-links.js`
**Credenciais**: via variáveis de ambiente (DB_USER / DB_PASSWORD) — arquivo nunca commitado
**Banco**: host/porta via `DB_HOST`/`DB_PORT` / database `reunioes`

### Lógica do script

1. Lê `docs/source/memoriaReunioes-DocsRelacionados.csv` (separador `;`, UTF-8)
2. Para cada linha:
   - Skip se `reuniao_data` vazio
   - Faz parse do campo `linkDoc` com regex `/^\[(.+?)\]\s+(.+)$/`
   - Skip se formato inválido (log: "SKIPPED: formato inválido: [valor original]")
   - Skip se nome ou URL vazio após trim
   - Converte data BRT (`DD/MM/YYYY HH:MM`) para UTC (`+3h`)
   - Busca `reuniao.id` por `data_hora` exato
   - Se não encontrar reunião: log "SKIPPED: reunião não encontrada para [timestamp]"
   - Se encontrar: `INSERT IGNORE INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)`
3. Exibe resumo: total processados / inseridos / ignorados

---

## Rollback (se necessário)

```sql
-- Remove todos os dados de links (mantém estrutura)
DELETE FROM link;

-- Remove a tabela (se necessário reverter completamente)
DROP TABLE IF EXISTS link;
-- Após dropar, remover entrada da migration em schema_migrations:
DELETE FROM schema_migrations WHERE filename = '010_add_link.sql';
```

---

## Notas de Desenvolvimento Local

```bash
# Variáveis de ambiente para rodar localmente
DB_HOST=<db-host> DB_PORT=<db-port> DB_NAME=reunioes DB_USER=seu_user DB_PASSWORD=sua_senha npm run dev
```
