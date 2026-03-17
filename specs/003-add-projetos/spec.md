# Feature Specification: Add Projetos e Menu de Navegação

**Feature Branch**: `003-add-projetos`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Quero adicionar agora a tabela de projetos. A tabela está em /docs/source/memoriaReunioes-Projeto.csv. Esta tabela deve ser migrada para o banco de dados em MariaDB. Esta tabela deve se relacionar com a tabela reuniao, atraves da coluna projeto e uma reunião pode estar relacionada a mais de um projeto. Ao editar ou entrar uma nova reunião, os projetos devem ser selecionados da lista de projetos da mesma forma que está sendo feito com a adição/seleção de participantes para o projeto. Quero listar os projetos da mesma forma que listo as reuniões. A lista de projetos, lista de reuniões e lista de participantes ficarão disponíveis em um menu principal, no topo da página da aplicação. As opções do Menu são Reuniões, Participantes e Projetos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Migrar Dados de Projetos do CSV (Priority: P1)

Os dados de projetos existentes no arquivo CSV (`memoriaReunioes-Projeto.csv`) são importados para o banco de dados através de um script de migração dedicado, executado antes de qualquer outro passo da implementação. O script fica em um diretório local que não é versionado no repositório remoto, pois contém credenciais de acesso ao banco.

**Why this priority**: A migração deve ser o primeiro passo de toda a implementação — a tabela de projetos populada é pré-requisito para desenvolver e testar todas as demais funcionalidades (listagem, seleção em reuniões, menu). Sem dados reais disponíveis, o restante não pode ser validado.

**Independent Test**: Pode ser testada executando o script de migração e consultando diretamente o banco de dados para confirmar que todos os 49 projetos do CSV foram inseridos corretamente.

**Acceptance Scenarios**:

1. **Given** o banco de dados está vazio de projetos, **When** o script de migração é executado, **Then** todos os projetos do CSV são inseridos na base de dados.
2. **Given** o script foi executado com sucesso, **When** o usuário acessa a lista de projetos, **Then** todos os 49 projetos do CSV estão visíveis, com nome, status ativo/inativo e instituição.
3. **Given** o script de migração existe localmente, **When** se verifica o repositório remoto, **Then** o diretório `/docs/source/scripts` e seu conteúdo não estão presentes no repositório.
4. **Given** o script é executado uma segunda vez (projetos já existentes), **When** a execução termina, **Then** nenhuma duplicata é criada — a operação é idempotente.

---

### User Story 2 - Visualizar Lista de Projetos (Priority: P2)

O usuário acessa a aplicação e navega até a lista de projetos a partir do menu principal no topo da página. Nessa lista, ele pode visualizar todos os projetos cadastrados (ativos e inativos), com indicação visual do status e a qual instituição pertencem.

**Why this priority**: A listagem de projetos é o ponto de entrada fundamental para verificar se os dados migrados estão corretos e para que o usuário conheça o catálogo disponível antes de associar projetos a reuniões.

**Independent Test**: Pode ser testada acessando a opção "Projetos" no menu e verificando se todos os projetos aparecem com nome, status ativo/inativo destacado visualmente e instituição.

**Acceptance Scenarios**:

1. **Given** o usuário está em qualquer página da aplicação, **When** clica em "Projetos" no menu principal, **Then** é redirecionado para a lista de projetos com todos os projetos cadastrados visíveis (ativos e inativos).
2. **Given** a lista de projetos está aberta, **When** o usuário visualiza os projetos, **Then** cada projeto exibe nome, status (ativo/inativo) com indicação visual clara e instituição associada.
3. **Given** a lista de projetos está aberta, **When** não há projetos cadastrados, **Then** uma mensagem informando que não há projetos é exibida.

---

### User Story 3 - Associar Projetos a uma Reunião (Priority: P3)

Ao criar ou editar uma reunião, o usuário pode associar um ou mais projetos àquela reunião, selecionando-os a partir de uma lista interativa de projetos — da mesma forma que seleciona participantes atualmente. Uma reunião pode estar relacionada a múltiplos projetos simultaneamente.

