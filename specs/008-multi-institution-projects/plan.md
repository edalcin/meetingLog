# Implementation Plan: Projetos Multi-Institucionais

**Branch**: `008-multi-institution-projects` | **Date**: 2026-03-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-multi-institution-projects/spec.md`

## Summary

Migrar a relação entre Projeto e Instituição de um campo VARCHAR legado (`projeto.instituicao`) para a junction table `projeto_instituicao` já existente no banco. Permite múltiplas instituições por projeto. Frontend usa padrão de tags removíveis com busca + ENTER-to-create, idêntico ao padrão de participantes.

## Technical Context

**Language/Version**: Node.js 22 (ES modules)
**Primary Dependencies**: Hono (web framework), mysql2/promise (MariaDB), Alpine.js CDN, Tailwind CSS CDN
**Storage**: MariaDB — `reunioes` database; junction table `projeto_instituicao` já existe
**Testing**: Manual (ferramenta single-user, sem suite de testes automatizados)
**Target Platform**: Docker (node:22-alpine), UNRAID
**Project Type**: Web application (monolítico — backend Hono + frontend Alpine.js no mesmo container)
**Performance Goals**: N/A (single-user, dataset pequeno)
**Constraints**: Sem build step no frontend (Constitution I.2). SQL parametrizado sempre (I.3).
**Scale/Scope**: Single-user, dezenas de projetos

## Constitution Check

| Princípio | Status | Notas |
|-----------|--------|-------|
| I.1 Simplicidade | ✅ | Reusa junction table existente, sem novas abstrações |
| I.2 Sem build step | ✅ | Alpine.js + vanilla JS apenas |
| I.3 SQL parametrizado | ✅ | Todas as queries usarão `?` com array de params |
| I.4 Credenciais fora do repo | ✅ | Script de migração vai em `docs/source/scripts/` (gitignored) |
| I.5 Migrations imutáveis | ✅ | Nova migration `012_drop_projeto_instituicao_col.sql` |
| II.1 Sequência canônica | ✅ | Script de dados ANTES da migration de drop de coluna |
| II.3 Idempotência | ✅ | INSERT IGNORE + PK composta na junction table |

## Project Structure

### Documentation (this feature)

```text
specs/008-multi-institution-projects/
├── plan.md              # Este arquivo
├── research.md          # Decisões e impacto em outros módulos
├── data-model.md        # Schema, queries, estado Alpine.js
├── quickstart.md        # Sequência de deploy (CRÍTICA — ver aviso)
├── contracts/
│   └── api-projects.md  # Contrato REST atualizado
└── tasks.md             # Gerado por /speckit.tasks
```

### Source Code (repository root)

```text
migrations/
└── 012_drop_projeto_instituicao_col.sql   # Remove coluna legada

docs/source/scripts/
└── migrate_projeto_instituicao.js         # Migra dados antes do drop (gitignored)

src/routes/
├── projects.js     # ⚠️ Modificar completamente (GET/POST/PUT)
└── institutions.js # ⚠️ Remover propagação de sigla para projeto.instituicao

