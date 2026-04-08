# Feature Specification: Correção das Vulnerabilidades de Alta Prioridade

**Feature Branch**: `012-fix-security-high`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: Resolver as 4 vulnerabilidades classificadas como "High Priority" no relatório de segurança (`audit/security-report.md`), sem introduzir quebras de compatibilidade em produção.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Proteção contra ataques de força bruta ao PIN (Priority: P1)

Um usuário mal-intencionado que tenha acesso à rede onde a aplicação está hospedada tenta descobrir o PIN de acesso testando combinações automaticamente. Atualmente isso é possível sem qualquer limite. Após esta melhoria, tentativas repetidas em sequência rápida devem ser bloqueadas temporariamente.

**Why this priority**: O PIN é a única barreira de acesso a todos os dados da aplicação. Sem proteção contra força bruta, qualquer pessoa na mesma rede pode obter acesso em segundos.

**Independent Test**: Pode ser testado isoladamente disparando múltiplas tentativas erradas de PIN em sequência e verificando se a aplicação bloqueia novas tentativas antes de atingir o limite correto.

**Acceptance Scenarios**:

1. **Given** um usuário digita o PIN errado 5 vezes seguidas, **When** tenta uma 6ª vez dentro do período de bloqueio, **Then** a aplicação recusa a tentativa imediatamente sem verificar o PIN.
2. **Given** um usuário está bloqueado por tentativas excessivas, **When** o período de bloqueio de 15 minutos expira, **Then** o usuário pode tentar novamente normalmente.
3. **Given** um usuário digita o PIN errado 4 vezes e depois acerta, **When** autentica com sucesso, **Then** o contador de tentativas é zerado e o usuário acessa normalmente.

---

### User Story 2 - Bloqueio de links maliciosos (javascript: URLs) (Priority: P2)

Um usuário (ou alguém que manipule dados) tenta cadastrar um link com endereço `javascript:...` em uma reunião ou projeto. Atualmente esse link é salvo e quando clicado executa código no contexto da página. Após esta melhoria, apenas endereços com protocolo web válido (`http://` ou `https://`) devem ser aceitos.

**Why this priority**: Um link malicioso armazenado pode ser clicado inadvertidamente e comprometer toda a sessão do usuário. A aplicação precisa garantir que apenas links seguros sejam armazenados.

**Independent Test**: Pode ser testado isoladamente tentando salvar um link com URL `javascript:alert(1)` via interface ou API e verificando se é rejeitado, enquanto `https://exemplo.com` é aceito normalmente.

**Acceptance Scenarios**:

1. **Given** um usuário cria ou edita uma reunião e adiciona um link com URL `javascript:alert(1)`, **When** tenta salvar, **Then** a aplicação rejeita com mensagem de erro indicando URL inválida.
2. **Given** um usuário cria ou edita um projeto e adiciona um link com protocolo inválido (ex.: `ftp://` ou `data:`), **When** tenta salvar, **Then** a aplicação rejeita com mensagem de erro.
3. **Given** um usuário adiciona um link legítimo (`https://exemplo.com.br`), **When** salva, **Then** o link é aceito e exibido normalmente na interface.
4. **Given** links com `javascript:` foram salvos antes desta melhoria (dados legados), **When** a página carrega e exibe esses links, **Then** clicar neles não executa código — o link aponta para destino seguro inofensivo.

---

### User Story 3 - Cabeçalhos de segurança HTTP (Priority: P3)

Um administrador de segurança inspeciona as respostas HTTP da aplicação. Atualmente nenhum cabeçalho de proteção é enviado, deixando o navegador sem diretivas de segurança. Após esta melhoria, respostas devem incluir cabeçalhos padrão da indústria que reduzem a superfície de ataque.

**Why this priority**: Cabeçalhos de segurança são uma camada de defesa adicional. Sua ausência amplifica o impacto de outras vulnerabilidades (como XSS). São configurações de baixo risco e alto impacto.

**Independent Test**: Pode ser testado isoladamente inspecionando os cabeçalhos HTTP de qualquer resposta da aplicação com `curl -I` ou ferramentas de desenvolvedor do navegador.

**Acceptance Scenarios**:

