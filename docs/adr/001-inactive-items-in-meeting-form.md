# ADR-001: Exibição e Reativação de Participantes/Projetos Inativos no Formulário de Reunião

**Status:** Aceito  
**Data:** 2026-06-26

## Contexto

Participantes e Projetos podem ser marcados como **Inativos** para enxugar os dropdowns de seleção no formulário de Nova/Editar Reunião. Porém, eventualmente é necessário selecionar um item inativo e opcionalmente reativá-lo durante o preenchimento da reunião.

Esta funcionalidade existia antes do refatoramento mas foi perdida.

## Decisões

### 1. UX de confirmação — `window.confirm()`

Ao selecionar item inativo no dropdown, o sistema usa `window.confirm("Reativar X?")`.

Alternativa rejeitada: mini-painel inline com botões. Mais código, sem ganho real para interação eventual.

### 2. Sem cascade na reativação de Projeto

Reativar um Projeto não reativa automaticamente os Participantes associados.  
Participantes inativos só são reativados quando selecionados individualmente no próprio dropdown.

Contexto: desativar projeto auto-desativa participantes sem outros projetos ativos (comportamento existente mantido). A operação inversa é manual e intencional.

### 3. Endpoint PATCH dedicado para reativação

Novos endpoints:
- `PATCH /api/participants/:id` — aceita `{ "ativo": true }`
- `PATCH /api/projects/:id` — aceita `{ "ativo": true }`

Alternativa rejeitada: fetch-first + PUT existente. Exigiria 2 chamadas HTTP e risco de sobrescrever campos (`notas`, `links`) com valores ausentes no cache do frontend.

### 4. Comportamento idêntico para Participantes e Projetos

Ambos os dropdowns seguem o mesmo padrão:
- Itens ativos: início da lista, cor normal
- Itens inativos: fim da lista, cinza/itálico
- Seleção de inativo: `window.confirm()` → reativa via PATCH → adiciona à seleção

Corrige também bug existente: `filteredProjects` não filtrava por `ativo`, misturando ativos e inativos sem distinção.

### 5. Pílulas de selecionados sem distinção visual para inativos

Em modo Editar, participantes/projetos que ficaram inativos após a criação da reunião aparecem nas pílulas sem distinção visual.

Alternativa rejeitada: cor diferente + tooltip. Caso raro; complexidade não justificada.

## Glossário

| Termo | Definição |
|---|---|
| **Ativo** | Participante ou Projeto exibido normalmente nos dropdowns de seleção |
| **Inativo** | Participante ou Projeto oculto da lista principal; visível ao final do dropdown com estilo diferenciado |
| **Auto-desativação** | Quando um Projeto é desativado, Participantes sem outros Projetos ativos são automaticamente desativados |
| **Reativação** | Ação de marcar `ativo = true` via `PATCH`; disparada por `window.confirm()` ao selecionar item inativo |
| **PATCH de ativo** | Endpoint que altera exclusivamente o campo `ativo` sem tocar outros campos do registro |
