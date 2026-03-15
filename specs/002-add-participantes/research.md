# Research: Tabela de Participantes

**Branch**: `002-add-participantes` | **Date**: 2026-03-15

## Decision 1: Multi-select de participantes no frontend

**Decision**: Componente Alpine.js nativo (sem dependência externa) com lista filtrada reativa via getter computado.

**Rationale**: O projeto usa Alpine.js CDN sem build step. Implementar um multi-select nativo com `x-data`, `x-for`, e getter `filteredParticipants()` é suficiente para ~380 itens. A lista completa é carregada uma vez ao abrir o formulário e filtrada no lado cliente.

**Pattern**:
- Estado: `allParticipants[]`, `selectedIds` (Set), `participantSearch` (string), `showParticipantDropdown` (bool)
- Getter reativo: `filteredParticipants` filtra por nome e instituição usando `participantSearch`
- Submissão: `Array.from(selectedIds)` → `participante_ids: number[]`
- Pré-preenchimento (editar): ao carregar reunião, setar `selectedIds = new Set(m.participante_ids)`
- Performance: Set para O(1) lookup; 380 itens é gerenciável em memória sem paginação

**Alternatives considered**:
- Select2 / Choices.js: descartado — dependência externa, conflito com CDN-only approach
- `<select multiple>`: descartado — UX ruim para busca e seleção visual
- Lazy loading (API por keystroke): descartado — 380 itens é pequeno o suficiente para carregar de uma vez

---

## Decision 2: Estrutura de relacionamento N:N no banco

**Decision**: Tabela de junção `reuniao_participante (reuniao_id, participante_id)` com FK e CASCADE DELETE.

**Rationale**: Relação muitos-para-muitos canônica. CASCADE DELETE garante integridade ao deletar reunião (sem registros órfãos). Chave primária composta `(reuniao_id, participante_id)` previne duplicatas.

**Alternatives considered**:
- JSON array de IDs na coluna da reunião: descartado — não permite consultas relacionais nem integridade referencial
- Coluna TEXT com nomes: o padrão atual, sendo substituído exatamente por isso

---

## Decision 3: Idempotência da migração CSV

**Decision**: `INSERT IGNORE` (ou `INSERT ... ON DUPLICATE KEY UPDATE`) baseado na unicidade de `nome` (UNIQUE KEY na tabela `participante`).

**Rationale**: A restrição UNIQUE no campo `nome` garante que re-execuções do script nunca dupliquem registros. `INSERT IGNORE` descarta silenciosamente tentativas de inserir nome já existente.

**Alternatives considered**:
- Check + insert (SELECT → INSERT): mais verboso, sujeito a race condition
- REPLACE INTO: descartado — deleta e re-insere, mudando o `id` e quebrando FKs em `reuniao_participante`

---

## Decision 4: Sequência da migração de dados legados

**Decision**: O script de migração (em `/docs/source/scripts/`) executa APÓS a aplicação da migration SQL `003_add_participantes.sql`, em duas fases:
1. Importa CSV → `participante` (idempotente)
2. Lê coluna `participantes` TEXT existente de cada reunião → tenta associar nomes por correspondência exata → insere em `reuniao_participante` (ignora duplicatas)
3. A migration SQL `004_drop_participantes_col.sql` remove a coluna TEXT (executada depois do script de dados)

**Rationale**: Separar schema migration (commitada) de data migration (não commitada, com credenciais admin) é a abordagem padrão. A coluna TEXT permanece disponível durante o processo de migração de dados.

**Note sobre correspondência legada**: A coluna `participantes` contém texto livre. O script tentará correspondência exata por `nome`. Nomes parciais, apelidos ou variações de grafia resultarão em não-associação (logados, não falham).

**Alternatives considered**:
- Tudo em uma migration SQL: descartado — credenciais admin não podem estar em arquivo commitado
- Fuzzy matching (Levenshtein): descartado — complexidade desnecessária; o dado legado é suficientemente estruturado para correspondência exata

---

## Decision 5: API — resposta de participantes em reuniões

**Decision**: `GET /api/meetings` retorna `participantes_nomes` (string, nomes separados por vírgula) para compatibilidade com o display da tabela. `GET /api/meetings/:id` retorna `participantes: [{id, nome, instituicao}]` para o formulário de edição. `POST/PUT` aceitam `participante_ids: number[]`.

**Rationale**: Minimiza mudanças no template HTML da tabela de listagem (coluna Participantes continua funcionando). O detalhe completo é necessário apenas no formulário de edição.

**Alternatives considered**:
- Sempre retornar array de objetos: requer mais mudanças no frontend para a coluna da tabela
- IDs apenas em GET: requer lookup adicional no frontend

---

## Decision 6: Ordenação por participantes na listagem

**Decision**: Remover a opção de ordenar por `participantes` na listagem (era ordenação por TEXT, semanticamente inútil). Manter as demais colunas de ordenação.

**Rationale**: A coluna `participantes` TEXT não existirá mais. Ordenar por participantes em uma relação N:N requereria uma subconsulta complexa sem valor prático para o usuário.
