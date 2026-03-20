# Implementation Plan: Tabela de Participantes e Seleção em Reuniões

**Branch**: `002-add-participantes` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-add-participantes/spec.md`

## Summary

Adicionar uma tabela relacional de participantes ao sistema de registro de reuniões. A feature envolve: (1) duas migrations SQL para criar as tabelas `participante` e `reuniao_participante` e remover a coluna `participantes` TEXT legada; (2) um script de dados (nunca commitado) que importa ~383 participantes do CSV e migra associações legadas por correspondência de nome; (3) uma nova rota de API `GET /api/participants`; (4) modificação das rotas de meetings para aceitar `participante_ids[]` e retornar nomes via JOIN; e (5) substituição do textarea de participantes no frontend por um componente Alpine.js de multi-select com busca em tempo real.

## Technical Context

**Language/Version**: Node.js 22, ES modules
**Primary Dependencies**: Hono (web framework), mysql2/promise (MariaDB driver), Alpine.js CDN, Tailwind CSS CDN
**Storage**: MariaDB — tabelas `participante`, `reuniao_participante`; remoção de `reuniao.participantes` TEXT
**Testing**: `npm test` (testes unitários existentes)
**Target Platform**: Linux (Docker node:22-alpine, UNRAID)
**Project Type**: Web service + SPA frontend (no build step)
**Performance Goals**: Filtro de participantes instantâneo no cliente; GET /api/participants ≤ 200ms
**Constraints**: Sem dependências de frontend além de Alpine.js e Tailwind CDN; script de migração com credenciais nunca commitado
**Scale/Scope**: ~383 participantes, single-user

## Constitution Check

*Nenhum arquivo de constituição encontrado (`/.specify/memory/constitution.md`). Gates não aplicáveis.*

## Project Structure

### Documentation (this feature)

```text
specs/002-add-participantes/
├── plan.md              # Este arquivo
├── spec.md              # Especificação da feature
├── research.md          # Decisões técnicas e rationale
├── data-model.md        # Schema das tabelas e fluxos de dados
├── quickstart.md        # Como configurar e executar
├── contracts/
│   └── api.md           # Contratos dos endpoints REST
└── tasks.md             # (gerado por /speckit.tasks)
```

### Source Code (repository root)

```text
migrations/
├── 003_add_participantes.sql        # Novo: cria participante + reuniao_participante
└── 004_drop_participantes_col.sql   # Novo: remove coluna TEXT legada

src/
├── db.js                            # Sem alteração
├── server.js                        # Modificado: registra /api/participants
├── migrate.js                       # Sem alteração
└── routes/
    ├── meetings.js                  # Modificado: JOIN, participante_ids, sem sort por participantes
    └── participants.js              # NOVO: GET /api/participants

public/
├── index.html                       # Modificado: multi-select em vez de textarea
└── assets/
    └── app.js                       # Modificado: lógica de multi-select e API

docs/source/scripts/                 # NUNCA commitado (.gitignore)
└── migrate-participantes.js         # Script de dados (CSV import + legado)

.gitignore                           # Modificado: adiciona docs/source/scripts/
```

## Implementation Phases

### Phase 1 — Database Schema

1. Criar `migrations/003_add_participantes.sql`:
   - Tabela `participante` com UNIQUE em `nome`
   - Tabela `reuniao_participante` com FK + CASCADE DELETE
   - Não remove `participantes` TEXT ainda (necessário para migração de dados)

2. Criar `migrations/004_drop_participantes_col.sql`:
   - `ALTER TABLE reuniao DROP COLUMN participantes`
   - Executar somente após script de dados

### Phase 2 — Script de Dados (não commitado)

1. Criar `docs/source/scripts/migrate-participantes.js`:
   - Conecta com credenciais via variáveis de ambiente (DB_USER / DB_PASSWORD)
   - INSERT IGNORE de todos os participantes do CSV
   - Percorre `reuniao`, tokeniza `participantes` TEXT, busca por nome exato, insere em `reuniao_participante`
   - Log de nomes sem correspondência

2. Atualizar `.gitignore`: adicionar `docs/source/scripts/`

### Phase 3 — Backend API

1. Criar `src/routes/participants.js`:
   - `GET /api/participants?q=&limit=` com filtro por nome/instituição

2. Modificar `src/routes/meetings.js`:
   - `GET /`: JOIN com `reuniao_participante` + `participante`, GROUP_CONCAT para `participantes_nomes`, remover sort por `participantes`
   - `GET /:id`: retorna array `participantes` e `participante_ids`
   - `POST /`: aceita `participante_ids[]`, INSERT em `reuniao_participante`
   - `PUT /:id`: aceita `participante_ids[]`, DELETE + re-INSERT em `reuniao_participante`
   - `validate()`: valida `participante_ids` (array, ≥ 1 elemento)

3. Modificar `src/server.js`: registrar `participantsRouter` em `/api/participants`

### Phase 4 — Frontend

1. Modificar `public/assets/app.js`:
   - Adicionar estado: `allParticipants`, `selectedParticipantIds` (Set), `participantSearch`, `showParticipantDropdown`
   - Adicionar getter `filteredParticipants`
   - Adicionar método `loadParticipants()` — chamado ao abrir formulário
   - Modificar `openForm()`: chama `loadParticipants()`, reseta `selectedParticipantIds`
   - Modificar `editMeeting()`: seta `selectedParticipantIds` a partir de `m.participante_ids`
   - Modificar `saveMeeting()`: envia `participante_ids: Array.from(selectedParticipantIds)` em vez de `participantes`
   - Modificar `loadMeetings()`: usa `m.participantes_nomes` para exibir na tabela
   - Remover sort por coluna `participantes` (ou redirecionar para `data_hora`)

2. Modificar `public/index.html`:
   - Substituir `<textarea x-model="formData.participantes">` pelo componente multi-select:
     - Campo de busca com `x-model="participantSearch"`
     - Dropdown com `x-show="showParticipantDropdown"` listando `filteredParticipants`
     - Tags dos selecionados com botão de remover
     - Mensagem de erro `formErrors.participante_ids`
   - Atualizar célula da tabela: `x-text="m.participantes_nomes"`

## Complexity Tracking

Sem violações de constituição identificadas.
