# Feature Specification: Tabela de Participantes e Seleção em Reuniões

**Feature Branch**: `002-add-participantes`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "Adicionar tabela de participantes migrada do CSV, relacionada com reuniões, com seleção de participantes no formulário de criação/edição de reuniões."

## Clarifications

### Session 2026-03-15

- Q: O que acontece com a coluna `participantes` TEXT existente na tabela `reuniao`? → A: Migrar dados legados para a tabela de junção (por correspondência de nome) e remover a coluna TEXT.
- Q: Qual campo define a unicidade de um participante (para idempotência da migração)? → A: Nome completo apenas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Selecionar Participantes ao Criar ou Editar Reunião (Priority: P1)

O usuário, ao registrar uma nova reunião ou editar uma existente, seleciona os participantes a partir de uma lista pré-carregada com todos os participantes cadastrados. Não é mais necessário digitar nomes manualmente.

**Why this priority**: Esta é a funcionalidade central visível ao usuário. Sem ela, a tabela de participantes não agrega valor para o uso diário do sistema.

**Independent Test**: Pode ser testado abrindo o formulário de reunião e verificando que a lista de participantes é exibida com múltipla seleção. Entregará valor imediato ao usuário ao eliminar erros de digitação nos nomes.

**Acceptance Scenarios**:

1. **Given** o formulário de criação de reunião está aberto, **When** o usuário acessa o campo de participantes, **Then** é exibida uma lista pesquisável com todos os participantes cadastrados (nome, instituição).
2. **Given** a lista de participantes está visível, **When** o usuário seleciona um ou mais participantes, **Then** os selecionados ficam destacados e são incluídos na reunião ao salvar.
3. **Given** uma reunião existente com participantes, **When** o usuário abre o formulário de edição, **Then** os participantes previamente associados estão pré-selecionados na lista.
4. **Given** o formulário de criação/edição está aberto, **When** o usuário digita um trecho do nome ou instituição no campo de busca de participantes, **Then** a lista é filtrada em tempo real exibindo apenas os participantes correspondentes.
5. **Given** o formulário é submetido sem nenhum participante selecionado, **When** o sistema valida os dados, **Then** é exibido um erro informando que ao menos um participante é obrigatório.

---

### User Story 2 - Dados de Participantes Disponíveis no Sistema (Priority: P2)

Os dados dos participantes presentes no arquivo CSV são carregados para o banco de dados por meio de um script de migração. Após a migração, todos os participantes históricos estão disponíveis para seleção nas reuniões.

**Why this priority**: Sem os dados no banco, a lista de seleção estará vazia. É pré-requisito para a Story 1, mas é uma operação única de setup feita pelo administrador.

**Independent Test**: Pode ser testado executando o script de migração e verificando que todos os participantes do CSV aparecem disponíveis para seleção. Entregará valor ao popular a base para uso imediato.

**Acceptance Scenarios**:

1. **Given** o script de migração é executado com as credenciais de administrador, **When** a execução termina com sucesso, **Then** todos os registros válidos do CSV estão presentes na tabela de participantes no banco de dados.
2. **Given** o CSV contém aproximadamente 383 participantes, **When** a migração é concluída, **Then** o banco possui todos os participantes com nome preenchido.
3. **Given** um participante do CSV possui campos vazios (cargo, e-mail), **When** a migração ocorre, **Then** o registro é importado com os campos disponíveis e os campos ausentes ficam nulos.
4. **Given** o script de migração já foi executado anteriormente, **When** é executado novamente, **Then** nenhum registro duplicado é criado (unicidade por nome completo).

---

### User Story 3 - Migração de Dados Legados de Participantes (Priority: P2)

Os registros existentes na tabela `reuniao`, que possuem participantes armazenados como texto livre na coluna `participantes`, são migrados para associações na tabela de junção. A coluna TEXT é removida ao final.

**Why this priority**: Garante que o histórico de reuniões não perca seus vínculos de participantes após a transição para a estrutura relacional.

**Independent Test**: Pode ser testado verificando que reuniões históricas exibem participantes após a migração legada, e que a coluna `participantes` TEXT não existe mais no schema.

**Acceptance Scenarios**:

1. **Given** reuniões existentes com texto na coluna `participantes`, **When** o script de migração legada é executado, **Then** cada nome identificado no texto que corresponder (por nome completo) a um participante cadastrado é vinculado à reunião na tabela de junção.
2. **Given** um nome no texto legado não encontrar correspondência na tabela de participantes, **When** a migração ocorre, **Then** esse nome é registrado em log como não associado (sem falha na migração).
3. **Given** a migração legada foi concluída, **When** o schema é atualizado, **Then** a coluna `participantes` TEXT é removida da tabela `reuniao`.

---

### User Story 4 - Visualizar Participantes de uma Reunião (Priority: P3)

Ao visualizar os detalhes de uma reunião na listagem ou detalhe, os participantes são exibidos pelos seus nomes completos (e opcionalmente instituição), não por identificadores internos.

**Why this priority**: Melhora a legibilidade dos dados exibidos. Depende das Stories anteriores estarem implementadas.

