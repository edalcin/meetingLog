# Data Model: Substituição de Projetos em Reuniões

**Feature**: `009-maintenance-project-replace`
**Date**: 2026-03-24

---

## Tabelas Envolvidas (existentes — sem alteração de schema)

### `reuniao_projeto` (junction N:N)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `reuniao_id` | INT FK | Referência à `reuniao.id` |
| `projeto_id` | INT FK | Referência à `projeto.id` |

**UNIQUE KEY**: `(reuniao_id, projeto_id)` — garante que cada reunião não tenha o mesmo projeto duplicado. Esta constraint é o motivo pelo qual o DELETE de duplicatas deve vir **antes** do UPDATE no fluxo de substituição.

### `projeto`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT PK | Identificador |
| `nome` | VARCHAR(255) | Nome do projeto |
| `ativo` | TINYINT(1) | Flag de ativo/inativo |

### `reuniao` + `reuniao_participante` + `participante`

Usadas apenas no dry run para montar o campo `participantes_nomes` via GROUP_CONCAT.

---

## Operação de Substituição (fluxo de dados)

```
INPUT: { from_id, to_id, dry_run }

dry_run = true:
  SELECT reunioes afetadas (from_id presente em reuniao_projeto)
  → retorna lista [{ id, data_fmt, participantes_nomes }] + count
  → nenhuma escrita

dry_run = false:
  BEGIN TRANSACTION
    DELETE duplicatas (reunioes que já têm to_id)
    UPDATE from_id → to_id nas restantes
  COMMIT
  → retorna { updated: N }
```

---

## Validações no Backend

| Regra | Onde validar |
|-------|-------------|
| `from_id` e `to_id` obrigatórios e inteiros > 0 | `maintenance.js` |
| `from_id !== to_id` | `maintenance.js` |
| `from_id` deve existir em `projeto` | `maintenance.js` (query EXISTS) |
| `to_id` deve existir em `projeto` | `maintenance.js` (query EXISTS antes da execução) |
| `dry_run` deve ser boolean | `maintenance.js` |

---

## Nenhuma migration necessária

Todas as tabelas e relações já existem. A feature não altera schema.
