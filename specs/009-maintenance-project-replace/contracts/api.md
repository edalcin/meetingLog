# API Contract: Manutenção — Substituição de Projetos

**Feature**: `009-maintenance-project-replace`
**Date**: 2026-03-24

---

## POST /api/maintenance/replace-project

Executa simulação (dry run) ou substituição definitiva de projeto em reuniões.

### Request

```
POST /api/maintenance/replace-project
Content-Type: application/json
```

```json
{
  "from_id": 12,
  "to_id": 7,
  "dry_run": true
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `from_id` | integer > 0 | ✅ | ID do projeto de origem (a ser substituído) |
| `to_id` | integer > 0 | ✅ | ID do projeto de destino |
| `dry_run` | boolean | ✅ | `true` = apenas simular; `false` = executar substituição |

### Respostas

#### 200 — dry_run: true (simulação)

```json
{
  "affected": [
    {
      "id": 42,
      "data_fmt": "13/01/2026, 13:00",
      "participantes_nomes": "Lucas Zelesco, Viviane Fonseca"
    },
    {
      "id": 38,
      "data_fmt": "05/11/2025, 10:00",
      "participantes_nomes": "—"
    }
  ],
  "count": 2
}
```

#### 200 — dry_run: false (execução bem-sucedida)

```json
{
  "updated": 2
}
```

#### 400 — Validação

```json
{ "error": "from_id e to_id são obrigatórios" }
{ "error": "from_id e to_id devem ser diferentes" }
{ "error": "Projeto de origem não encontrado" }
{ "error": "Projeto de destino não encontrado" }
```

#### 500 — Erro interno

```json
{ "error": "Erro interno ao executar substituição" }
```

---

## Endpoints existentes reutilizados pelo frontend

### POST /api/projects (criação inline de projeto)

Já existente em `src/routes/projects.js`. Usado pelo método `maintCreateProject(nome)` quando o usuário digita um nome que não existe no campo PARA.

```json
// Request
{ "nome": "GO FAIR", "ativo": true }

// Response 201
{ "id": 99, "nome": "GO FAIR", "ativo": true, "instituicao_nomes": "", "instituicao_ids": [] }
```

### GET /api/projects?limit=500

Usado para carregar a lista de projetos nos dropdowns DE e PARA. Já existe; reutiliza `allProjects` do estado Alpine.js.
