# Implementation Plan: Adicionar Tabela de Pauta às Reuniões

**Branch**: `004-add-pauta` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-.../spec.md`

---

## Summary

Adicionar a entidade `pauta` (item de agenda) ao sistema, com relação 1:N à tabela `reuniao`. A feature inclui: migration de criação da tabela, script de importação dos dados históricos do CSV, endpoints de API embutidos no ciclo de save/load de reuniões, e card de pautas nos formulários de criação e edição de reuniões no frontend Alpine.js.

---

## Technical Context

**Language/Version**: Node.js 22, ES modules
**Primary Dependencies**: Hono (web framework), mysql2/promise (MariaDB driver), Alpine.js CDN, Tailwind CSS CDN
**Storage**: MariaDB — host configurado via `DB_HOST`/`DB_PORT`, database `reunioes`
**Testing**: Manual (aplicação single-user, sem suite de testes automatizados)
**Target Platform**: Docker container em UNRAID (Linux)
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: Single-user — sem metas formais de throughput
**Constraints**: Sem build step no frontend; SQL parametrizado sempre; credenciais nunca no repositório
**Scale/Scope**: Single-user, dataset histórico ~700 registros de pauta

---

## Constitution Check

| Gate | Status | Observação |
|------|--------|------------|
| Simplicidade (I.1) | ✅ PASS | Pautas salvas via endpoints de meeting existentes — sem nova rota autônoma |
| Sem build step (I.2) | ✅ PASS | Apenas Alpine.js e vanilla JS |
| SQL parametrizado (I.3) | ✅ PASS | Todos os queries usarão `?` com array de parâmetros |
| Credenciais fora do repo (I.4) | ✅ PASS | Script em `docs/source/scripts/` (gitignored) |
| Migrations imutáveis e sequenciais (I.5) | ✅ PASS | Apenas `008_add_pauta.sql`; sem coluna legada a remover |
| Processo canônico para nova tabela (II.1) | ✅ PASS | Sequência: specify → clarify → plan → tasks → implement → migrate → script |
| Tipo de relação correto (II.2) | ✅ PASS | 1:N — `pauta.reuniao_id FK` (cada pauta pertence a uma reunião) |
| Idempotência do script (II.3) | ✅ PASS | UNIQUE KEY `(reuniao_id, texto(500))` + INSERT IGNORE |

**Nenhuma violação encontrada.** Sem complexidade a justificar.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-.../
├── plan.md              ← este arquivo
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← Phase 1 output
└── tasks.md             ← gerado por /speckit.tasks
```

### Source Code (arquivos a criar ou modificar)

```text
migrations/
└── 008_add_pauta.sql       ← NOVO: CREATE TABLE pauta

src/routes/
└── meetings.js             ← MODIFICAR: GET /:id inclui pautas; POST/PUT aceita pautas[]

public/
├── index.html              ← MODIFICAR: card de pautas no formulário de reunião
└── assets/app.js           ← MODIFICAR: estado e métodos para pautas

docs/source/scripts/        ← gitignored
└── migrate-pautas.js       ← NOVO: importa CSV para tabela pauta
```

**Structure Decision**: Single project — backend Hono + frontend Alpine.js. Sem nova rota autônoma para pautas; integrada ao ciclo de meetings.

---

## Complexity Tracking

Nenhuma violação de constituição. Seção não aplicável.
