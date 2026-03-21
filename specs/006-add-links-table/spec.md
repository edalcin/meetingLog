# Feature Specification: Adicionar Tabela de Links Relacionados às Reuniões

**Feature Branch**: `006-add-links-table`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "Quero adicionar agora a tabela de 'links'. A tabela está em /docs/source/memoriaReunioes-DocsRelacionados.csv. Esta tabela deve se relacionar com a tabela 'reuniao', atraves da coluna 'reuniao_data', em memoriaReunioes-DocsRelacionados.csv; e da coluna 'data_hora' na tabela 'reuniao'. Um registro em 'reuniao' pode se relacionar com mais de um registro em 'links'. Na entrada de um novo registro de reunião, e na edição de um registro de reunião, o comportamento de 'links' deve ser o mesmo adotado para 'pautas' na interface. Perceba que os registros de links em /docs/source/memoriaReunioes-DocsRelacionados.csv possuem a seguinte estrutura: [nome_do_link] 'link'. Esta estrutura deve ser respeitada na interface e no banco de dados e o 'link' deve ser 'clicável', abrindo em uma nova janela."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualizar links no formulário de reunião (Priority: P1)

Ao abrir o formulário de criação ou edição de uma reunião, o usuário vê uma seção dedicada aos links relacionados àquela reunião. Na edição, os links já cadastrados aparecem listados, com o nome do link visível e o URL clicável. Na criação, a lista começa vazia.

**Why this priority**: É o núcleo da funcionalidade — sem a visualização dos links a funcionalidade não entrega valor.

**Independent Test**: Abrir o formulário de edição de uma reunião que possui links migrados do CSV e verificar que eles aparecem listados na seção de links, com nome e URL clicável.

**Acceptance Scenarios**:

1. **Given** o usuário abre o formulário de edição de uma reunião com links cadastrados, **When** o formulário é exibido, **Then** todos os links dessa reunião aparecem listados em uma seção dedicada, cada um com seu nome e URL clicável em linha separada.
2. **Given** o usuário abre o formulário de criação de nova reunião, **When** o formulário é exibido, **Then** a seção de links aparece vazia, pronta para adição.
3. **Given** uma reunião sem links cadastrados, **When** o formulário de edição é aberto, **Then** a seção de links aparece vazia, sem mensagem de erro.
4. **Given** a seção de links exibe um link, **When** o usuário clica no URL, **Then** o URL abre em uma nova aba/janela do navegador.

---

### User Story 2 - Adicionar links ao criar ou editar uma reunião (Priority: P1)

O usuário pode adicionar um ou mais links a uma reunião diretamente no formulário, informando um nome descritivo e o URL, e confirmando com um botão "+" ou "Adicionar". É possível adicionar múltiplos links na mesma sessão sem sair do formulário.

**Why this priority**: A capacidade de inserir links é tão fundamental quanto visualizá-los.

**Independent Test**: Criar uma nova reunião, adicionar dois links no card, salvar e verificar que ambos aparecem ao reabrir o formulário de edição.

**Acceptance Scenarios**:

1. **Given** o formulário de reunião está aberto, **When** o usuário preenche o nome e a URL de um link e confirma, **Then** o link aparece na lista da seção, com o nome e a URL clicável.
2. **Given** o usuário adicionou um link, **When** adiciona um segundo link, **Then** ambos aparecem listados sem que o primeiro seja removido.
3. **Given** o usuário salva a reunião com links adicionados, **When** reabre o formulário de edição dessa reunião, **Then** todos os links salvos aparecem listados.

---

### User Story 3 - Remover link de uma reunião (Priority: P2)

O usuário pode remover um link individual de uma reunião, seja durante a criação ou na edição.

**Why this priority**: Complementa a adição; links desatualizados ou inseridos por engano devem poder ser removidos.

**Independent Test**: Editar uma reunião com dois links, remover um deles, salvar e verificar que apenas o link restante persiste.

**Acceptance Scenarios**:

1. **Given** a seção de links lista dois links, **When** o usuário remove um deles, **Then** apenas o link removido desaparece da lista, o outro permanece.
2. **Given** o usuário remove um link e salva, **When** reabre o formulário, **Then** o link removido não aparece mais.

