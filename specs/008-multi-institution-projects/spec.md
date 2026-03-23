# Feature Specification: Projetos Multi-Institucionais

**Feature Branch**: `008-multi-institution-projects`
**Created**: 2026-03-23
**Status**: Draft
**Input**: User description: "Quero ajustar a relação entre Projetos e Instituições. Agora quero que os projetos possam se relacionar com mais de uma instituição - Projetos multi-institucionais. Permita que na entrada de um novo projeto e na edição de projetos o usuário possa associar mais de uma instituição ao projeto. Caso a instituição não esteja registrada na tabela de Instituições, será possível também adicionar, da mesma forma que adicionamos novos participantes na ficha de reunião."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Associar múltiplas instituições a um projeto (Priority: P1)

Ao criar ou editar um projeto, o usuário pode vincular uma ou mais instituições ao projeto usando um seletor com busca. Cada instituição selecionada aparece como uma "tag" removível na área do formulário. O usuário pode remover qualquer instituição adicionada antes de salvar.

**Why this priority**: É o núcleo da feature — sem isso o restante não faz sentido. Substitui o campo de texto livre atual por uma relação estruturada com múltiplas entradas.

**Independent Test**: Pode ser testado criando um projeto e vinculando 2 ou mais instituições já cadastradas, depois verificando que o projeto exibe corretamente todas as instituições associadas.

**Acceptance Scenarios**:

1. **Given** o formulário de criação de projeto está aberto, **When** o usuário digita parte do nome de uma instituição no campo de busca e seleciona uma sugestão, **Then** a instituição aparece como tag no formulário e não está mais disponível para nova seleção.
2. **Given** um projeto existente com 2 instituições vinculadas está em edição, **When** o usuário remove uma das tags de instituição e salva, **Then** o projeto passa a exibir apenas a instituição restante.
3. **Given** um projeto está sendo criado sem nenhuma instituição vinculada, **When** o usuário salva, **Then** o projeto é salvo com sucesso sem instituições.
4. **Given** o formulário de edição de projeto está aberto, **When** o usuário adiciona uma terceira instituição a um projeto que já tem duas, **Then** ao salvar o projeto exibe as três instituições.

---

### User Story 2 - Cadastrar nova instituição a partir do formulário de projeto (Priority: P2)

Ao preencher o formulário de projeto, caso a instituição desejada não exista no cadastro, o usuário digita o valor desejado no campo de busca de instituições e pressiona ENTER. O sistema cria a nova instituição com o valor digitado como sigla e a vincula imediatamente ao projeto.

**Why this priority**: Garante que o usuário não precise interromper o fluxo de cadastro de um projeto para ir até a tela de instituições. O fluxo é direto: digitar + ENTER = criar e vincular.

**Independent Test**: Pode ser testado digitando uma sigla inexistente no campo de instituições, pressionando ENTER, e verificando que a nova instituição aparece como tag vinculada ao projeto.

**Acceptance Scenarios**:

1. **Given** o campo de busca de instituições contém um texto que não corresponde a nenhuma instituição existente, **When** o usuário pressiona ENTER, **Then** uma nova instituição é criada com o valor digitado como sigla e aparece imediatamente como tag vinculada ao projeto.
2. **Given** o campo de busca contém um texto que corresponde exatamente a uma instituição existente, **When** o usuário pressiona ENTER, **Then** a instituição existente é selecionada e vinculada ao projeto (sem criar duplicata).
3. **Given** o campo de busca está vazio, **When** o usuário pressiona ENTER, **Then** nada acontece.
4. **Given** o usuário digitou uma sigla já existente com grafia diferente (ex: capitalização), **When** pressiona ENTER, **Then** o sistema trata como correspondência à instituição existente e a seleciona.

---

### User Story 3 - Visualizar instituições do projeto nas listagens e detalhes (Priority: P3)

As instituições vinculadas ao projeto são exibidas na lista de projetos e no painel de detalhes, substituindo o campo de texto livre anterior.

**Why this priority**: Garante que a informação multi-institucional seja visível em todos os pontos onde o projeto é apresentado, completando a experiência.

**Independent Test**: Pode ser testado verificando que a lista de projetos e o card de detalhes exibem corretamente as siglas/nomes das instituições vinculadas.

**Acceptance Scenarios**:

1. **Given** um projeto tem 3 instituições vinculadas, **When** o usuário visualiza a lista de projetos, **Then** as siglas das instituições são exibidas na linha do projeto (separadas por vírgula ou como tags).
2. **Given** um projeto tem instituições vinculadas, **When** o usuário abre o painel de detalhes do projeto, **Then** todas as instituições são listadas com sigla e nome completo.
3. **Given** um projeto sem instituições vinculadas, **When** exibido na lista, **Then** a coluna de instituição aparece vazia ou com indicador "—".

---

### Edge Cases

