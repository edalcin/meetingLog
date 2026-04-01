# Implementation Plan: Melhorias nos Participantes — Lotação, Status Ativo/Inativo e Notas

**Branch**: `011-enhance-participantes` | **Date**: 2026-04-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-enhance-participantes/spec.md`

## Summary

Adicionar três melhorias à entidade `participante`: campo "Lotação" (texto livre, entre Instituição e Cargo), status ativo/inativo (filtrado no autocomplete de reuniões, com toggle na manutenção), e campo "Notas" com editor Quill (ao final da ficha, disponível em criação e edição). Uma única migration ALTER TABLE. Backend: extensão dos endpoints existentes em `participants.js`. Frontend: extensão do estado Alpine em `app.js` e formulários em `index.html`.

## Technical Context

**Language/Version**: Node.js 22, ES modules
**Primary Dependencies**: Hono (web framework), mysql2/promise, Alpine.js CDN, Tailwind CSS CDN, Quill CDN
**Storage**: MariaDB — database `reunioes`, tabela `participante` (ALTER)
**Testing**: Manual (ferramenta single-user)
**Target Platform**: Docker (node:22-alpine) em UNRAID
**Project Type**: Web service (Hono REST API + Alpine.js frontend, sem build step)
**Performance Goals**: Single-user — sem metas quantitativas
**Constraints**: SQL parametrizado sempre; sem build step frontend; migrations imutáveis e sequenciais
**Scale/Scope**: Single-user, ~centenas de participantes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Nota |
|-----------|--------|------|
| I.1 Simplicidade | ✅ PASS | Apenas ALTER TABLE + extensão de rotas existentes. Sem novas abstrações. |
| I.2 Sem Build Step | ✅ PASS | Apenas edições em `app.js` e `index.html` existentes. Quill já está no CDN. |
| I.3 SQL Parametrizado | ✅ PASS | Todos os novos campos usarão `?` com array de parâmetros. |
| I.4 Credenciais fora do repo | ✅ PASS | N/A para esta feature. |
| I.5 Migrations imutáveis | ✅ PASS | Nova migration `015_add_participante_enhancements.sql`. Apenas adições — sem coluna legada a remover, sem sequência especial. |
| II.1 Processo canônico | ✅ N/A | Feature não cria nova tabela associada à `reuniao`. ALTER TABLE simples. |
| IV.1 Padrão de rota backend | ✅ PASS | Extensão de `src/routes/participants.js` existente. |
| IV.2 Padrão frontend Alpine | ✅ PASS | Replicar padrão `_quillProjectEditor` para `_quillParticipantEditor`. Replicar `projectStatusFilter` para `participantStatusFilter`. |

**Resultado: APROVADO — nenhuma violação.**

## Project Structure

### Documentation (this feature)

```text
specs/011-enhance-participantes/
├── plan.md              ← este arquivo
├── research.md          ← decisões técnicas resolvidas
├── data-model.md        ← schema da tabela participante atualizado
├── quickstart.md        ← deploy e verificação
├── contracts/
│   └── participants-api.md  ← contrato REST atualizado
├── checklists/
│   └── requirements.md
└── tasks.md             ← gerado por /speckit.tasks
```

### Source Code

```text
migrations/
└── 015_add_participante_enhancements.sql   ← novo

src/routes/
└── participants.js     ← modificar (novos campos, filtro ativo)

public/
├── index.html          ← modificar (campos lotacao, ativo, notas no formulário; filtro status na lista)
└── assets/app.js       ← modificar (estado Alpine, Quill, filtros)
```

## Implementation Guide

### Backend — `src/routes/participants.js`

**GET /api/participants**:
- Adicionar suporte a `?ativo=1`: quando presente, acrescentar `AND ativo = TRUE` ao WHERE
- Estender busca `?q=`: incluir `OR lotacao LIKE ?` além de `nome LIKE ?` e `instituicao LIKE ?`
- Adicionar `lotacao`, `ativo` ao SELECT (não incluir `notas` na listagem)

**POST /api/participants**:
- Aceitar `lotacao`, `ativo`, `notas` no body
- Inserir no INSERT: `(nome, instituicao, lotacao, cargo, email, ativo, notas)`
- Retornar todos os campos incluindo `notas` no 201

**PUT /api/participants/:id**:
- Aceitar e atualizar `lotacao`, `ativo`, `notas`
- Retornar todos os campos incluindo `notas` no 200

### Migration — `migrations/015_add_participante_enhancements.sql`

```sql
ALTER TABLE participante
  ADD COLUMN `lotacao` VARCHAR(255) NULL AFTER `instituicao`,
  ADD COLUMN `ativo`   BOOLEAN      NOT NULL DEFAULT TRUE AFTER `email`,
  ADD COLUMN `notas`   TEXT         NULL AFTER `ativo`,
  ADD KEY `idx_ativo` (`ativo`);