public/
├── index.html      # ⚠️ Formulário de projeto: single tag → multi-tag; busca + ENTER
└── assets/app.js   # ⚠️ Estado, getters, handlers de projeto × instituição
```

**Structure Decision**: Projeto monolítico único. Backend em `src/routes/`, frontend em `public/`. Sem novos arquivos de rota (apenas modificações).

## Complexity Tracking

> Nenhuma violação de Constitution detectada.

---

## Phase 0: Research — Concluída

Ver `research.md`. Decisões principais:

1. **Junction table** já existe — sem migration de criação
2. **Migração de dados** via script JS + match case-insensitive por sigla
3. **UX creatable input** — padrão `handleParticipantEnter()` adaptado para múltipla seleção
4. **Busca abre ao focar** (resposta Q3) — `filteredProjectInstOptions` retorna todas não selecionadas quando query vazia
5. **Remover propagação de sigla** em `institutions.js` (coluna deixa de existir)

---

## Phase 1: Design & Contracts — Concluída

### Data Model

Ver `data-model.md`. Resumo:

- `projeto.instituicao` VARCHAR removido (migration 012)
- `projeto_instituicao` passa a ser lida e escrita pela API de projetos
- Response shape: `instituicao_nomes` (string GROUP_CONCAT) + `instituicao_ids` (array parsed)
- Alpine state: `projectForm.instituicao_ids` muda de `string` para `Set<number>`

### API Contracts

Ver `contracts/api-projects.md`. Resumo:

- `GET /api/projects`: adiciona LEFT JOINs + GROUP_CONCAT; busca textual inclui sigla/nome da instituição
- `POST /api/projects`: aceita `instituicao_ids: number[]`, insere em `projeto_instituicao` em transação
- `PUT /api/projects/:id`: substitui todos os vínculos (DELETE + re-INSERT em transação)

### Quickstart

Ver `quickstart.md`. **Sequência crítica**:

1. Rodar `migrate_projeto_instituicao.js` (lê `projeto.instituicao` antes que seja removida)
2. Deploy do novo código
3. `npm run migrate` (aplica migration 012 que remove a coluna)

---

## Implementation Guide (para /speckit.tasks)

### Tarefa A — Backend: `src/routes/projects.js`

**A1** — Reescrever `GET /api/projects`:
- Substituir `SELECT ... FROM projeto WHERE ...` por query com LEFT JOIN em `projeto_instituicao` e `instituicao`
- `GROUP_CONCAT(DISTINCT i.sigla ...) AS instituicao_nomes`
- `GROUP_CONCAT(DISTINCT i.id ...) AS instituicao_ids_str`
- COUNT usar `COUNT(DISTINCT p.id)` (por causa do GROUP BY)
- Filtro de texto: `(p.nome LIKE ? OR i.sigla LIKE ? OR i.nome LIKE ?)`
- Parse response: `instituicao_ids_str.split(',').map(Number).filter(Boolean)` → `instituicao_ids`
- Remover `instituicao` do SELECT e do map de response

**A2** — Reescrever `POST /api/projects`:
- Remover `instituicao` do INSERT
- Aceitar `body.instituicao_ids` (array, default `[]`)
- Usar `pool.getConnection()` + `beginTransaction/commit/rollback`
- INSERT IGNORE em `projeto_instituicao` para cada ID
- Response: incluir `instituicao_nomes` e `instituicao_ids`

**A3** — Reescrever `PUT /api/projects/:id`:
- Remover `instituicao` do UPDATE
- Aceitar `body.instituicao_ids` (array, default `[]`)
- Usar transação: UPDATE projeto + DELETE projeto_instituicao + INSERT IGNORE por ID
- Response: incluir `instituicao_nomes` e `instituicao_ids`

### Tarefa B — Backend: `src/routes/institutions.js`

**B1** — Remover a linha de propagação de sigla para projetos (~linha 72):
```javascript
// REMOVER esta linha:
await pool.query('UPDATE projeto SET instituicao=? WHERE instituicao=?', [sigla, current.sigla])
```

### Tarefa C — Migration SQL

**C1** — Criar `migrations/012_drop_projeto_instituicao_col.sql`:
```sql
ALTER TABLE `projeto` DROP COLUMN `instituicao`;
```

### Tarefa D — Script de migração de dados

**D1** — Criar `docs/source/scripts/migrate_projeto_instituicao.js`:
- Ler todos os projetos com `instituicao IS NOT NULL`
- Para cada projeto: buscar `instituicao.id` onde `LOWER(sigla) = LOWER(projeto.instituicao)`
- Se encontrado: `INSERT IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)`
- Log de matched/unmatched

### Tarefa E — Frontend: `public/assets/app.js`

**E1** — Atualizar estado do `projectForm`:
- Mudar `instituicao: ''` → `instituicao_ids: new Set()`

**E2** — Adicionar getter `selectedProjectInsts`:
```javascript
get selectedProjectInsts() {
  return this.institutionListAll.filter(i => this.projectForm.instituicao_ids.has(i.id))
}
```

**E3** — Atualizar getter `filteredProjectInstOptions`:
- Filtrar instituições já selecionadas do resultado
- Retornar todas as não selecionadas quando query vazia

**E4** — Atualizar getter `showProjectInstCreateOption`:
- Verificar também que a sigla digitada não está entre as já selecionadas

**E5** — Adicionar handler `handleProjectInstEnter()` (padrão `handleParticipantEnter`):
```javascript
async handleProjectInstEnter() {
  const q = this.projectInstSearch.trim()
  if (!q) return
  const exact = this.institutionListAll.find(i => i.sigla.toLowerCase() === q.toLowerCase())
  if (exact && !this.projectForm.instituicao_ids.has(exact.id)) {
    this.selectProjectInst(exact)
  } else if (!exact) {
    await this.createAndSelectProjectInst(q)
  }
  this.projectInstSearch = ''
  this.showProjectInstDropdown = false
}
```

**E6** — Atualizar `selectProjectInst(inst)`:
- Aceitar objeto `inst` (não sigla string)
- Adicionar `inst.id` ao Set `projectForm.instituicao_ids`
- Limpar `projectInstSearch`

**E7** — Remover `clearProjectInst()` e substituir por `removeProjectInst(id)`:
```javascript
removeProjectInst(id) {
  this.projectForm.instituicao_ids.delete(id)
}
```

**E8** — Atualizar `createAndSelectProjectInst(sigla)`:
- Após criar, adicionar `body.id` ao Set `projectForm.instituicao_ids` (não `body.sigla`)
- Adicionar `body` ao `institutionListAll`

**E9** — Atualizar `openNewProject()` e `openEditProject(p)`:
- `openNewProject`: inicializar `instituicao_ids: new Set()`
- `openEditProject`: inicializar `instituicao_ids: new Set(p.instituicao_ids || [])`
- Remover `projectInstSearch` pre-fill com sigla legada

**E10** — Atualizar `saveProject()`:
- Body: `{ nome, ativo, instituicao_ids: Array.from(this.projectForm.instituicao_ids) }`

**E11** — Atualizar `projInstituicaoOptions` getter:
- Trocar `p.instituicao` por `p.instituicao_nomes` (string para filtragem)

**E12** — Atualizar `filteredProjectList`:
- Trocar filter por `p.instituicao` → `p.instituicao_nomes`

**E13** — Atualizar `filteredProjects` (usado no formulário de reunião):
- Trocar filter por `pr.instituicao` → `pr.instituicao_nomes`

**E14** — Atualizar `filteredProjectsForFilter`:
- Trocar filter por `pr.instituicao` → `pr.instituicao_nomes`

**E15** — Remover handlers de propagação de sigla em projetos (linhas ~1157-1163):
```javascript
// REMOVER estas linhas (projetos não armazenam mais sigla como string):
if (p.instituicao === oldSigla) p.instituicao = newSigla  // linha ~1157
if (p.instituicao === oldSigla) p.instituicao = newSigla  // linha ~1160 (allProjects)
if (p.instituicao === oldSigla) p.instituicao = newSigla  // linha ~1163 (filteredProjects cache)
```

**E16** — Atualizar `loadProjects()` (response parsing):
- Parse `data.data`: `instituicao_ids_str` → `instituicao_ids: number[]` se necessário
  (ou já vem como array do backend — verificar resposta real)

### Tarefa F — Frontend: `public/index.html`

**F1** — Formulário de projeto — tags de instituição:
- Substituir o bloco de tag única (`x-show="projectForm.instituicao"`) por loop de múltiplas tags:
```html
<template x-for="inst in selectedProjectInsts" :key="inst.id">
  <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
    <span x-text="inst.sigla"></span>
    <button type="button" @click="removeProjectInst(inst.id)" class="text-blue-500 hover:text-blue-700 leading-none">&times;</button>
  </span>
</template>
```

**F2** — Campo de busca — adicionar ENTER handler:
```html
@keydown.enter.prevent="handleProjectInstEnter()"
```

**F3** — Lista de projetos (tab Projetos):
- Trocar `x-text="p.instituicao ?? '—'"` → `x-text="p.instituicao_nomes || '—'"`

**F4** — Dropdowns de projetos na ficha de reunião e painel de detalhes:
- Trocar `x-show="pr.instituicao"` e `x-text="' · ' + pr.instituicao"` → usar `pr.instituicao_nomes`
- Linhas ~221, ~260, ~965 em index.html

**F5** — Filtro de instituição na aba Projetos:
- `projInstituicaoOptions` retorna strings de `instituicao_nomes` — verificar se a lógica de filtro continua funcionando com o novo campo (deve funcionar pois ainda é string)