1. **Given** qualquer requisição à aplicação, **When** o servidor responde, **Then** os cabeçalhos `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Content-Security-Policy` estão presentes.
2. **Given** a aplicação está em execução, **When** um site externo tenta incorporá-la em um `<iframe>`, **Then** o navegador bloqueia o carregamento devido ao cabeçalho de proteção.
3. **Given** a aplicação está em execução, **When** o usuário acessa normalmente, **Then** nenhuma funcionalidade existente é quebrada pelos novos cabeçalhos.

---

### User Story 4 - Container Docker sem privilégios de root (Priority: P4)

Um administrador do sistema verifica as configurações de segurança do container Docker onde a aplicação roda. Atualmente o processo principal roda como `root`, o que significa que qualquer vulnerabilidade explorada daria controle total do container. Após esta melhoria, o processo deve rodar como usuário sem privilégios.

**Why this priority**: Reduz drasticamente o impacto de uma exploração bem-sucedida de qualquer outra vulnerabilidade. É uma mudança de infraestrutura que não afeta funcionalidade.

**Independent Test**: Pode ser testado isoladamente verificando o usuário sob o qual o processo Node.js roda dentro do container após o deploy.

**Acceptance Scenarios**:

1. **Given** a imagem Docker é construída com as novas configurações, **When** o container é iniciado, **Then** o processo principal não roda como root (UID ≠ 0).
2. **Given** o container roda com usuário sem privilégios, **When** a aplicação executa operações normais (leitura de arquivos, uploads, geração de thumbnails), **Then** todas as funcionalidades continuam operando normalmente.
3. **Given** o container roda com usuário sem privilégios, **When** a aplicação tenta escrever em diretórios de upload, **Then** tem permissão para fazê-lo sem erros.
4. **Given** o volume de dados no host pertencia a `root` antes do deploy, **When** o container inicia com a nova imagem, **Then** o entrypoint corrige as permissões automaticamente e a aplicação sobe sem erros de permissão.

---

### Edge Cases

- O que acontece se um link legado com `javascript:` já está salvo no banco e um usuário clica nele após a correção da interface?
- O que acontece se o IP do usuário muda durante um período de bloqueio de PIN (ex.: VPN)?
- Se múltiplos links são salvos em uma mesma requisição e apenas um tem URL inválida: os links válidos são salvos normalmente e o link inválido é descartado com aviso visível ao usuário (não há rejeição total da requisição).
- O que acontece se o campo de URL de um link está vazio — deve ser aceito ou rejeitado?
- O que acontece com a janela de impressão de reuniões que usa conteúdo HTML dos campos de texto enriquecido — links maliciosos aparecem lá também?

---

## Requirements *(mandatory)*

### Functional Requirements

**Proteção contra Força Bruta (H2)**

- **FR-001**: O sistema DEVE rejeitar tentativas de autenticação com PIN após 5 falhas consecutivas do mesmo endereço de rede, retornando resposta de erro sem processar o PIN enviado.
- **FR-002**: O bloqueio por excesso de tentativas DEVE durar no mínimo 15 minutos antes de permitir novas tentativas.
- **FR-003**: O contador de tentativas DEVE ser zerado após uma autenticação bem-sucedida.
- **FR-004**: A resposta de bloqueio DEVE ser indistinguível de uma tentativa incorreta para não revelar o estado interno ao atacante.

**Validação de URLs em Links (H3)**

- **FR-005**: O sistema DEVE rejeitar o salvamento de qualquer link cujo endereço não comece com `http://` ou `https://`, tanto em reuniões quanto em projetos.
- **FR-006**: Quando uma requisição contém múltiplos links e apenas alguns têm URL inválida, o sistema DEVE salvar os links com URLs válidas normalmente e descartar os inválidos, retornando ao usuário um aviso visível identificando quais URLs foram rejeitadas (e o motivo). Se todos os links de uma requisição forem inválidos, nenhum dado é salvo.
- **FR-007**: A interface DEVE exibir links com URL inválida ou vazia de forma inerte (sem executar código), mesmo que dados legados existam no banco.
- **FR-008**: URLs vazias em campos de link DEVEM ser simplesmente ignoradas (o link não é salvo), sem gerar erro.

**Cabeçalhos de Segurança HTTP (H1)**

