# Feature Specification: Adicionar Tabela de Pauta às Reuniões

**Feature Branch**: `004-adicionar-tabela-pauta-vinculada-a-reuniao-com-migracao-de-dados-csv-e-card-de-pautas-no-formulario-de-reunioes`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Quero adicionar agora a tabela de 'pauta'. A tabela está em /docs/source/memoriaReunioes-Pauta.csv. Esta tabela deve ser migrada para o banco de dados em MariaDB. Esta tabela deve se relacionar com a tabela 'reuniao', através da coluna 'data_hora'. Um registro em 'reuniao' pode se relacionar com mais de um registro em 'pauta'. Na entrada de um novo registro de reunião, e na edição de um registro de reunião, crie um 'card' com as pautas desta reunião, onde posso incluir mais de uma pauta por reunião."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualizar pautas no formulário de reunião (Priority: P1)

Ao abrir o formulário de criação ou edição de uma reunião, o usuário vê uma seção dedicada às pautas desta reunião. Na edição, as pautas já cadastradas aparecem listadas. Na criação, a lista começa vazia.

**Why this priority**: É o núcleo da funcionalidade — sem visualização não há utilidade para os dados de pauta.

**Independent Test**: Abrir o formulário de edição de uma reunião que possui pautas migradas do CSV e verificar que elas aparecem listadas no card de pautas.

**Acceptance Scenarios**:

1. **Given** o usuário abre o formulário de edição de uma reunião com pautas cadastradas, **When** o formulário é exibido, **Then** todas as pautas dessa reunião aparecem listadas em um card/seção dedicada, cada uma em linha separada.
2. **Given** o usuário abre o formulário de criação de nova reunião, **When** o formulário é exibido, **Then** o card de pautas aparece vazio, pronto para adição.
3. **Given** uma reunião sem pautas cadastradas, **When** o formulário de edição é aberto, **Then** o card de pautas aparece vazio (sem mensagem de erro).

---

### User Story 2 - Adicionar pautas ao criar ou editar uma reunião (Priority: P1)

O usuário pode adicionar uma ou mais pautas a uma reunião diretamente no formulário, digitando o texto da pauta e clicando no botão "+" ou "Adicionar" ao lado do campo. É possível adicionar múltiplas pautas na mesma sessão sem sair do formulário.

**Why this priority**: A capacidade de inserir pautas é tão fundamental quanto visualizá-las.

**Independent Test**: Criar uma nova reunião, adicionar duas pautas no card, salvar e verificar que as pautas aparecem ao reabrir o formulário de edição.

**Acceptance Scenarios**:

1. **Given** o formulário de reunião está aberto, **When** o usuário digita um texto de pauta e confirma, **Then** a pauta aparece na lista do card.
2. **Given** o usuário adicionou uma pauta, **When** adiciona uma segunda pauta, **Then** ambas aparecem listadas sem que a primeira seja removida.
3. **Given** o usuário salva a reunião com pautas adicionadas, **When** reabre o formulário de edição dessa reunião, **Then** todas as pautas salvas aparecem listadas.

---

### User Story 3 - Remover pauta de uma reunião (Priority: P2)

O usuário pode remover uma pauta individual de uma reunião, seja durante a criação ou na edição.

**Why this priority**: Complementa a adição; erros de digitação devem poder ser corrigidos.

**Independent Test**: Editar uma reunião com duas pautas, remover uma delas, salvar e verificar que apenas a pauta restante persiste.

**Acceptance Scenarios**:

1. **Given** o card de pautas lista duas pautas, **When** o usuário remove uma delas, **Then** apenas a pauta removida desaparece da lista, a outra permanece.
2. **Given** o usuário remove uma pauta e salva, **When** reabre o formulário, **Then** a pauta removida não aparece mais.

---

### User Story 4 - Editar o texto de uma pauta existente (Priority: P3)

O usuário pode editar o texto de uma pauta já cadastrada diretamente no card, sem precisar remover e adicionar novamente.

**Why this priority**: Conveniência; a alternativa (remover + adicionar) já atende o caso de uso.

**Independent Test**: Editar o texto de uma pauta existente e verificar que a alteração é salva corretamente.

**Acceptance Scenarios**:

1. **Given** o card lista uma pauta existente, **When** o usuário edita o texto e salva a reunião, **Then** o novo texto da pauta é persistido.

---

### Edge Cases

- O que acontece se o usuário tentar salvar uma reunião com uma pauta em branco?
  → Pautas sem texto não devem ser salvas; a linha vazia deve ser ignorada ou rejeitada com aviso.
