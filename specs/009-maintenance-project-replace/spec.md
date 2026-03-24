# Feature Specification: Menu Manutenção — Substituição de Projetos em Reuniões

**Feature Branch**: `009-maintenance-project-replace`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Quero criar uma entrada no menu principal de Manutenção, que oferecerá opções de manutenção do sistema. A primeira opção é a de replace (troca) de projetos associados às reuniões — troca DE: PARA: onde as opções são os projetos existentes. Caso o projeto destino não exista, oferecer opção de criar. Fazer dry run antes da execução final."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Substituir projeto existente por outro existente (Priority: P1)

O administrador quer substituir, em todos os registros de reunião, o projeto "DwC2JSON" pelo projeto "Biodiversidade Online", ambos já cadastrados. Ele acessa **Manutenção → Substituição de Projetos**, seleciona o projeto de origem no campo DE e o projeto de destino no campo PARA, executa uma simulação (dry run) para ver quais reuniões serão afetadas, e confirma a substituição.

**Why this priority**: É o caso de uso principal e mais frequente — consolidar projetos renomeados ou duplicados que já existem na base.

**Independent Test**: Cria-se reuniões vinculadas ao projeto "A", executa-se a substituição para o projeto "B", e verifica-se que todas as reuniões passam a referenciar "B" e nenhuma referencia mais "A".

**Acceptance Scenarios**:

1. **Given** o usuário está na tela de Substituição de Projetos, **When** interage com os campos DE e PARA, **Then** ambos apresentam busca por nome com autocomplete sobre os projetos cadastrados.
2. **Given** o usuário selecionou projetos distintos em DE e PARA, **When** clica em "Simular", **Then** o sistema exibe a lista de reuniões afetadas (com data e lista abreviada de participantes) e a contagem total, sem alterar dados.
3. **Given** o dry run exibiu N reuniões afetadas, **When** o usuário confirma a execução, **Then** todas as associações do projeto de origem são substituídas pelo de destino e o sistema exibe mensagem de sucesso com a contagem.
4. **Given** nenhuma reunião está associada ao projeto de origem, **When** o usuário clica em "Simular", **Then** o sistema informa "Nenhuma reunião encontrada com esse projeto" e o botão de confirmar permanece desabilitado.

---

### User Story 2 — Substituir projeto existente por projeto novo (a criar) (Priority: P2)

O administrador quer substituir "GO FAIR Agro" por "GO FAIR", mas "GO FAIR" ainda não existe no cadastro. Ao digitar "GO FAIR" no campo PARA sem encontrá-lo, o sistema oferece a opção de criar o projeto. Após criá-lo, o fluxo de dry run e confirmação segue normalmente.

**Why this priority**: Caso necessário para fusões onde o projeto de destino ainda não foi cadastrado; evita que o usuário precise sair da tela para cadastrar o projeto separadamente.

**Independent Test**: Seleciona-se um projeto existente em DE, digita-se um nome inexistente em PARA, cria-se o novo projeto pela opção exibida, e completa-se a substituição verificando que as reuniões foram atualizadas.

**Acceptance Scenarios**:

1. **Given** o usuário digita no campo PARA um nome que não existe, **When** a busca não retorna resultados, **Then** o sistema exibe a opção "Criar projeto '[nome digitado]'".
2. **Given** o usuário clica em "Criar projeto", **When** o projeto é criado com sucesso, **Then** o campo PARA é preenchido automaticamente com o novo projeto e o fluxo de simulação pode prosseguir.
3. **Given** o campo PARA está preenchido com o projeto recém-criado, **When** o usuário executa o dry run e confirma, **Then** as reuniões são atualizadas para o novo projeto, com o mesmo comportamento do Story 1.

---

### Edge Cases

