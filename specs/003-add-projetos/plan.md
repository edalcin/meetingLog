# Implementation Plan: Add Projetos e Menu de Navegação

**Branch**: `003-add-projetos` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-add-projetos/spec.md`

## Summary

Adicionar uma tabela relacional de projetos ao sistema de registro de reuniões. A feature envolve: (1) duas migrations SQL para criar as tabelas `projeto` e `reuniao_projeto` e remover a coluna `projeto` TEXT legada; (2) um script de dados (nunca commitado) que importa 49 projetos do CSV e migra associações legadas parseando o campo TEXT por vírgula; (3) uma nova rota de API `GET /api/projects`; (4) modificação das rotas de meetings para aceitar `projeto_ids[]` e retornar nomes/ids via JOIN; (5) substituição do campo texto de projeto no frontend por um componente Alpine.js de multi-select com o mesmo padrão dos participantes; e (6) adição de menu de navegação com tabs Reuniões/Participantes/Projetos no topo da aplicação.

## Technical Context

**Language/Version**: Node.js 22, ES modules
**Primary Dependencies**: Hono (web framework), mysql2/promise (MariaDB driver), Alpine.js CDN, Tailwind CSS CDN
**Storage**: MariaDB — tabelas `projeto`, `reuniao_projeto`; remoção de `reuniao.projeto` VARCHAR(255)
**Testing**: `npm test` (testes unitários existentes)
**Target Platform**: Linux (Docker node:22-alpine, UNRAID)
**Project Type**: Web service + SPA frontend (no build step)
**Performance Goals**: Filtro de projetos instantâneo no cliente; GET /api/projects ≤ 200ms
**Constraints**: Sem dependências de frontend além de Alpine.js e Tailwind CDN; script de migração com credenciais nunca commitado
**Scale/Scope**: 49 projetos, single-user

## Constitution Check

| Princípio | Status | Observação |
|-----------|--------|------------|
| I.1 — Simplicidade | ✅ PASS | Multi-select reutiliza padrão existente; sem abstrações novas |
| I.2 — Sem build step | ✅ PASS | Apenas Alpine.js CDN + Tailwind CDN |
| I.3 — SQL parametrizado | ✅ PASS | Todos os INSERTs/SELECTs usam `?` com array de parâmetros |
| I.4 — Credenciais fora do repo | ✅ PASS | Script em `docs/source/scripts/` (gitignored) |
| I.5 — Migrations imutáveis/sequenciais | ✅ PASS | 005 e 006 em arquivos separados, numeração correta |
| II.1 — Processo canônico | ✅ PASS | Duas migrations separadas; script de dados entre elas; quickstart documenta sequência |
| II.3 — INSERT IGNORE + idempotência | ✅ PASS | Script usa INSERT IGNORE com UNIQUE KEY em `nome` |

**Nenhuma violação detectada.** Complexity Tracking não necessário.

## Project Structure

### Documentation (this feature)

```text
specs/003-add-projetos/
├── plan.md              # Este arquivo
├── spec.md              # Especificação da feature
├── research.md          # Decisões técnicas e rationale
├── data-model.md        # Schema das tabelas e fluxos de dados
├── quickstart.md        # Sequência de execução obrigatória
├── contracts/
│   └── api.md           # Contratos dos endpoints REST
└── tasks.md             # (gerado por /speckit.tasks)
```

### Source Code (repository root)

```text
migrations/
├── 005_add_projetos.sql           # NOVO: cria projeto + reuniao_projeto
└── 006_drop_projeto_col.sql       # NOVO: remove coluna VARCHAR legada

docs/source/scripts/               # gitignored — nunca commitado
└── migrate-projetos.js            # NOVO: importa CSV + migra associações legadas

src/
├── db.js                          # Sem alteração
├── server.js                      # Modificado: registra /api/projects
├── migrate.js                     # Sem alteração
└── routes/
    ├── meetings.js                # Modificado: JOIN projeto, projeto_ids, projeto_nomes
    ├── participants.js            # Sem alteração
    └── projects.js                # NOVO: GET /api/projects

public/
├── index.html                     # Modificado: menu de navegação + seção Projetos + multi-select projeto
└── assets/
    └── app.js                     # Modificado: estado projetos, multi-select, navegação por tabs
```

**Structure Decision**: Estrutura single-project com backend e frontend no mesmo container. Segue exatamente o padrão estabelecido pela feature 002-add-participantes.

---

## Phase 0 — Research

Concluída. Ver [research.md](./research.md).

**Todas as NEEDS CLARIFICATION resolvidas:**
- Tipo de relação: N:N confirmado (CSV contém múltiplos projetos por reunião)
- Número de migrations: 005 e 006
- Campos da tabela `projeto`: nome, ativo, instituicao
- Estratégia de matching legado: split por vírgula + lookup por nome exato
- Tratamento de inativos no formulário: pré-selecionados, removíveis, não re-adicionáveis

---

## Phase 1 — Design & Contracts

Concluída.

- [data-model.md](./data-model.md) — Schema de `projeto`, `reuniao_projeto`, alterações em `reuniao`
- [contracts/api.md](./contracts/api.md) — `GET /api/projects` + modificações em meetings endpoints
- [quickstart.md](./quickstart.md) — Sequência obrigatória de execução

---

## Sequência de Implementação

Seguindo o processo canônico da constituição (seção II.1), com prioridades alinhadas à spec:

```
P1 — Script de migração de dados (pré-requisito de tudo)
  ├── Criar docs/source/scripts/migrate-projetos.js
  └── Criar migrations/005_add_projetos.sql
       ↓ (executar 005 + script de dados ANTES de continuar)

P2 — API e listagem de projetos
  ├── Criar src/routes/projects.js
  ├── Registrar rota em src/server.js
  └── Criar tela de listagem de projetos no frontend

P3 — Associação projetos ↔ reuniões
  ├── Modificar src/routes/meetings.js (JOIN + projeto_ids)
  ├── Modificar public/assets/app.js (multi-select projetos)
  └── Modificar public/index.html (campo multi-select no formulário)

P4 — Menu de navegação + migration de limpeza
  ├── Adicionar menu Reuniões/Participantes/Projetos no index.html
  ├── Adicionar lógica de tabs no app.js
  └── Criar migrations/006_drop_projeto_col.sql
       ↓ (executar 006 APÓS tudo funcional e validado)
```

> **⚠️ ATENÇÃO**: Nunca executar `npm run migrate` cobrindo 005 e 006 juntos de uma vez.
> A 006 deve ser aplicada **somente após** `migrate-projetos.js` ter rodado com sucesso.
> Ver [quickstart.md](./quickstart.md) para sequência detalhada.
