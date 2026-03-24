# Research: Notas e Links em Projetos

**Feature**: 010-project-notes-links
**Date**: 2026-03-24

---

## Decision 1 — Armazenamento de notas

**Decision**: Campo `notas TEXT NULL` adicionado diretamente na tabela `projeto` via `ALTER TABLE`.

**Rationale**: Idêntico ao padrão estabelecido em `reuniao.notas` (migration `009_add_notas.sql`). O conteúdo é um delta JSON do Quill editor, armazenado como TEXT. NULL significa sem notas.

**Alternatives considered**: Tabela separada `projeto_nota` — rejeitada por ser overengineering para um campo 1:1 simples.

---

## Decision 2 — Tabela de links dos projetos

**Decision**: Nova tabela `projeto_link` com colunas `id`, `projeto_id` (FK → projeto), `nome VARCHAR(500) NULL`, `url VARCHAR(2048) NOT NULL`, `ordem SMALLINT UNSIGNED`, `criado_em`. UNIQUE KEY em `(projeto_id, url(500))`.

**Rationale**: Espelha a tabela `link` (migration `010_add_link.sql`) para manter consistência estrutural. Diferença importante: `nome` é **nullable** aqui porque a spec exige suporte a links sem nome (AC #5 — exibir URL como texto de exibição). Na tabela `link` original, `nome` é NOT NULL.

**Alternatives considered**: Reutilizar a tabela `link` adicionando `projeto_id` como alternativa a `reuniao_id` — rejeitada por violar o princípio de separação de responsabilidades e complicar as queries.

---

## Decision 3 — Números de migration

**Decision**:
- `013_add_projeto_notas.sql` — `ALTER TABLE projeto ADD COLUMN notas TEXT NULL`
- `014_add_projeto_link.sql` — `CREATE TABLE IF NOT EXISTS projeto_link`

**Rationale**: O último migration existente é `012_drop_projeto_instituicao_col.sql`. Não há coluna legada a remover — nenhum migration de drop necessário.

---

## Decision 4 — Endpoint de detalhe do projeto

**Decision**: Novo endpoint `GET /api/projects/:id/detail` que retorna o projeto completo com `notas` e array `links`.

**Rationale**: Mesmo padrão de `GET /api/meetings/:id/detail`. O endpoint de listagem `GET /api/projects` não deve carregar notas e links para todos os projetos (desnecessário e custoso). O detalhe é carregado apenas ao abrir o formulário de edição.

**Alternatives considered**: Incluir notas e links no GET de listagem — rejeitado por overhead desnecessário.

---

## Decision 5 — Quill editor para projetos

**Decision**: Nova instância privada `_quillProjectEditor` (variável de módulo em `app.js`), separada de `_quillEditor` (reuniões) e `_quillViewer` (visualização). Inicializada no elemento `#quill-project-editor` ao abrir o modal de edição do projeto.

**Rationale**: As três instâncias Quill coexistem em partes distintas do DOM (modal de reunião, modal de visualização, modal de projeto). Manter instâncias separadas evita conflitos de estado entre modais.

---

## Decision 6 — Integração no frontend

**Decision**:
- `projectForm` ganha campo `notas: ''`
- Novo array de estado `projectLinks: []` para gerenciar links no formulário
- `openProjectForm(project)` e `editProject(project)` chamam `GET /api/projects/:id/detail` para carregar notas + links
- `saveProject()` inclui `notas` e `links` no payload PUT/POST
- `addProjectLink()`, `removeProjectLink(index)` gerenciam o array `projectLinks`

**Rationale**: Segue exatamente o mesmo padrão do formulário de reuniões (`this.links`, `addLink()`, `removeLink()`).
