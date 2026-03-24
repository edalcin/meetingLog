# Implementation Plan: Notas e Links em Projetos

**Branch**: `010-project-notes-links` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-project-notes-links/spec.md`

---

## Summary

Adicionar suporte a notas (editor Quill) e links (1:N) na ficha de edição dos projetos, replicando exatamente o padrão já implementado nas reuniões. Backend: nova coluna `projeto.notas TEXT NULL` + nova tabela `projeto_link`. Frontend: extensão do modal de edição de projetos existente com o mesmo editor e mesma interface de links.

---

## Technical Context

**Language/Version**: Node.js 22, ES modules
**Primary Dependencies**: Hono (web framework), mysql2/promise (MariaDB), Alpine.js CDN, Tailwind CSS CDN, Quill CDN
**Storage**: MariaDB — tabela `projeto` (ALTER: +notas), nova tabela `projeto_link`
**Testing**: Smoke test manual (sem testes automatizados)
**Target Platform**: Docker container, UNRAID
**Project Type**: Web application (single-user, no build step)
**Performance Goals**: N/A — single-user tool
**Constraints**: Sem build step; Alpine.js + Tailwind CDN only; SQL parametrizado sempre
**Scale/Scope**: < 20 links por projeto; volume pequeno

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Sem build step no frontend | ✅ PASS | Quill já é carregado via CDN; sem novo bundler |
| SQL parametrizado | ✅ PASS | Todas as queries usarão `?` com array de parâmetros |
| Migrations imutáveis e sequenciais | ✅ PASS | 013 + 014, criação apenas — sem drop de coluna legada |
| Sem autenticação complexa | ✅ PASS | Sem mudanças no sistema de autenticação |
| Sem abstrações desnecessárias | ✅ PASS | Reutiliza padrão existente, sem novas camadas |

---

## Project Structure

### Documentation (this feature)

```text
specs/010-project-notes-links/
├── plan.md              ✅ Este arquivo
├── research.md          ✅ Decisões técnicas
├── data-model.md        ✅ Schema projeto + projeto_link
├── quickstart.md        ✅ Sequência de deploy e testes manuais
├── contracts/api.md     ✅ Contratos dos endpoints
└── tasks.md             🔜 Gerado por /speckit.tasks
```

### Source Code (repository root)

```text
migrations/
├── 013_add_projeto_notas.sql      # ALTER TABLE projeto ADD COLUMN notas
└── 014_add_projeto_link.sql       # CREATE TABLE projeto_link

src/routes/
└── projects.js                    # Estender: GET /:id/detail, POST, PUT

public/
├── index.html                     # Estender modal de edição de projetos
└── assets/app.js                  # Estender estado e métodos Alpine.js
```

**Structure Decision**: Single project, web application. Sem novos arquivos de rota — apenas extensão de `projects.js` existente.

---

## Implementation Notes

### Backend (`src/routes/projects.js`)

1. **GET /api/projects/:id/detail** — novo endpoint:
   - Query: SELECT projeto + LEFT JOIN projeto_instituicao + SELECT projeto_link WHERE projeto_id = ? ORDER BY ordem
   - Retorna: `{ id, nome, ativo, notas, instituicao_ids, instituicao_nomes, links: [{id, nome, url, ordem}] }`

2. **POST /api/projects** — estender para aceitar `notas` e `links`:
   - `notas = body.notas ?? null`
   - `INSERT INTO projeto (nome, ativo, notas)` (adicionar notas ao INSERT)
   - Links: após INSERT projeto, loop `INSERT IGNORE INTO projeto_link (projeto_id, nome, url, ordem)`
   - Filtro: links com `url` vazia são ignorados; `nome` pode ser null

3. **PUT /api/projects/:id** — estender:
   - `UPDATE projeto SET nome=?, ativo=?, notas=? WHERE id=?`
   - `DELETE FROM projeto_link WHERE projeto_id=?`
   - Loop INSERT links (mesmo padrão do POST)

4. **fetchProjectById** — estender para incluir `notas` no SELECT e buscar links separadamente.

### Frontend (`public/assets/app.js`)

1. **Nova variável de módulo**: `let _quillProjectEditor = null`

2. **Estado** (adicionar em `app()`):
   ```js
   projectLinks: [],
   projectLinkNome: '',
   projectLinkUrl: '',
   ```
   - `projectForm` ganha campo `notas: ''`

3. **Métodos novos**:
   - `addProjectLink()` — push em `projectLinks` se url não vazia, limpa campos
   - `removeProjectLink(index)` — splice
   - `loadProjectNotasIntoQuill(quill, notas)` — mesmo padrão de `loadNotasIntoQuill`

4. **Modificações**:
   - `openProjectForm()` — ao editar (tem id): chamar `GET /api/projects/:id/detail`, popular `projectLinks`, inicializar Quill no `#quill-project-editor`
   - `saveProject()` — incluir `notas` (do editor Quill) e `links` (do array `projectLinks`) no payload
   - `closeProjectForm()` — limpar `projectLinks`, resetar `_quillProjectEditor = null` (se DOM removido com x-if)

### Frontend (`public/index.html`)

No modal de edição de projetos (`showProjectForm`), adicionar após o campo "Ativo":

1. **Seção Links**:
   - Campo URL (input text, `x-model="projectLinkUrl"`)
   - Campo Nome (input text, `x-model="projectLinkNome"`)
   - Botão Adicionar (`:disabled="!projectLinkUrl.trim()"`)
   - Lista de links com botão remover (mesmo padrão visual das reuniões)

2. **Seção Notas**:
   - Container `#quill-project-editor` com wrapper (mesmo padrão de `#quill-editor-wrapper`)

### Migrations

```sql
-- 013_add_projeto_notas.sql
ALTER TABLE projeto
  ADD COLUMN notas TEXT NULL AFTER ativo;

-- 014_add_projeto_link.sql
CREATE TABLE IF NOT EXISTS `projeto_link` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `projeto_id` INT UNSIGNED  NOT NULL,
  `nome`       VARCHAR(500)  NULL,
  `url`        VARCHAR(2048) NOT NULL,
  `ordem`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `criado_em`  DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_projeto_link` (`projeto_id`, `url`(500)),
  KEY `idx_projeto_link_projeto_ordem` (`projeto_id`, `ordem`),
  CONSTRAINT `fk_projeto_link_projeto`
    FOREIGN KEY (`projeto_id`) REFERENCES `projeto`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