- **Origem igual ao destino**: se o usuário selecionar o mesmo projeto em DE e PARA, o botão "Simular" deve ser desabilitado e uma mensagem de validação deve ser exibida.
- **Reunião com os dois projetos**: se uma reunião já possui associação com o projeto de destino, após a substituição o projeto de origem é removido e o de destino permanece — sem duplicata.
- **Projeto destino excluído entre dry run e confirmação**: a execução final deve verificar a existência do destino e reportar erro sem aplicar alterações parciais.
- **Projeto de origem sem reuniões**: dry run informa contagem zero e confirmação não é permitida.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE disponibilizar uma entrada "Manutenção" no menu principal da aplicação.
- **FR-002**: O menu Manutenção DEVE conter a opção "Substituição de Projetos" como primeiro item.
- **FR-003**: A tela de Substituição de Projetos DEVE apresentar dois campos de seleção de projeto, "DE" (origem) e "PARA" (destino), com busca por nome e autocomplete, reutilizando a mesma interface de seleção/criação de projetos já existente na ficha de reunião.
- **FR-004**: O sistema DEVE impedir a seleção do mesmo projeto nos campos DE e PARA (validação em tempo real).
- **FR-005**: O campo PARA DEVE oferecer a opção de criar um novo projeto quando o nome digitado não existir no cadastro.
- **FR-006**: O sistema DEVE executar uma simulação (dry run) ao acionar "Simular", retornando a lista de reuniões afetadas com data e lista abreviada de participantes, e a contagem total, sem modificar dados.
- **FR-007**: O botão de confirmação DEVE estar habilitado somente após um dry run que retorne pelo menos uma reunião afetada.
- **FR-008**: Ao confirmar, o sistema DEVE substituir todas as associações do projeto de origem pelo projeto de destino em uma única operação atômica (tudo ou nada).
- **FR-009**: Reuniões que já possuem o projeto de destino associado NÃO devem resultar em duplicata — a associação com o projeto de origem é apenas removida.
- **FR-010**: O sistema DEVE exibir mensagem de sucesso com a contagem de reuniões atualizadas após a conclusão da operação, e em seguida resetar o formulário (campos DE e PARA limpos, botão Simular desabilitado) para permitir uma nova substituição imediata.

### Key Entities

- **Projeto**: Entidade cadastrada; pode ser selecionada ou criada durante o fluxo de substituição.
- **Reunião**: Entidade que possui zero ou mais projetos associados; é o alvo da atualização.
- **Associação Reunião–Projeto**: Relacionamento N:N entre reuniões e projetos; é o que a operação de substituição modifica.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário consegue completar o fluxo completo (selecionar → simular → confirmar) em menos de 1 minuto, independentemente do volume de reuniões afetadas.
- **SC-002**: O dry run é exato — a contagem exibida na simulação corresponde ao número de registros efetivamente alterados na confirmação.
- **SC-003**: Nenhum dado é alterado se o usuário fechar ou cancelar a tela após o dry run sem confirmar.
- **SC-004**: A operação é atômica — em caso de erro, nenhuma reunião é parcialmente atualizada.
- **SC-005**: O usuário consegue criar um projeto inexistente e utilizá-lo como destino sem precisar sair da tela de substituição.

---

## Clarifications

### Session 2026-03-24

- Q: Qual informação deve identificar cada reunião na lista do dry run? → A: Data + lista de participantes (abreviada)
- Q: Após confirmação bem-sucedida, o que acontece com o formulário? → A: Formulário resetado, pronto para nova substituição

---

## Assumptions

- A aplicação é single-user (autenticada por PIN); não é necessário controle de acesso adicional para a seção Manutenção.
- "Substituição de Projetos" é o primeiro item do menu Manutenção; a estrutura do menu deve suportar novos itens futuramente, mas nenhum outro item é implementado nesta feature.
- O componente de seleção e criação de projetos da ficha de reunião será reutilizado diretamente.
- O projeto de origem que teve todas as suas associações substituídas **não** é excluído da tabela de projetos — apenas suas ligações com reuniões são removidas.
- A lista exibida no dry run não precisa ser paginada; exibe todas as reuniões afetadas de uma vez.