---

### User Story 4 - Visualizar links no painel de detalhes da reunião (Priority: P2)

Ao abrir o painel de visualização detalhada de uma reunião (modo somente-leitura), o usuário vê a lista de links associados, cada um com seu nome visível e URL clicável em nova aba. Não há edição neste painel.

**Why this priority**: Quem consulta uma reunião sem querer editá-la precisa acessar os documentos relacionados diretamente.

**Independent Test**: Abrir o painel de detalhes de uma reunião que possui links migrados e verificar que os links aparecem como âncoras clicáveis.

**Acceptance Scenarios**:

1. **Given** o usuário abre o painel de detalhes de uma reunião com links cadastrados, **When** o painel é exibido, **Then** todos os links aparecem listados em modo somente-leitura, cada um com nome e URL clicável em nova aba.
2. **Given** uma reunião sem links, **When** o painel de detalhes é aberto, **Then** a seção de links não exibe nenhum item (sem mensagem de erro).

---

### User Story 5 - Editar nome ou URL de um link existente (Priority: P3)

O usuário pode editar o nome ou a URL de um link já cadastrado diretamente na seção, sem precisar remover e adicionar novamente.

**Why this priority**: Conveniência; a alternativa (remover + adicionar) já atende o caso de uso.

**Independent Test**: Editar o nome e a URL de um link existente e verificar que as alterações são salvas corretamente.

**Acceptance Scenarios**:

1. **Given** a seção lista um link existente, **When** o usuário edita o nome ou a URL e salva a reunião, **Then** os novos valores são persistidos e exibidos corretamente.

---

### Edge Cases

- O que acontece se o usuário tentar adicionar um link sem preencher o nome ou a URL?
  → Links com nome ou URL vazios não devem ser aceitos; o botão de adição permanece desabilitado até ambos os campos estarem preenchidos.
- O que acontece com registros do CSV que possuem `reuniao_data` mas nenhuma reunião correspondente no banco?
  → Registros órfãos são registrados no log do script de migração e ignorados.
- O que acontece com registros do CSV com `reuniao_data` vazio?
  → Devem ser ignorados na migração e registrados no log.
- O que acontece com registros do CSV cujo campo `linkDoc` não segue o formato `[nome] url`?
  → Devem ser ignorados na migração e registrados no log com o valor original para inspeção.
- Uma reunião pode ter zero links?
  → Sim. Links são opcionais.
- O que acontece se a URL informada não for um endereço válido?
  → O sistema armazena o valor informado sem validação rigorosa de formato; a responsabilidade pelo URL correto é do usuário.

## Clarifications

### Session 2026-03-21

