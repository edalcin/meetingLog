# Feature Specification: Melhorias nos Participantes — Lotação, Status Ativo/Inativo e Notas

**Feature Branch**: `011-enhance-participantes`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Quero adicionar o atributo Lotação ao participante; marcar participantes como ativos ou inativos (inativos não aparecem no autocomplete de reuniões); e adicionar Notas aos participantes da mesma forma que nos projetos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filtrar Participantes Inativos no Autocomplete (Priority: P1)

Ao registrar uma nova reunião, o usuário preenche a lista de participantes via autocomplete. Participantes marcados como "inativos" não devem aparecer nessa lista, evitando seleções equivocadas de pessoas que não atuam mais.

**Why this priority**: É a mudança de maior impacto operacional — afeta diretamente o fluxo de registro de reuniões, que é a principal operação do sistema. Participantes inativos poluindo o autocomplete causam erros no registro.

**Independent Test**: Pode ser testado independentemente marcando um participante existente como inativo via interface de manutenção e verificando que ele não aparece no campo de participantes ao criar/editar uma reunião.

**Acceptance Scenarios**:

1. **Given** um participante marcado como "inativo", **When** o usuário digita o nome dele no campo de participantes de uma reunião, **Then** o participante não aparece nas sugestões do autocomplete.
2. **Given** um participante marcado como "ativo", **When** o usuário digita o nome dele no campo de participantes de uma reunião, **Then** o participante aparece normalmente nas sugestões.
3. **Given** um participante previamente vinculado a reuniões e depois marcado como "inativo", **When** o usuário visualiza reuniões antigas, **Then** o participante ainda aparece normalmente nas reuniões já registradas (vínculo histórico preservado).

---

### User Story 2 - Gerenciar Status Ativo/Inativo de Participante (Priority: P2)

O usuário acessa a ficha de um participante na tela de manutenção e pode alternar seu status entre "ativo" e "inativo". Novos participantes são criados como "ativos" por padrão.

**Why this priority**: Depende da lógica de filtragem (P1), mas é a ação de gestão que alimenta esse filtro. Sem a interface de toggle, o filtro não tem como ser acionado pelo usuário.

**Independent Test**: Pode ser testado abrindo a ficha de qualquer participante, alternando o status e confirmando que a mudança persiste após salvar.

**Acceptance Scenarios**:

1. **Given** a tela de cadastro de novo participante, **When** o formulário é exibido, **Then** o campo de status está pré-selecionado como "Ativo".
2. **Given** um participante ativo na lista de manutenção, **When** o usuário edita a ficha e muda o status para "Inativo" e salva, **Then** o participante é salvo como inativo.
3. **Given** um participante inativo, **When** o usuário edita a ficha e muda o status para "Ativo" e salva, **Then** o participante volta a ser ofertado no autocomplete de reuniões.
4. **Given** a lista de participantes na tela de manutenção, **When** a lista é exibida, **Then** participantes inativos são identificados visualmente (ex.: rótulo ou estilo diferente).

---

### User Story 3 - Adicionar Campo Lotação ao Participante (Priority: P3)

O usuário pode registrar a "Lotação" de um participante — o departamento, unidade ou seção dentro da sua instituição. O campo é opcional e exibido entre a Instituição e o Cargo na ficha do participante.

**Why this priority**: Enriquece os dados do participante mas não altera nenhum fluxo existente. Pode ser implementado e entregue de forma totalmente independente.

**Independent Test**: Pode ser testado criando ou editando um participante, preenchendo o campo Lotação e verificando que ele é salvo e exibido corretamente na ficha e na lista.

**Acceptance Scenarios**:

1. **Given** o formulário de cadastro/edição de participante, **When** o formulário é exibido, **Then** o campo "Lotação" aparece entre os campos "Instituição" e "Cargo".
2. **Given** um participante com Lotação preenchida, **When** o usuário salva, **Then** o valor de Lotação é persistido e exibido na ficha.
3. **Given** um participante existente sem Lotação, **When** o usuário salva sem preencher o campo, **Then** o participante é salvo normalmente (campo opcional).
4. **Given** a lista de participantes na tela de manutenção, **When** o participante tem Lotação preenchida, **Then** a Lotação é exibida na linha do participante junto à instituição e cargo.

---

### User Story 4 - Adicionar Notas ao Participante (Priority: P4)

O usuário pode registrar notas livres na ficha do participante (histórico, observações, contexto). O campo aparece ao final da ficha tanto na criação quanto na edição, exatamente como nas fichas de projetos.

**Why this priority**: Funcionalidade complementar de enriquecimento de dados, independente dos demais itens. Prioridade mais baixa por ter o menor impacto nos fluxos principais.

**Independent Test**: Pode ser testado criando um novo participante com Notas preenchidas e verificando que o conteúdo é salvo e exibido corretamente; depois editando e alterando as notas.

**Acceptance Scenarios**:

1. **Given** o formulário de criação de novo participante, **When** o formulário é exibido, **Then** o campo "Notas" aparece ao final da ficha com editor de texto rico.
2. **Given** o formulário de edição de participante existente, **When** o formulário é exibido, **Then** o campo "Notas" aparece ao final da ficha com o conteúdo já salvo carregado.
3. **Given** um participante com Notas preenchidas, **When** o usuário salva, **Then** o conteúdo das notas é persistido e exibido corretamente na ficha.
4. **Given** um participante sem Notas, **When** o usuário salva sem preencher, **Then** o participante é salvo normalmente (campo opcional).

---

### Edge Cases

- O que acontece quando um participante inativo está vinculado a uma reunião sendo editada? O participante já vinculado deve continuar visível na edição da reunião, mas não deve aparecer nas sugestões ao adicionar novos participantes.
- O que acontece se o usuário tentar buscar participantes pela API sem filtro de status? A API de listagem geral (manutenção) retorna todos os participantes; apenas o endpoint de autocomplete filtra por ativos.
- Campo Lotação com texto muito longo: deve respeitar um limite razoável (ex.: 255 caracteres), consistente com os demais campos de texto curto da ficha.
- Reativação de participante inativo: ao reativar, o participante deve imediatamente voltar a aparecer no autocomplete de reuniões sem necessidade de ação adicional.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE adicionar o campo "Lotação" (texto livre, opcional, máx. 255 caracteres) à entidade participante, exibido na ordem: Instituição → Lotação → Cargo.
- **FR-002**: O sistema DEVE adicionar o campo "Ativo" (booleano) à entidade participante, com valor padrão "ativo" para novos registros.
- **FR-003**: O sistema DEVE adicionar o campo "Notas" (texto rico, opcional, sem limite fixo) à entidade participante, exibido ao final da ficha tanto no formulário de criação quanto no de edição.
- **FR-004**: O endpoint de autocomplete de participantes para registro de reuniões DEVE retornar apenas participantes marcados como "ativos", com busca textual cobrindo os campos nome, instituição e lotação.
- **FR-005**: A tela de manutenção de participantes DEVE permitir alterar o status ativo/inativo de um participante.
- **FR-006**: A tela de manutenção de participantes DEVE oferecer filtro de status "Todos / Ativos / Inativos" na lista de participantes, seguindo o mesmo padrão visual e de interação já existente na lista de Projetos.
- **FR-007**: O formulário de cadastro e edição de participante DEVE incluir os campos Lotação, Ativo e Notas nas posições corretas da ficha.
- **FR-008**: Participantes inativos vinculados a reuniões existentes DEVEM permanecer visíveis nessas reuniões (os vínculos históricos não são afetados pelo status).
- **FR-009**: A API de listagem de participantes para manutenção (não-autocomplete) DEVE retornar todos os participantes independentemente do status ativo/inativo, com o campo `ativo` no payload.

### Key Entities *(include if feature involves data)*

- **Participante**: Representa uma pessoa que pode participar de reuniões. Atributos: id, nome, instituição, lotação *(novo)*, cargo, email, ativo *(novo, booleano)*, notas *(novo, texto livre)*, data de criação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O campo "Lotação" está disponível em 100% dos formulários de cadastro e edição de participantes, na posição correta entre Instituição e Cargo.
- **SC-002**: Participantes inativos não aparecem nas sugestões de autocomplete ao registrar reuniões — verificável em 100% dos casos.
- **SC-003**: O usuário consegue alternar o status ativo/inativo de qualquer participante em no máximo 2 interações (editar + salvar).
- **SC-004**: O campo "Notas" está disponível na ficha de todos os participantes, ao final do formulário, comportando texto rico da mesma forma que as notas de projetos.
- **SC-005**: Nenhum vínculo histórico participante-reunião é alterado ou removido após a implementação da feature.

## Clarifications

### Session 2026-04-01

- Q: A lista de manutenção deve ter filtro de status ou apenas distinção visual? → A: Seguir o mesmo padrão da lista de Projetos — filtro "Todos / Ativos / Inativos".
- Q: A busca do autocomplete deve incluir o campo Lotação? → A: Sim — busca por nome, instituição e lotação.
- Q: O campo Notas deve aparecer no formulário de criação ou apenas no de edição? → A: Em ambos — criação e edição.

## Assumptions

- O editor de texto rico para Notas seguirá o mesmo padrão já adotado nos projetos (Quill CDN), mantendo consistência visual e de comportamento.
- A API de autocomplete de participantes já possui um ponto de entrada distinto do endpoint de listagem para manutenção; o filtro `ativo=true` será aplicado apenas no endpoint de autocomplete.
- A Lotação é um campo de texto livre (não é uma entidade separada com tabela própria), assim como Instituição e Cargo já são.
- Participantes inativos não são excluídos do sistema; apenas ficam invisíveis no autocomplete de reuniões.
- A exibição visual de participantes inativos na lista de manutenção e o filtro de status seguirão o mesmo padrão já adotado para projetos (filtro "Todos / Ativos / Inativos").
