# Feature Specification: Notas e Links em Projetos

**Feature Branch**: `010-project-notes-links`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Quero adicionar notas e links aos projetos, da mesma forma que existem nas reuniões — mesma abordagem, interface e biblioteca."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Adicionar e editar notas em um projeto (Priority: P1)

O usuário acessa a ficha de um projeto e encontra um editor de notas rico (mesmo editor já utilizado nas reuniões). Ele pode escrever, formatar e salvar notas associadas ao projeto — por exemplo, registrar objetivos, histórico ou decisões relevantes ao projeto.

**Why this priority**: Notas são o recurso de maior valor informativo para o projeto; permitem contextualizar o projeto além de seus atributos básicos (nome, ativo).

**Independent Test**: Abrir a ficha de um projeto sem notas, digitar texto formatado no editor, salvar e recarregar a página — verificar que o conteúdo é preservado com a formatação correta.

**Acceptance Scenarios**:

1. **Given** o usuário abre a ficha de um projeto, **When** visualiza a seção de notas, **Then** encontra o mesmo editor de texto rico usado nas reuniões, com as mesmas opções de formatação.
2. **Given** o usuário digita e formata texto no editor de notas, **When** salva o projeto, **Then** o conteúdo é persistido e exibido corretamente na próxima abertura da ficha.
3. **Given** um projeto já possui notas, **When** o usuário edita o conteúdo e salva, **Then** o conteúdo anterior é substituído pelo novo.
4. **Given** um projeto não possui notas, **When** a ficha é exibida, **Then** o editor aparece vazio sem erros.

---

### User Story 2 — Adicionar e remover links em um projeto (Priority: P2)

O usuário acessa a ficha de um projeto e pode adicionar múltiplos links (URL + nome opcional), visualizá-los e removê-los individualmente — da mesma forma que links são gerenciados nas reuniões.

**Why this priority**: Links complementam as notas ao conectar o projeto a recursos externos (documentos, repositórios, sites de referência).

**Independent Test**: Abrir a ficha de um projeto, adicionar dois links com nome e URL, salvar, recarregar — verificar que ambos os links aparecem e são clicáveis. Remover um e verificar que apenas o restante persiste.

**Acceptance Scenarios**:

1. **Given** o usuário está na ficha de um projeto, **When** acessa a seção de links, **Then** vê a mesma interface de gerenciamento de links das reuniões (campo de URL, campo de nome, botão de adicionar, lista com opção de remover).
2. **Given** o usuário preenche URL e nome e clica em adicionar, **When** salva o projeto, **Then** o link é persistido e aparece na lista da ficha.
3. **Given** um projeto possui links salvos, **When** o usuário clica em remover um link, **Then** o link é excluído e não aparece mais na lista.
4. **Given** um projeto não possui links, **When** a ficha é exibida, **Then** a seção de links aparece vazia sem erros.
5. **Given** um link possui apenas URL (sem nome), **When** é exibido, **Then** a URL é usada como texto de exibição.

---

### Edge Cases

- O que acontece se o usuário salva notas vazias (editor em branco)? → O campo de notas é limpo/nulo — comportamento idêntico às reuniões.
- O que acontece com links que possuem URL inválida? → O sistema exibe o link como fornecido; validação de formato de URL não é obrigatória (mesma política das reuniões).
- O que acontece ao remover todos os links de um projeto? → A seção fica vazia, sem mensagem de erro.
- O que acontece se o usuário tenta adicionar um link sem preencher a URL? → O botão de adicionar permanece desabilitado ou o link não é adicionado.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir um campo de notas com editor de texto rico na ficha de cada projeto, usando o mesmo editor já existente nas reuniões.
- **FR-002**: O sistema DEVE persistir o conteúdo das notas do projeto ao salvar, preservando toda a formatação.
- **FR-003**: O sistema DEVE carregar e exibir as notas salvas ao abrir a ficha de um projeto.
- **FR-004**: O sistema DEVE permitir adicionar múltiplos links a um projeto, cada um composto por URL (obrigatório) e nome (opcional).
- **FR-005**: O sistema DEVE exibir os links de um projeto em lista na ficha do projeto, com cada link clicável abrindo em nova aba.
- **FR-006**: O sistema DEVE permitir remover links individualmente da ficha do projeto.
- **FR-007**: A interface de notas e links dos projetos DEVE seguir o mesmo padrão visual e de interação das reuniões.
- **FR-008**: O botão de adicionar link DEVE estar desabilitado quando o campo de URL estiver vazio.

### Key Entities

- **Projeto**: Entidade existente; recebe dois novos atributos — `notas` (texto rico, opcional) e uma coleção de links.
- **Link de Projeto**: Entidade nova com URL (obrigatório) e nome (opcional), associada a um projeto (relação 1:N).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário consegue adicionar, editar e visualizar notas em um projeto em menos de 30 segundos.
- **SC-002**: O usuário consegue adicionar, visualizar e remover links de um projeto em menos de 30 segundos.
- **SC-003**: Notas e links persistem corretamente após salvar e recarregar — zero perda de dados em condições normais de uso.
- **SC-004**: A experiência visual e de interação de notas e links nos projetos é indistinguível da experiência nas reuniões (consistência da interface).

---

## Assumptions

- A interface e o editor de notas das reuniões serão reutilizados diretamente, sem reimplementação.
- A estrutura de links nas reuniões (tabela `link` com `reuniao_id`) será replicada para projetos com uma tabela `projeto_link` (ou equivalente) com `projeto_id`.
- As notas do projeto são armazenadas como campo de texto rico diretamente na tabela `projeto` (coluna `notas`), assim como em `reuniao.notas`.
- Não há paginação nos links dos projetos — o volume esperado é pequeno (< 20 links por projeto).
- A exibição de notas e links ocorre na ficha/modal de edição do projeto existente, não em uma tela separada.