**Why this priority**: A associação reunião–projeto é o núcleo funcional desta feature. Sem ela, os projetos existem isolados sem valor para o registro de reuniões.

**Independent Test**: Pode ser testada criando uma nova reunião, selecionando dois projetos da lista e salvando — verificando que ambos ficam associados ao visualizar a reunião.

**Acceptance Scenarios**:

1. **Given** o formulário de criação/edição de reunião está aberto, **When** o usuário acessa o campo de projetos, **Then** uma lista de projetos ativos disponíveis é exibida para seleção.
2. **Given** a lista de projetos está visível no formulário, **When** o usuário seleciona um projeto, **Then** o projeto aparece como selecionado e pode ser removido da seleção.
3. **Given** o usuário selecionou múltiplos projetos, **When** salva a reunião, **Then** todos os projetos selecionados ficam associados à reunião.
4. **Given** uma reunião existente com projetos associados, **When** o usuário abre o formulário de edição, **Then** os projetos já associados aparecem como selecionados.
5. **Given** o formulário de seleção de projetos, **When** um projeto já foi selecionado, **Then** ele não aparece mais na lista de opções disponíveis para seleção (evitando duplicatas).
6. **Given** uma reunião com projeto inativo associado, **When** o usuário abre o formulário de edição, **Then** o projeto inativo aparece como pré-selecionado e pode ser removido, mas não está disponível para nova seleção.
7. **Given** a visualização de uma reunião (modo leitura), **When** a reunião possui projetos associados, **Then** os projetos são exibidos, seguindo o mesmo padrão de exibição dos participantes.

---

### User Story 4 - Navegar pelo Menu Principal (Priority: P4)

O usuário utiliza o menu no topo da aplicação para alternar entre as três seções principais: Reuniões, Participantes e Projetos. O menu está sempre visível e indica qual seção está ativa.

**Why this priority**: O menu unifica a navegação da aplicação. É melhoramento de UX que completa a experiência, mas pode ser implementado em paralelo ou ao final das demais stories.

**Independent Test**: Pode ser testada clicando em cada opção do menu e verificando se a seção correspondente é exibida e o item de menu ativo é destacado.

**Acceptance Scenarios**:

1. **Given** o usuário está em qualquer página da aplicação, **When** visualiza o topo da página, **Then** o menu com as opções "Reuniões", "Participantes" e "Projetos" está visível.
2. **Given** o menu está visível, **When** o usuário clica em "Reuniões", **Then** é direcionado para a lista de reuniões e "Reuniões" aparece destacado no menu.
3. **Given** o menu está visível, **When** o usuário clica em "Participantes", **Then** é direcionado para a lista de participantes e "Participantes" aparece destacado.
4. **Given** o menu está visível, **When** o usuário clica em "Projetos", **Then** é direcionado para a lista de projetos e "Projetos" aparece destacado.

---

### Edge Cases