- O que acontece com registros do CSV que possuem `data_hora` mas nenhuma reunião correspondente no banco?
  → Registros órfãos são registrados no log do script de migração e ignorados.
- O que acontece com registros do CSV com `data_hora` vazio?
  → Devem ser ignorados na migração e registrados no log.
- O que acontece com registros do CSV com texto de pauta vazio?
  → Devem ser ignorados na migração (sem inserção de linha em branco).
- Uma reunião pode ter zero pautas?
  → Sim. Pautas são opcionais.

---

## Clarifications

### Session 2026-03-19

- Q: As pautas devem ser exibidas como coluna/campo na tabela de listagem de reuniões? → A: Não — pautas visíveis apenas no formulário de edição da reunião (opção B).
- Q: Qual o mecanismo de confirmação de uma nova pauta no card? → A: Botão explícito ("+" ou "Adicionar") ao lado do campo de texto (opção A).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE criar uma tabela `pauta` no banco de dados com ao menos: identificador único, texto da pauta (obrigatório) e referência à reunião vinculada.
- **FR-002**: Cada registro de pauta DEVE estar vinculado a exatamente uma reunião (relação N:1 de pauta para reunião).
- **FR-003**: Uma reunião PODE ter zero ou mais pautas associadas.
- **FR-004**: O formulário de criação de reunião DEVE incluir um card de pautas com um campo de texto e um botão "+" ou "Adicionar" para confirmar cada pauta individualmente antes de salvar.
- **FR-005**: O formulário de edição de reunião DEVE exibir as pautas já cadastradas e permitir adição, edição e remoção de pautas.
- **FR-006**: Ao salvar uma reunião, as pautas listadas no card DEVEM ser persistidas (criadas, atualizadas ou removidas conforme o estado final do card).
- **FR-007**: Pautas com texto vazio NÃO DEVEM ser salvas.
- **FR-008**: A API DEVE expor endpoints para listar, criar, atualizar e remover pautas de uma reunião.
- **FR-013**: As pautas NÃO DEVEM aparecer na tabela de listagem de reuniões — são visíveis exclusivamente no formulário de edição/criação da reunião.
- **FR-009**: Um script de migração DEVE importar os dados históricos do CSV `memoriaReunioes-Pauta.csv` para a tabela `pauta`, vinculando cada registro à reunião correspondente pelo campo `data_hora`.
- **FR-010**: O script de migração DEVE gerar um log registrando todos os registros ignorados (data_hora vazio, pauta vazia ou reunião não encontrada no banco).
- **FR-011**: O script de migração e suas credenciais DEVEM residir em `docs/source/scripts/` e NUNCA ser versionados no repositório remoto (via `.gitignore`).
- **FR-012**: O script de migração DEVE ser idempotente: executá-lo mais de uma vez não deve duplicar registros já existentes.

### Key Entities

- **Pauta**: Item de agenda de uma reunião. Atributos: identificador único, texto da pauta (não vazio), referência à reunião à qual pertence, e posição de exibição (para manter ordem de inserção).
- **Reunião** (existente): Já possui identificador, data/hora, tipo, participantes e projetos. Passa a ter também uma lista ordenada de pautas associadas.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos registros válidos do CSV (com data_hora, texto de pauta não vazios, e reunião correspondente no banco) são migrados sem perda de dados.
- **SC-002**: O usuário consegue adicionar e visualizar pautas de uma reunião sem abandono de formulário (tudo na mesma tela).
- **SC-003**: Nenhuma pauta com texto vazio é armazenada no banco de dados, independentemente de como o formulário for submetido.
- **SC-004**: O script de migração pode ser executado mais de uma vez sem duplicar registros (idempotência verificável por contagem de registros).
- **SC-005**: As pautas históricas migradas do CSV são visíveis nos formulários de edição das respectivas reuniões imediatamente após a migração.

---

## Assumptions

- A correspondência entre CSV e reuniões no banco é feita por `data_hora` exato (incluindo hora e minuto). Reuniões com o mesmo horário mas datas diferentes são distintas.
- Os timestamps no CSV estão em formato ISO 8601 com offset de fuso horário (`-03:00`); o script deve normalizar conforme o fuso horário configurado no banco.
- A ordem de exibição das pautas é a ordem de inserção (não há ordenação manual pelo usuário neste momento).
- O card de pautas no formulário não requer salvamento intermediário — todas as alterações são confirmadas ao salvar a reunião.
- Pautas são texto livre sem limite de comprimento definido pelo usuário (o sistema aplica um limite razoável internamente).
- O diretório `docs/source/scripts/` já está ou será adicionado ao `.gitignore` para não ser versionado.