- **FR-009**: Todas as respostas HTTP da aplicação DEVEM incluir os cabeçalhos: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **FR-010**: As respostas DEVEM incluir uma política `Content-Security-Policy` que restrinja fontes de scripts e estilos às CDNs efetivamente utilizadas pela aplicação.
- **FR-011**: A adição dos cabeçalhos NÃO DEVE quebrar nenhuma funcionalidade existente da aplicação (carregamento de CDNs, uploads, visualização de arquivos).

**Container sem Privilégios (H4)**

- **FR-012**: A imagem Docker da aplicação DEVE ser configurada para que o processo principal execute como usuário sem privilégios de administrador do sistema.
- **FR-013**: Os diretórios de dados utilizados pela aplicação (uploads, thumbnails) DEVEM ter permissões que permitam escrita pelo usuário não-privilegiado.
- **FR-014**: Todas as funcionalidades existentes (upload de arquivos, geração de miniaturas de PDF, servir arquivos) DEVEM continuar funcionando após a mudança de usuário.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um ataque automatizado de força bruta ao PIN é bloqueado após no máximo 5 tentativas incorretas, impedindo qualquer nova tentativa por 15 minutos.
- **SC-002**: 100% das tentativas de salvar links com protocolo não-web são rejeitadas pela aplicação antes de atingir o banco de dados.
- **SC-003**: Clicar em qualquer link armazenado na aplicação (incluindo dados legados) não executa código JavaScript no navegador do usuário.
- **SC-004**: Todas as respostas HTTP da aplicação incluem no mínimo 4 cabeçalhos de segurança padrão verificáveis por inspeção.
- **SC-005**: O processo da aplicação dentro do container não possui privilégios de root, verificável por inspeção do sistema após deploy.
- **SC-006**: Nenhuma funcionalidade existente é degradada ou interrompida após a implementação de todas as 4 correções.

---

## Assumptions

- A aplicação continuará usando PIN numérico como único mecanismo de autenticação (sem mudança de modelo de auth neste escopo).
- Nenhum registro (log) de tentativas de autenticação bloqueadas é necessário — a proteção contra força bruta é suficiente sem auditoria de tentativas.
- As CDNs externas utilizadas (Tailwind, Quill, Alpine.js) permanecem as mesmas — nenhuma troca de fornecedor ou self-hosting está no escopo desta feature.
- O ambiente de deploy (UNRAID via Docker) suporta containers com usuários não-root sem restrições adicionais de orquestração.
- Os diretórios de dados existentes no volume do host (uploads, thumbnails) podem pertencer a `root` antes do primeiro deploy da nova imagem. O entrypoint do container DEVE corrigir as permissões desses diretórios automaticamente ao iniciar, sem exigir ação manual do operador.
- Dados de reuniões e projetos com links `javascript:` já existentes no banco serão tratados defensivamente na interface, mas **não serão migrados/corrigidos no banco** neste escopo — a correção é na camada de apresentação.
- O bloqueio por força bruta pode ser baseado em memória do processo (sem persistência entre restarts) — aceitável para uso single-container, single-user.
- A política de CSP pode incluir `'unsafe-inline'` onde necessário pelas CDNs atuais, com a intenção de apertar no futuro.

---

## Clarifications

### Session 2026-04-08

- Q: Quando uma requisição salva múltiplos links e apenas um é inválido, o sistema rejeita tudo ou salva os válidos? → A: Salva os links válidos e descarta o inválido com aviso visível ao usuário (sem rejeição total da requisição).
- Q: Tentativas de autenticação bloqueadas devem ser registradas em log? → A: Não — nenhum log necessário; a proteção contra força bruta é suficiente sem auditoria de tentativas.
- Q: Como tratar permissões dos diretórios de dados já existentes no host ao fazer deploy da imagem não-root? → A: O entrypoint do container corrige as permissões dos diretórios de dados automaticamente ao iniciar (sem ação manual do operador).

---

## Out of Scope

- Implementação de sessões server-side (autenticação stateful) — identificada como M3 no relatório, não High Priority.
- Remoção da porta 3306 exposta no docker-compose — identificada como M2, não High Priority.
- Correção de outros itens Medium/Low do relatório.
- Migração de dados legados no banco para remover URLs inválidas já armazenadas.
- Adição de SRI (Subresource Integrity) nas CDNs — identificada como M5, não High Priority.