**Independent Test**: Pode ser testado abrindo os detalhes de uma reunião que tenha participantes associados e verificando que nomes são exibidos de forma legível.

**Acceptance Scenarios**:

1. **Given** uma reunião possui participantes associados, **When** o usuário visualiza a lista de reuniões ou os detalhes de uma reunião, **Then** os nomes dos participantes são exibidos de forma legível.
2. **Given** uma reunião possui múltiplos participantes, **When** os detalhes são exibidos, **Then** todos os participantes são listados.

---

### Edge Cases

- O que acontece se o script de migração for executado mais de uma vez? A operação deve ser idempotente (unicidade por nome completo — não cria duplicatas).
- O que acontece ao buscar participantes com caracteres especiais (acentos, cedilha)? A busca deve funcionar corretamente com caracteres do português.
- O que acontece com nomes no texto legado que não corresponderem a nenhum participante cadastrado? São registrados em log e ignorados sem interromper a migração.
- O que acontece se a lista de participantes crescer muito? A pesquisa com filtro por nome/instituição deve tornar a seleção prática.
- O que acontece se o arquivo `/docs/source/scripts/` for acidentalmente commitado? O `.gitignore` deve impedir isso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE disponibilizar uma lista pesquisável de participantes para seleção no formulário de reunião.
- **FR-002**: O sistema DEVE permitir a seleção de múltiplos participantes para uma reunião.
- **FR-003**: O sistema DEVE persistir a associação entre reunião e participantes selecionados na tabela de junção.
- **FR-004**: O sistema DEVE pré-preencher os participantes associados ao abrir o formulário de edição de uma reunião existente.
- **FR-005**: O sistema DEVE validar que ao menos um participante seja selecionado ao criar ou editar uma reunião.
- **FR-006**: O sistema DEVE disponibilizar um script de migração para importar os dados do arquivo CSV para a tabela de participantes.
- **FR-007**: O script de migração DEVE ser idempotente: a unicidade de participante é definida pelo nome completo; executá-lo múltiplas vezes não duplica registros.
- **FR-008**: O script de migração e suas credenciais de administrador DEVEM ser armazenados em `/docs/source/scripts/`, diretório que NUNCA deve ser commitado no repositório remoto (deve estar no `.gitignore`).
- **FR-009**: O sistema DEVE expor uma API para listar participantes, com suporte a filtro por nome ou instituição.
- **FR-010**: O campo de busca de participantes no formulário DEVE filtrar por nome e por instituição.
- **FR-011**: Os participantes de uma reunião DEVEM ser exibidos pelos seus nomes ao visualizar os detalhes da reunião.
- **FR-012**: O script de migração DEVE percorrer os registros existentes de `reuniao`, identificar nomes no campo TEXT por correspondência exata com o nome completo de participantes cadastrados, e criar as associações na tabela de junção.
- **FR-013**: Nomes do texto legado que não encontrarem correspondência DEVEM ser registrados em log como não associados (sem causar falha).
- **FR-014**: Após a migração legada, a coluna `participantes` TEXT DEVE ser removida da tabela `reuniao`.

### Key Entities *(include if feature involves data)*

- **Participante**: Pessoa que pode participar de reuniões. Atributos: nome completo (obrigatório, único), instituição (opcional), cargo (opcional), e-mail (opcional). Identificado por um ID único. Unicidade definida por nome completo.
- **Reunião** (existente): Registro de uma reunião. A coluna `participantes` TEXT será removida; a relação passa a ser exclusivamente via tabela de junção.
- **Associação Reunião-Participante**: Associação entre uma reunião e um participante. Permite que uma reunião tenha vários participantes e um participante esteja em várias reuniões (relação muitos-para-muitos).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário consegue criar uma reunião completa com participantes selecionados da lista em menos de 2 minutos.
- **SC-002**: A busca de participantes por nome ou instituição filtra os resultados de forma instantânea (sem recarregar a página).
- **SC-003**: 100% dos registros válidos (com nome preenchido) do CSV de participantes são importados com sucesso pelo script de migração.
- **SC-004**: O script de migração pode ser executado múltiplas vezes sem criar registros duplicados (unicidade por nome completo).
- **SC-005**: Após a migração legada, todos os registros de `reuniao` que possuíam participantes no campo TEXT têm ao menos uma associação na tabela de junção (para os nomes que tiverem correspondência).
- **SC-006**: A coluna `participantes` TEXT é removida da tabela `reuniao` ao final da migração.

## Assumptions

- A unicidade de participante é definida pelo nome completo. Dois registros com o mesmo nome são considerados a mesma pessoa.
- A migração legada usa correspondência exata por nome. Nomes parciais, apelidos ou variações de grafia no texto livre podem não ser associados.
- O número de participantes em uma única reunião é razoável (dezenas, não centenas).
- A lista de participantes é relativamente estável; não é necessário interface para adicionar/editar/remover participantes no escopo desta feature (dados vêm da migração CSV).
- O arquivo `/docs/source/scripts/` deve ser adicionado ao `.gitignore` para garantir que nunca seja comitado.
