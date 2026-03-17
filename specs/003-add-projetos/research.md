# Research: Add Projetos e Menu de Navegação

**Branch**: `003-add-projetos` | **Date**: 2026-03-17

---

## Decisão 1: Tipo de Relação reuniao–projeto

**Decision**: N:N (muitos-para-muitos) via tabela de junção `reuniao_projeto`

**Rationale**: O CSV `memoriaReunioes-Reuniao.csv` confirma que o campo `projeto` TEXT contém múltiplos projetos separados por vírgula (ex: `"MCTI - GEF/MCTI Entre-Ciências, Useflora"`). A spec define explicitamente "uma reunião pode estar relacionada a mais de um projeto". O padrão N:N via junction table é exatamente o mesmo já implementado para `reuniao_participante`.

**Alternatives considered**:
- N:1 (lookup): Descartado — confirmado que reuniões têm múltiplos projetos.
- Array em coluna JSON/TEXT: Descartado pela constituição (I.3 + padrão II.1).

---

## Decisão 2: Identificador único de `projeto`

**Decision**: `nome VARCHAR(255) UNIQUE NOT NULL`

**Rationale**: Igual ao padrão de `participante.nome`. O CSV não tem ID explícito; o nome é a chave natural de unicidade. Permite INSERT IGNORE idempotente no script de migração. O índice UNIQUE garante integridade mesmo em execuções repetidas.

**Alternatives considered**:
- Gerar UUID: Desnecessário para 49 registros num app single-user.
- Usar `nomeProj` como PK TEXT: Anti-padrão; INT UNSIGNED AUTO_INCREMENT como PK é mais eficiente para JOINs.

---

## Decisão 3: Campos da tabela `projeto`

**Decision**: `id`, `nome`, `ativo` (BOOLEAN), `instituicao` (VARCHAR NULL)

**Rationale**: Mapeamento direto do CSV (`nomeProj;ativo;instituicaoProjeto`). O campo `ativo` é BOOLEAN (0/1) — converte `VERDADEIRO`/`FALSO` do CSV. `instituicao` é NULL para projetos sem instituição associada (vários registros no CSV têm esse campo vazio).

---

## Decisão 4: Script de dados — estratégia de matching reuniao↔projeto

**Decision**: Parsing do campo TEXT `reuniao.projeto` por split em vírgula + trim, com lookup por `nome` LIKE exato na tabela `projeto`. INSERT IGNORE em `reuniao_projeto`.

**Rationale**: O campo `reuniao.projeto` usa os mesmos nomes do CSV (ex: `"Etnobotânica"`, `"MCTI - GEF/MCTI Entre-Ciências"`). Correspondência exata por nome é confiável. Log de nomes não encontrados para auditoria (sem falha silenciosa — padrão constituição II.4).

**Risk**: Nomes com espaços extras ou diferenças de codificação (acentos). Mitigação: `trim()` no split + charset `utf8mb4` no banco.

---

## Decisão 5: Número das migrations

**Decision**: `005_add_projetos.sql` + `006_drop_projeto_col.sql`

**Rationale**: Último arquivo existente é `004_drop_participantes_col.sql`. Seguindo numeração sequencial da constituição (IV.4). Duas migrations separadas obrigatórias (constituição II.1 — lição aprendida participantes): a 005 cria as tabelas, a 006 remove a coluna legada — executadas com script de dados entre elas.

---

## Decisão 6: Campo `ativo` na seleção do formulário de reunião

**Decision**: `GET /api/projects?activeOnly=true` para o campo de seleção; `GET /api/projects` retorna todos para a listagem de projetos.

**Rationale**: A spec (FR-008) define que apenas projetos ativos aparecem como opção nova no formulário. A tela de listagem (FR-004) exibe todos. Um único endpoint com parâmetro `activeOnly` evita duplicação de lógica.

---

## Decisão 7: Exibição de projetos inativos no formulário de edição

**Decision**: O backend retorna `projeto_ids` incluindo IDs de projetos inativos já associados. O frontend exibe projetos inativos como pré-selecionados (marcados com indicação visual de inativo), mas não os inclui em `filteredProjects` (lista de opções para nova seleção).

**Rationale**: Preserva integridade dos dados históricos (FR-008a). O frontend gerencia o estado: `selectedProjectIds` (Set) pode conter IDs de inativos; `filteredProjects` filtra apenas ativos não selecionados.

---

## Decisão 8: Menu de navegação

**Decision**: Tabs fixas no topo do `index.html` com Alpine.js `x-data="{ activeTab: 'meetings' }"`. Seções condicionais com `x-show`.

**Rationale**: Padrão mais simples possível para SPA sem roteamento. Já existe uma view única; adicionar `x-show` por tab não introduz complexidade. Nenhum bundler, nenhum router library — constituição I.1 + I.2.

---

## Decisão 9: `projeto_nomes` como campo computado via GROUP_CONCAT

**Decision**: Adicionar `GROUP_CONCAT(DISTINCT proj.nome ORDER BY proj.nome SEPARATOR ', ') AS projeto_nomes` e `GROUP_CONCAT(DISTINCT proj.id ORDER BY proj.nome) AS projeto_ids_str` ao SELECT de reuniões.

**Rationale**: Segue exatamente o padrão já implementado para participantes (constituição IV.2 + IV.3). A coluna `projeto` TEXT legada será removida pela migration 006 após a migração de dados.
