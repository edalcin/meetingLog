# Research: Projetos Multi-Institucionais

**Feature**: 008-multi-institution-projects
**Date**: 2026-03-23

---

## Decision 1: Reuse existing `projeto_instituicao` junction table

**Decision**: Aproveitar a tabela `projeto_instituicao` já criada em `007_add_instituicoes.sql`, sem alteração de schema.

**Rationale**: A tabela já existe com as constraints corretas (FK CASCADE, PK composta). Não é necessária nenhuma migration de criação.

**Alternatives considered**: Criar uma nova tabela — rejeitado por ser redundante e violar I.5 (migrations imutáveis).

---

## Decision 2: Estratégia de migração de dados legados

**Decision**: Script Node.js em `docs/source/scripts/` que faz `INSERT IGNORE INTO projeto_instituicao SELECT p.id, i.id FROM projeto p JOIN instituicao i ON LOWER(p.instituicao) = LOWER(i.sigla) WHERE p.instituicao IS NOT NULL`. Logs de registros sem correspondência. Migration `012_drop_projeto_instituicao_col.sql` executada depois.

**Rationale**: Preserva dados existentes com custo mínimo. INSERT IGNORE garante idempotência (pode rodar mais de uma vez sem duplicatas, pois a PK composta impede inserção duplicada). Segue a sequência canônica da Constitution II.1.

**Alternatives considered**: Descartar dados — rejeitado pelo usuário (resposta Q1). Migration SQL pura sem script — rejeitado porque não produz logs de não-matches.

---

## Decision 3: UX de seleção múltipla — creatable input com ENTER

**Decision**: Seguir exatamente o padrão `handleParticipantEnter()` (app.js:503-513) adaptado para múltiplas instituições. ENTER: match exato case-insensitive → seleciona; sem match → cria e seleciona. Estado: `Set` de IDs (como `selectedParticipantIds`).

**Rationale**: Padrão já validado pelo usuário em participantes. Consistência de UX. Código de referência já existe no projeto.

**Alternatives considered**: Mini-formulário separado — rejeitado pelo usuário (resposta Q2). Botão fixo "+" — rejeitado pelo usuário.

---

## Decision 4: Campo de busca abre com todas as opções ao focar

**Decision**: `filteredProjectInstOptions` retorna `this.institutionListAll.filter(i => !alreadySelected)` quando query vazia — exibe todas as instituições não selecionadas imediatamente ao focar.

**Rationale**: Padrão consistente com `filteredProjectInstOptions` atual (retorna `.slice(0, 50)` quando vazio). Para dataset pequeno (ferramenta single-user), ver todas as opções disponíveis é mais produtivo.

**Alternatives considered**: Exigir ≥1 caractere — rejeitado pelo usuário (resposta Q3).

---

## Decision 5: Remoção da propagação de sigla em institutions.js

**Decision**: Remover a linha `UPDATE projeto SET instituicao=? WHERE instituicao=?` em `src/routes/institutions.js` (linha ~72) durante esta feature, pois a coluna legada será removida pela migration 012.

**Rationale**: Após a migration, a coluna não existe mais. Manter a query causaria erro de SQL. A relação de instituição com projeto passa a ser gerenciada pela junction table, que já tem FK CASCADE adequada.

**Alternatives considered**: Deixar a query e ignorar o erro — rejeitado por violar I.3 (queries parametrizadas devem ser corretas) e introduzir comportamento indefinido.

---

## Decision 6: Sequência de deploy

**Sequência correta** (seguindo Constitution II.1 adaptada):

1. Executar o script de migração de dados (`migrate_projeto_instituicao.js`) **antes** de remover a coluna — lê `projeto.instituicao` e popula `projeto_instituicao`
2. Deploy do novo código (que passa a usar apenas `projeto_instituicao`)
3. Executar `npm run migrate` para aplicar `012_drop_projeto_instituicao_col.sql`

**Atenção**: NÃO rodar `npm run migrate` antes do script de dados, pois a migration 012 remove a coluna de origem.

---

## Impacto em outros módulos

| Módulo | Linha | Mudança necessária |
|--------|-------|-------------------|
| `src/routes/institutions.js` | ~72 | Remover propagação `UPDATE projeto SET instituicao=?` |
| `public/assets/app.js` | 130-134 | `projInstituicaoOptions`: usar `instituicao_nomes` (string) |
| `public/assets/app.js` | 232 | `filteredProjectList`: filtrar por `instituicao_nomes` |
| `public/assets/app.js` | 271 | `filteredProjects` (reunião form): filtrar por `instituicao_nomes` |
| `public/assets/app.js` | 120 | `filteredProjectsForFilter`: filtrar por `instituicao_nomes` |
| `public/assets/app.js` | 1157-1163 | Remover handlers de propagação de sigla em projetos |
| `public/index.html` | 221, 260, 641, 965 | Trocar `pr.instituicao` por `pr.instituicao_nomes` |