- O que acontece quando o usuário tenta criar uma reunião sem selecionar nenhum projeto? (Projetos são opcionais em uma reunião — a reunião deve poder ser salva sem projetos associados.)
- O que acontece quando a lista de projetos no formulário de reunião está vazia (nenhum projeto cadastrado)? Uma mensagem informativa deve ser exibida.
- O que acontece ao executar o script de migração quando os projetos já foram importados anteriormente? O script deve evitar duplicatas (inserção idempotente).
- O que acontece ao filtrar projetos na seleção — a busca deve ser case-insensitive para facilitar a localização.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir um menu de navegação no topo de todas as páginas com as opções "Reuniões", "Participantes" e "Projetos".
- **FR-002**: O sistema DEVE destacar visualmente o item de menu correspondente à seção atualmente ativa.
- **FR-003**: O sistema DEVE manter uma lista de projetos com os atributos: nome do projeto, status ativo/inativo, e instituição associada.
- **FR-004**: O sistema DEVE exibir todos os projetos cadastrados (ativos e inativos) quando o usuário acessa a seção "Projetos", com indicação visual clara do status de cada projeto (ativo/inativo), além do nome e instituição.
- **FR-005**: O sistema DEVE permitir que uma reunião seja associada a zero ou mais projetos.
- **FR-006**: O sistema DEVE permitir que o mesmo projeto seja associado a múltiplas reuniões distintas (relação muitos-para-muitos).
- **FR-007**: O formulário de criação e edição de reunião DEVE incluir um campo de seleção de projetos com o mesmo padrão de interação usado para seleção de participantes.
- **FR-008**: O campo de seleção de projetos DEVE exibir apenas projetos **ativos** que ainda não foram selecionados para aquela reunião. Projetos inativos não aparecem como opção de nova seleção.
- **FR-008a**: Projetos inativos previamente associados a uma reunião DEVEM aparecer como pré-selecionados ao abrir o formulário de edição, podendo ser removidos pelo usuário, mas não re-adicionados se removidos.
- **FR-009**: O usuário DEVE ser capaz de remover um projeto previamente selecionado no formulário de reunião (incluindo projetos inativos pré-associados).
- **FR-009a**: A visualização de uma reunião (modo leitura) DEVE exibir os projetos associados, seguindo o mesmo padrão de exibição dos participantes.
- **FR-010**: Ao abrir o formulário de edição de uma reunião existente, os projetos já associados DEVEM aparecer pré-selecionados.
- **FR-011**: Deve existir um script de migração que importe todos os projetos do arquivo CSV para o banco de dados.
- **FR-012**: O script de migração DEVE ser armazenado em `/docs/source/scripts` e este diretório DEVE estar listado no `.gitignore` para nunca ser versionado.
- **FR-013**: O script de migração DEVE ser idempotente, evitando duplicação de registros em execuções repetidas.

### Key Entities

- **Projeto**: Representa um projeto ou iniciativa que pode ser discutido em reuniões. Atributos: nome (identificador único), status ativo/inativo, instituição parceira associada (opcional).
- **Reunião-Projeto**: Representa a associação entre uma reunião e um projeto. Uma reunião pode ter múltiplos projetos; um projeto pode aparecer em múltiplas reuniões.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário consegue navegar entre as seções Reuniões, Participantes e Projetos em menos de 2 cliques a partir de qualquer página da aplicação.
- **SC-002**: Todos os 49 projetos do arquivo CSV ficam disponíveis na aplicação após a execução do script de migração, sem erros ou omissões.
- **SC-003**: O usuário consegue associar múltiplos projetos a uma reunião em menos de 1 minuto, usando o mesmo padrão de seleção já familiar dos participantes.
- **SC-004**: 100% das reuniões salvas com projetos selecionados mantêm a associação correta ao serem reabertas para edição.
- **SC-005**: O diretório `/docs/source/scripts` e seu conteúdo não aparecem no histórico do repositório remoto após a implementação.

## Clarifications

### Session 2026-03-17

- Q: A tela de listagem de Projetos deve exibir todos os projetos ou apenas os ativos? → A: Mostrar todos (ativos e inativos), com indicação visual do status de cada um.
- Q: Projetos inativos já associados a uma reunião — comportamento na edição? → A: Mostrar como pré-selecionados, permitindo remover, mas não disponíveis para nova seleção.
- Q: Projetos associados devem aparecer na visualização de uma reunião (modo leitura)? → A: Sim, exibir os projetos associados na visualização da reunião, igual ao padrão de participantes.
- Decisão: A migração do CSV é P1 e pré-requisito de toda a implementação — tabela deve estar populada antes de desenvolver listagem, associação e menu.

## Assumptions

- Projetos são gerenciados apenas via script de migração inicial e pela interface de listagem — não há interface para criar/editar/excluir projetos individuais nesta feature.
- A lista de projetos para seleção no formulário de reunião exibe apenas projetos com status **ativo** (VERDADEIRO), já que projetos inativos não devem receber novas reuniões.
- O campo "instituição" pode estar vazio para alguns projetos — isso é válido e deve ser tratado na exibição (campo em branco ou traço).
- A busca/filtragem de projetos no campo de seleção do formulário de reunião é desejável mas não obrigatória para MVP — o padrão segue o já implementado para participantes.
- O script de migração usa as credenciais de root para acesso direto ao banco, o que é adequado para um ambiente controlado de uso único.
