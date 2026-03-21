# Implementation Plan: Adicionar Tabela de Links às Reuniões

**Branch**: `006-add-links-table` | **Date**: 2026-03-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/006-add-links-table/spec.md`

---

## Summary

Adicionar a entidade `link` (documento/recurso externo relacionado) ao sistema, com relação 1:N à tabela `reuniao`. A feature inclui: migration de criação da tabela, script de importação dos dados históricos do CSV `memoriaReunioes-DocsRelacionados.csv`, endpoints de API integrados ao ciclo de save/load de reuniões, card de links nos formulários de criação e edição, e exibição somente-leitura no painel de detalhes.

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
**Scale/Scope**: Single-user, dataset histórico ~323 registros de links

---

## Constitution Check

| Gate | Status | Observação |
|------|--------|------------|
| Simplicidade (I.1) | ✅ PASS | Links salvos via endpoints de meeting existentes — sem nova rota autônoma |
| Sem build step (I.2) | ✅ PASS | Apenas Alpine.js e vanilla JS |
| SQL parametrizado (I.3) | ✅ PASS | Todos os queries usarão `?` com array de parâmetros |
| Credenciais fora do repo (I.4) | ✅ PASS | Script em `docs/source/scripts/` (gitignored) |
| Migrations imutáveis e sequenciais (I.5) | ✅ PASS | Apenas `010_add_link.sql`; sem coluna legada a remover |
| Processo canônico para nova tabela (II.1) | ✅ PASS | Sequência: specify → clarify → plan → tasks → implement → migrate → script |
| Tipo de relação correto (II.2) | ✅ PASS | 1:N — `link.reuniao_id FK` (cada link pertence a uma reunião) |
| Idempotência do script (II.3) | ✅ PASS | UNIQUE KEY `(reuniao_id, url(500))` + INSERT IGNORE; chave clarificada em /speckit.clarify |

**Nenhuma violação encontrada.** Sem complexidade a justificar.

---

## Project Structure

### Documentation (this feature)

```text
specs/006-add-links-table/
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
└── 010_add_link.sql        ← NOVO: CREATE TABLE link

src/routes/
└── meetings.js             ← MODIFICAR: GET /:id inclui links; POST/PUT aceita links[]

public/
├── index.html              ← MODIFICAR: card de links no formulário + seção no painel de detalhes
└── assets/app.js           ← MODIFICAR: estado e métodos para links

docs/source/scripts/        ← gitignored
└── migrate-links.js        ← NOVO: importa CSV para tabela link
```

**Structure Decision**: Single project — backend Hono + frontend Alpine.js. Sem nova rota autônoma para links; integrada ao ciclo de meetings, espelhando o padrão de pautas.

---

## Complexity Tracking

Nenhuma violação de constituição. Seção não aplicável.
