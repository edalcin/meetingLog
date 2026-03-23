# Data Model: Projetos Multi-Institucionais

**Feature**: 008-multi-institution-projects
**Date**: 2026-03-23

---

## Entities

### `projeto` (tabela existente — alterada)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | Sem mudança |
| `nome` | VARCHAR(255) NOT NULL UNIQUE | Sem mudança |
| `ativo` | BOOLEAN NOT NULL DEFAULT TRUE | Sem mudança |
| ~~`instituicao`~~ | ~~VARCHAR(255) NULL~~ | **REMOVIDO** pela migration 012 |
| `criado_em` | DATETIME NOT NULL DEFAULT NOW() | Sem mudança |

### `instituicao` (tabela existente — sem alteração de schema)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | Sem mudança |
| `sigla` | VARCHAR(100) NOT NULL UNIQUE | Identificador canônico |
| `nome` | VARCHAR(255) NULL | Nome completo opcional |
| `criado_em` | DATETIME NOT NULL DEFAULT NOW() | Sem mudança |

### `projeto_instituicao` (tabela existente — passa a ser utilizada pela API)

| Campo | Tipo | Notas |
|-------|------|-------|
| `projeto_id` | INT UNSIGNED NOT NULL FK → projeto.id CASCADE DELETE | Sem mudança |
| `instituicao_id` | INT UNSIGNED NOT NULL FK → instituicao.id CASCADE DELETE | Sem mudança |
| PK | (`projeto_id`, `instituicao_id`) | Impede duplicatas |

> Esta tabela já existe desde `007_add_instituicoes.sql`. Nenhuma migration de criação é necessária.

---

## API Response Shape

### `GET /api/projects` — resposta por item

```json
{
  "id": 1,
  "nome": "Projeto Exemplo",
  "ativo": true,
  "instituicao_nomes": "MEC, UFMG",
  "instituicao_ids": [2, 5],
  "reuniao_count": 3
}
```

**Removido**: campo `instituicao` (string varchar legado)
**Adicionado**:
- `instituicao_nomes`: siglas concatenadas (GROUP_CONCAT), string vazia `""` se sem vínculos
- `instituicao_ids`: array de inteiros (parse de `GROUP_CONCAT(i.id)` → `number[]`), array vazio `[]` se sem vínculos

### `POST /api/projects` — corpo da requisição

```json
{
  "nome": "Novo Projeto",
  "ativo": true,
  "instituicao_ids": [2, 5]
}
```

**Removido**: campo `instituicao`
**Adicionado**: `instituicao_ids: number[]` (opcional, padrão `[]`)

### `PUT /api/projects/:id` — corpo da requisição

Idêntico ao POST. O backend faz DELETE + re-INSERT na `projeto_instituicao` (substituição completa).

---

## Queries principais

### GET — SELECT com JOINs

```sql
SELECT
  p.id, p.nome, p.ativo,
  COALESCE(GROUP_CONCAT(DISTINCT i.sigla ORDER BY i.sigla SEPARATOR ', '), '') AS instituicao_nomes,
  COALESCE(GROUP_CONCAT(DISTINCT i.id    ORDER BY i.sigla SEPARATOR ','), '')  AS instituicao_ids_str,
  (SELECT COUNT(*) FROM reuniao_projeto WHERE projeto_id = p.id) AS reuniao_count
FROM projeto p
LEFT JOIN projeto_instituicao pi ON pi.projeto_id = p.id
LEFT JOIN instituicao i ON i.id = pi.instituicao_id
[WHERE ...]
GROUP BY p.id
ORDER BY p.nome ASC
LIMIT ?
```

### GET — COUNT com JOINs (para `total`)

```sql
SELECT COUNT(DISTINCT p.id) AS total
FROM projeto p
LEFT JOIN projeto_instituicao pi ON pi.projeto_id = p.id
LEFT JOIN instituicao i ON i.id = pi.instituicao_id
[WHERE ...]
```

### GET — filtro de texto (busca também por instituição)

```sql
WHERE (p.nome LIKE ? OR i.sigla LIKE ? OR i.nome LIKE ?)
```

> **Nota**: O filtro por instituição exige o LEFT JOIN e GROUP BY, então o COUNT também precisa usar `COUNT(DISTINCT p.id)`.

### POST — inserir vínculos

```sql
-- Dentro de transação:
INSERT INTO projeto (nome, ativo) VALUES (?, ?)
-- Para cada id em instituicao_ids:
INSERT IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)
```

### PUT — substituir vínculos

```sql
-- Dentro de transação:
UPDATE projeto SET nome=?, ativo=? WHERE id=?
DELETE FROM projeto_instituicao WHERE projeto_id=?
-- Para cada id em instituicao_ids:
INSERT IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)
```

---

## Migration 012

**Arquivo**: `migrations/012_drop_projeto_instituicao_col.sql`

```sql
ALTER TABLE `projeto` DROP COLUMN `instituicao`;
```

**Pré-requisito**: script de migração de dados deve ser executado ANTES desta migration.

---

## Script de Migração de Dados

**Arquivo**: `docs/source/scripts/migrate_projeto_instituicao.js` (gitignored)

**Lógica**:
1. Para cada projeto em `projeto` onde `instituicao IS NOT NULL AND instituicao != ''`
2. Busca `instituicao.id` onde `LOWER(sigla) = LOWER(projeto.instituicao)`
3. Se encontrado: `INSERT IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)`
4. Se não encontrado: loga `[UNMATCHED] projeto.id=X nome=Y instituicao=Z`

**Idempotência**: INSERT IGNORE + PK composta — seguro para executar múltiplas vezes.

---

## Estado do Alpine.js

### Antes (atual)

```javascript
projectForm: { nome: '', ativo: true, instituicao: '' }  // string sigla
```

### Depois

```javascript
projectForm: { nome: '', ativo: true, instituicao_ids: new Set() }  // Set<number>
```

### Getter `selectedProjectInsts` (novo)

```javascript
get selectedProjectInsts() {
  return this.institutionListAll.filter(i => this.projectForm.instituicao_ids.has(i.id))
}
```

### Getter `filteredProjectInstOptions` (atualizado)

```javascript
get filteredProjectInstOptions() {
  const q = this.projectInstSearch.toLowerCase().trim()
  const notSelected = this.institutionListAll.filter(i => !this.projectForm.instituicao_ids.has(i.id))
  if (!q) return notSelected.slice(0, 50)
  return notSelected.filter(i =>
    i.sigla.toLowerCase().includes(q) || (i.nome && i.nome.toLowerCase().includes(q))
  )
}
```