- O que acontece ao editar um projeto que ainda tem dados no campo legado `instituicao` (texto livre)? Os dados existentes são descartados na migration — documentado em Assumptions.
- O que acontece se o usuário tentar vincular a mesma instituição duas vezes a um projeto? A segunda seleção é silenciosamente ignorada.
- O que acontece ao excluir uma instituição que está vinculada a projetos? A constraint de chave estrangeira existente bloqueia a exclusão com erro de integridade referencial.
- O campo de busca com lista vazia (nenhuma instituição cadastrada): o botão "Criar nova" deve estar disponível para cadastrar a primeira.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir vincular zero ou mais instituições a um projeto, substituindo o campo de texto livre `instituicao`.
- **FR-002**: O formulário de criação de projeto DEVE apresentar um campo de busca de instituições que exibe todas as instituições cadastradas ao focar no campo, e filtra as sugestões à medida que o usuário digita.
- **FR-003**: O formulário de edição de projeto DEVE carregar e exibir as instituições atualmente vinculadas ao projeto como tags removíveis.
- **FR-004**: O usuário DEVE poder remover uma instituição vinculada clicando em um controle de remoção na tag, antes de salvar.
- **FR-005**: O campo de busca de instituições DEVE aceitar ENTER para criar uma nova instituição com o valor digitado como sigla, quando esse valor não corresponde a nenhuma instituição existente (comparação sem distinção de maiúsculas/minúsculas).
- **FR-006**: Uma nova instituição criada via ENTER DEVE ser imediatamente vinculada ao projeto em edição e persistida no cadastro de instituições. Se o valor digitado corresponder a uma instituição existente, a instituição existente é selecionada sem criar duplicata.
- **FR-007**: O sistema DEVE impedir a vinculação duplicada da mesma instituição ao mesmo projeto (ignorar silenciosamente tentativa de duplicata).
- **FR-008**: A lista de projetos DEVE exibir as instituições vinculadas a cada projeto.
- **FR-009**: O painel de detalhes de um projeto DEVE listar todas as instituições vinculadas com sigla e nome completo.
- **FR-010**: O sistema DEVE executar uma migration que: (1) tenta associar cada valor da coluna legada `instituicao` a uma sigla existente na tabela `instituicao`, criando o vínculo em `projeto_instituicao` quando há correspondência exata; (2) remove a coluna `instituicao` da tabela `projeto`.
- **FR-011**: A busca de projetos por texto DEVE funcionar também pelo nome ou sigla das instituições vinculadas.

### Key Entities

- **Projeto**: Registro de um projeto, identificado por nome único. Possui zero ou mais instituições vinculadas através de uma relação muitos-para-muitos.
- **Instituição**: Organização identificada por sigla única e nome opcional. Pode estar vinculada a múltiplos projetos.
- **Vínculo Projeto-Instituição**: Relação muitos-para-muitos entre Projeto e Instituição; uma mesma instituição pode participar de vários projetos e um projeto pode ter várias instituições.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário consegue vincular múltiplas instituições a um projeto em uma única sessão de edição, sem navegar para outra tela.
- **SC-002**: O usuário consegue criar e vincular uma nova instituição sem sair do formulário de projeto, em uma única sequência de ações.
- **SC-003**: Todos os projetos existentes continuam acessíveis após a migration, sem erros de aplicação ou perda de registros de projeto.
- **SC-004**: Nenhum formulário ou tela exibe o campo de texto livre legado de instituição após a feature ser implantada.
- **SC-005**: As instituições vinculadas ficam visíveis na lista de projetos e no painel de detalhes imediatamente após salvar o projeto.

## Assumptions

- A tabela de junção `projeto_instituicao` já existe na base de dados (criada em `007_add_instituicoes.sql`) e pode ser aproveitada sem alteração de schema.
- O campo legado `instituicao VARCHAR(255)` na tabela `projeto` será removido via migration após tentativa de migração automática dos dados existentes (ver Clarifications).
- O padrão de "criar inline" segue a mesma UX já existente no botão "+ Novo Participante" da ficha de reunião.
- Ao criar uma nova instituição via ENTER no campo de busca, o valor digitado é usado como `sigla`. O campo `nome` fica vazio (null) e pode ser preenchido posteriormente na tela de cadastro de instituições.
- A ordenação das instituições vinculadas a um projeto não é relevante para o usuário neste momento.

## Clarifications

### Session 2026-03-23

- Q: Ao migrar, o sistema deve tentar aproveitar os dados da coluna `instituicao` ou descartar tudo? → A: A migration tenta associar o valor de `instituicao` a uma sigla existente na tabela `instituicao`; se encontrar correspondência exata, cria o vínculo em `projeto_instituicao`. Se não encontrar, o projeto fica sem instituição vinculada. Após a migration, a coluna legada é removida.
- Q: Quando a opção de criar nova instituição deve ficar disponível no campo de busca? → A: O usuário digita o valor desejado (sigla) diretamente no campo de busca e pressiona ENTER. Se o valor não corresponder a nenhuma instituição existente (case-insensitive), o sistema cria e vincula a nova instituição. Sem mini-formulário separado.
- Q: O que o usuário vê ao focar no campo de busca de instituições antes de digitar? → A: Exibe todas as instituições cadastradas imediatamente ao focar no campo (sem precisar digitar). Filtra conforme o usuário digita.