- Q: Os links devem aparecer no painel de visualização detalhada da reunião (modo leitura)? → A: Sim — links aparecem no painel de detalhes como lista clicável somente-leitura.
- Q: Qual combinação de campos identifica duplicatas na migração? → A: `(reuniao_id, url)` — URL é a chave natural por reunião.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE criar uma tabela `link` no banco de dados com ao menos: identificador único, nome descritivo do link (obrigatório), URL (obrigatório) e referência à reunião vinculada.
- **FR-002**: Cada registro de link DEVE estar vinculado a exatamente uma reunião (relação N:1 de link para reunião).
- **FR-003**: Uma reunião PODE ter zero ou mais links associados.
- **FR-004**: O formulário de criação de reunião DEVE incluir uma seção de links com campos para nome e URL, e um botão "+" ou "Adicionar" para confirmar cada link individualmente antes de salvar a reunião.
- **FR-005**: O formulário de edição de reunião DEVE exibir os links já cadastrados e permitir adição, edição e remoção de links.
- **FR-006**: Cada link exibido DEVE mostrar o nome descritivo como texto visível e o URL como âncora clicável que abre em nova aba/janela.
- **FR-007**: Ao salvar uma reunião, os links listados na seção DEVEM ser persistidos (criados, atualizados ou removidos conforme o estado final da seção).
- **FR-008**: Links com nome ou URL vazios NÃO DEVEM ser salvos.
- **FR-009**: A API DEVE expor endpoints para listar, criar, atualizar e remover links de uma reunião.
- **FR-010**: Os links NÃO DEVEM aparecer na tabela de listagem de reuniões. Os links DEVEM ser visíveis no formulário de edição/criação (com edição completa) e no painel de visualização detalhada da reunião (somente-leitura, sem possibilidade de edição).
- **FR-011**: Um script de migração DEVE importar os dados históricos do CSV `memoriaReunioes-DocsRelacionados.csv` para a tabela `link`, vinculando cada registro à reunião correspondente pelo campo `reuniao_data` (formato `DD/MM/YYYY HH:MM`), convertendo o fuso horário BRT (UTC-3) para UTC ao comparar com `data_hora` na tabela `reuniao`.
- **FR-012**: O script de migração DEVE interpretar o formato `[nome_do_link] url` do campo `linkDoc` do CSV, separando o nome (conteúdo entre colchetes) do URL (texto após o espaço que segue o colchete de fechamento).
- **FR-013**: O script de migração DEVE gerar um log registrando todos os registros ignorados (data vazia, formato inválido, nome ou URL vazio, reunião não encontrada no banco).
- **FR-014**: As credenciais do banco de dados usadas pelo script de migração NÃO DEVEM ser versionadas no repositório — devem ser fornecidas via variáveis de ambiente.
- **FR-015**: O script de migração DEVE ser idempotente: a combinação `(reuniao_id, url)` identifica univocamente um registro — se já existir no banco, o registro do CSV é ignorado sem erro. Executar o script mais de uma vez não duplica registros.

### Key Entities

- **Link**: Documento ou recurso externo relacionado a uma reunião. Atributos: identificador único, nome descritivo (não vazio), URL (não vazio), referência à reunião à qual pertence, e posição de exibição (para manter ordem de inserção). A combinação `(reuniao_id, url)` é única — a mesma URL não pode aparecer duas vezes na mesma reunião.
- **Reunião** (existente): Já possui identificador, data/hora, tipo, participantes, projetos, pautas e notas. Passa a ter também uma lista ordenada de links associados.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos registros válidos do CSV (com `reuniao_data`, nome e URL não vazios, e reunião correspondente no banco) são migrados sem perda de dados.
- **SC-002**: O usuário consegue adicionar, visualizar e remover links de uma reunião sem abandonar o formulário (tudo na mesma tela).
- **SC-003**: Nenhum link com nome ou URL vazio é armazenado no banco de dados, independentemente de como o formulário for submetido.
- **SC-004**: O script de migração pode ser executado mais de uma vez sem duplicar registros (idempotência verificável por contagem de registros).
- **SC-005**: Os links históricos migrados do CSV são visíveis e clicáveis nos formulários de edição das respectivas reuniões imediatamente após a migração.
- **SC-006**: Todos os links exibidos na interface abrem o URL em uma nova aba/janela ao serem clicados.

---

## Assumptions

- A correspondência entre CSV e reuniões no banco é feita por `data_hora` exato (incluindo hora e minuto), após conversão de BRT (UTC-3) para UTC — consistente com as migrações de notas e pautas.
- Os timestamps no CSV estão no formato `DD/MM/YYYY HH:MM` sem indicação explícita de fuso; assume-se BRT (UTC-3).
- O formato do campo `linkDoc` no CSV é sempre `[nome] url`, onde o nome está entre colchetes e o URL começa após o primeiro espaço que segue o `]`. Variações fora desse formato são tratadas como inválidas e ignoradas com log.
- A ordem de exibição dos links é a ordem de inserção (sem ordenação manual pelo usuário neste momento).
- O card de links no formulário não requer salvamento intermediário — todas as alterações são confirmadas ao salvar a reunião.
- O comportamento da seção de links no formulário espelha integralmente o comportamento da seção de pautas, exceto pelo campo adicional de URL e pelo link clicável na exibição.
- Links são opcionais; reuniões sem links são válidas.
- O CSV contém ~323 registros de links; a migração deve processar todos sem impacto perceptível no tempo de carregamento da página.
