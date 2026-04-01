# Research: 011-enhance-participantes

## Decision 1: Filtro ativo no endpoint de participantes

**Decision**: Adicionar parâmetro opcional `?ativo=1` ao endpoint `GET /api/participants`. O endpoint de manutenção chama sem o parâmetro (retorna todos); o `loadParticipants()` do formulário de reunião chama com `?ativo=1`.

**Rationale**: Reutilizar o mesmo endpoint com um parâmetro é mais simples que criar um endpoint separado. O parâmetro é opcional para não quebrar o endpoint de manutenção. Esse padrão já é usado no projeto para `?q=` (busca textual).

**Alternatives considered**: Criar endpoint separado `/api/participants/active` — rejeitado por aumentar superfície da API sem necessidade.

---

## Decision 2: Invalidação do cache de participantes após salvar

**Decision**: Após qualquer `saveParticipant()`, resetar `this.allParticipants = []` para forçar reload na próxima abertura do formulário de reunião.

**Rationale**: `loadParticipants()` tem cache client-side (`if (this.allParticipants.length > 0) return`). Se o usuário inativar um participante e abrir um formulário de reunião na mesma sessão, o cache ainda mostraria o participante inativo. Resetar garante que o filtro `ativo=1` seja re-aplicado.

**Alternatives considered**: Remover o cache — rejeitado por aumentar chamadas de rede desnecessárias. Filtrar client-side por `p.ativo` no getter — rejeitado porque participantes inativos nem devem ser carregados no contexto de reunião.

---

## Decision 3: Campo Lotação na busca do autocomplete

**Decision**: Estender a cláusula `WHERE` do endpoint de participantes para incluir `lotacao LIKE ?` além de `nome LIKE ?` e `instituicao LIKE ?`. No frontend, estender `filteredParticipants` e `filteredParticipantsForFilter` getters para também pesquisar `p.lotacao`.

**Rationale**: Confirmado pelo usuário (clarificação Q2). Custo de implementação zero; ganho de encontrabilidade real em contextos institucionais.

**Alternatives considered**: Busca apenas por nome e instituição — rejeitado pelo usuário.

---

## Decision 4: Editor Quill para Notas do participante

**Decision**: Replicar o padrão `_quillProjectEditor` como `_quillParticipantEditor` — variável module-level fora do proxy do Alpine. Inicializar no `$watch('activeTab', tab => { if (tab === 'participants') ... })`. Usar ID `#quill-participant-editor` no HTML.

**Rationale**: O padrão já existe e é documentado em código (`// Quill instances stored OUTSIDE Alpine's reactive data to avoid Proxy wrapping`). Reutilizar o mesmo padrão garante consistência e evita o bug de Proxy que quebraria `setContents()`.

**Alternatives considered**: Usar `<textarea>` simples — rejeitado, o usuário quer o mesmo editor rico dos projetos.

---

## Decision 5: Migration número 015

**Decision**: Arquivo `migrations/015_add_participante_enhancements.sql`. ALTER TABLE único que adiciona `lotacao`, `ativo` e `notas` à tabela `participante`.

**Rationale**: Última migration existente é `014_add_projeto_link.sql`. Não há remoção de coluna legada neste feature (apenas adições), portanto uma única migration é suficiente — sem necessidade de separar em criação + remoção como o padrão II.1 da constitution exige para tabelas associadas.

**Alternatives considered**: Três migrations separadas (uma por campo) — rejeitado por complexidade desnecessária; campos são simples ALTER ADD COLUMN.

---

## Decision 6: Padrão do filtro de status na lista de manutenção

**Decision**: Replicar exatamente o padrão de projetos: estado `participantStatusFilter: ''` (vazio = Todos), getter `filteredParticipantList` que filtra por `p.ativo`, e botões "Todos / Ativos / Inativos" no HTML.

**Rationale**: Confirmado pelo usuário (clarificação Q1). Consistência visual e comportamental com projetos reduz carga cognitiva.

**Alternatives considered**: Distinção visual apenas (badge) sem filtro — rejeitado pelo usuário.