```

### Frontend — `public/assets/app.js`

**Variável module-level** (junto com `_quillProjectEditor`):
```js
let _quillParticipantEditor = null
```

**Estado Alpine** — estender `participantForm`:
```js
participantForm: { nome: '', instituicao: '', lotacao: '', cargo: '', email: '', ativo: true, notas: '' }
```

**Novo estado** — filtro de status (junto com `projectStatusFilter`):
```js
participantStatusFilter: ''
```

**Getter `filteredParticipantList`** — adicionar lógica de status filter (replicar `filteredProjectList`):
```js
get filteredParticipantList() {
  const status = this.participantStatusFilter
  let list = this.participantListAll
  if (status) {
    list = list.filter(p => {
      if (status === 'ativo' && !p.ativo) return false
      if (status === 'inativo' && p.ativo) return false
      return true
    })
  }
  return [...list].sort(...)  // manter sort existente
}
```

**Getter `filteredParticipants`** (autocomplete de reunião) — adicionar `lotacao`:
```js
return p.nome.toLowerCase().includes(q) ||
  (p.instituicao && p.instituicao.toLowerCase().includes(q)) ||
  (p.lotacao && p.lotacao.toLowerCase().includes(q))
```

**`loadParticipants()`** — adicionar filtro `ativo=1`:
```js
const res = await fetch('/api/participants?limit=500&ativo=1')
```

**Invalidação do cache após salvar participante** — em `saveParticipant()`:
```js
this.allParticipants = []  // força reload do autocomplete na próxima abertura
```

**Inicialização do Quill** — no `$watch('activeTab')`, adicionar caso `'participants'`:
```js
if (tab === 'participants' && !_quillParticipantEditor) {
  _quillParticipantEditor = new Quill('#quill-participant-editor', { ... })
  // + paste handler (replicar do projeto)
}
```

**`openNewParticipant()`** — resetar form com novos campos + limpar Quill:
```js
this.participantForm = { nome: '', instituicao: '', lotacao: '', cargo: '', email: '', ativo: true, notas: '' }
// + _quillParticipantEditor.setContents([{ insert: '\n' }])
```

**`openEditParticipant(p)`** — carregar novos campos + preencher Quill:
```js
this.participantForm = { nome: p.nome, instituicao: p.instituicao || '', lotacao: p.lotacao || '',
                         cargo: p.cargo || '', email: p.email || '', ativo: p.ativo, notas: p.notas || '' }
// + loadNotasIntoQuill(_quillParticipantEditor, p.notas)
```

**`saveParticipant()`** — incluir novos campos no payload:
```js
body: JSON.stringify({
  nome, instituicao, lotacao, cargo, email,
  ativo: this.participantForm.ativo,
  notas: _quillParticipantEditor ? _quillParticipantEditor.root.innerHTML : null
})
```

### Frontend — `public/index.html`

**Formulário de participante** — adicionar campos na ordem correta:
1. Campo `lotacao` (text input) após o campo `instituicao`
2. Toggle/checkbox `ativo` após o campo `email`
3. Editor Quill `#quill-participant-editor` ao final do formulário

**Lista de manutenção de participantes** — adicionar:
1. Botões de filtro "Todos / Ativos / Inativos" (replicar padrão da lista de projetos)
2. Coluna ou indicador de `lotacao` nas linhas da lista
3. Badge visual para participantes inativos (replicar padrão de projetos)

## Complexity Tracking

Nenhuma violação da constitution. Seção não aplicável.
