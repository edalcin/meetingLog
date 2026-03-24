# Implementation Plan: Menu Manutenção — Substituição de Projetos em Reuniões

**Branch**: `009-maintenance-project-replace` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-maintenance-project-replace/spec.md`

---

## Summary

Adicionar uma aba "Manutenção" no menu principal da aplicação, com a operação "Substituição de Projetos": o usuário seleciona um projeto de origem e um de destino, executa um dry run para ver quais reuniões serão afetadas (exibindo data + participantes), e confirma a substituição. A operação é atômica: remove associações duplicatas e remapeia as restantes em uma única transação. Nenhuma nova tabela de banco de dados é necessária — a feature opera exclusivamente sobre a junction table `reuniao_projeto` existente.

---

## Technical Context

**Language/Version**: Node.js 22, ES modules
**Primary Dependencies**: Hono (web framework), mysql2/promise (MariaDB), Alpine.js CDN, Tailwind CSS CDN
**Storage**: MariaDB — tabelas existentes `projeto`, `reuniao_projeto`, `reuniao`, `reuniao_participante`, `participante`
**Testing**: Manual (single-user tool, sem framework de testes automatizados)
**Target Platform**: Docker container, UNRAID
**Project Type**: Web application (SPA + REST API no mesmo container)
**Performance Goals**: Resposta do dry run em < 1s para qualquer volume de reuniões da base
**Constraints**: Sem build step; sem TypeScript; SQL parametrizado obrigatório
**Scale/Scope**: Single-user; dezenas a algumas centenas de reuniões

---

## Constitution Check

| Princípio | Status | Observação |
|-----------|--------|------------|
| I.1 Simplicidade | ✅ Pass | Nova rota única + nova aba no frontend; zero abstrações extras |
| I.2 Sem Build Step | ✅ Pass | Alpine.js + Tailwind CDN; JS vanilla em `app.js` e `index.html` |
| I.3 SQL Parametrizado | ✅ Pass | Todos os IDs passados como `?` com array de parâmetros |
| I.4 Credenciais fora do repo | ✅ N/A | Nenhuma credencial envolvida |
| I.5 Migrations imutáveis/sequenciais | ✅ N/A | Nenhuma migration necessária |
| IV.1 Padrão de rota | ✅ Pass | Novo `src/routes/maintenance.js` + registro em `server.js` |
| IV.2 Padrão Alpine.js | ✅ Pass | Reutiliza `allProjects` + padrão de dropdown existente |

**Resultado**: PASS em todos os gates. Pode avançar para Phase 1.

---

## Project Structure

### Documentation (this feature)

```text
specs/009-maintenance-project-replace/
├── plan.md              ← este arquivo
├── research.md          ← Phase 0 (gerado abaixo)
├── data-model.md        ← Phase 1 (gerado abaixo)
├── contracts/
│   └── api.md           ← Phase 1 (gerado abaixo)
└── tasks.md             ← Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── server.js                    ← registrar maintenanceRouter
└── routes/
    ├── maintenance.js           ← NOVO: POST /api/maintenance/replace-project
    └── projects.js              ← sem alteração

public/
├── index.html                   ← adicionar aba Manutenção + template da tela
└── assets/app.js                ← adicionar estado e métodos de manutenção
```

**Structure Decision**: Single-project (Option 1). Nenhuma migration SQL necessária.

---

## Phase 0: Research

*(Sem NEEDS CLARIFICATION identificados — todas as decisões são derivadas do codebase existente e da constitution.)*

Ver [research.md](research.md).

---

## Phase 1: Design & Contracts

Ver [data-model.md](data-model.md) e [contracts/api.md](contracts/api.md).

---

## Implementation Steps (para /speckit.tasks)

### Backend

1. Criar `src/routes/maintenance.js` com o endpoint `POST /api/maintenance/replace-project`
2. Registrar `maintenanceRouter` em `src/server.js` como `app.route('/api/maintenance', maintenanceRouter)`

### Frontend

3. Adicionar aba "Manutenção" na navegação principal (`index.html`)
4. Adicionar template da tela de Substituição de Projetos em `index.html`
5. Adicionar estado Alpine.js para manutenção em `app.js`:
   - `maintReplaceFrom`, `maintReplaceTo`, `maintReplaceFromSearch`, `maintReplaceToSearch`
   - `showMaintFromDropdown`, `showMaintToDropdown`
   - `maintDryRunResult` (null | `{ affected: [], count: number }`)
   - `maintReplaceLoading`, `maintReplaceError`
6. Adicionar computed `filteredMaintFromProjects` e `filteredMaintToProjects` em `app.js`
7. Adicionar método `maintSimulate()` — chama API com `dry_run: true`
8. Adicionar método `maintConfirm()` — chama API com `dry_run: false`, reseta form após sucesso
9. Adicionar método `maintCreateProject(nome)` — POST `/api/projects`, seleciona no campo PARA
