# API Contract: /api/projects (updated)

**Feature**: 008-multi-institution-projects
**Date**: 2026-03-23

---

## GET /api/projects

**Query params**: `q` (string, opcional), `activeOnly` (boolean, opcional), `limit` (int, padrão 200)

**Mudança**: O campo `q` agora busca também em `i.sigla` e `i.nome` via LEFT JOIN com `projeto_instituicao` + `instituicao`.

### Response 200

```json
{
  "data": [
    {
      "id": 1,
      "nome": "Projeto Exemplo",
      "ativo": true,
      "instituicao_nomes": "MEC, UFMG",
      "instituicao_ids": [2, 5],
      "reuniao_count": 3
    }
  ],
  "total": 10
}
```

**Campos removidos**: `instituicao` (string legada)
**Campos adicionados**:
- `instituicao_nomes`: string com siglas separadas por vírgula, `""` se vazio
- `instituicao_ids`: array de integers, `[]` se vazio

---

## POST /api/projects

### Request body

```json
{
  "nome": "Novo Projeto",
  "ativo": true,
  "instituicao_ids": [2, 5]
}
```

**Campos removidos**: `instituicao` (string)
**Campos adicionados**: `instituicao_ids` (integer[], opcional, padrão `[]`)

### Response 201

```json
{
  "id": 10,
  "nome": "Novo Projeto",
  "ativo": true,
  "instituicao_nomes": "MEC, UFMG",
  "instituicao_ids": [2, 5]
}
```

### Errors

| Status | Condição |
|--------|----------|
| 400 | `nome` vazio ou ausente |
| 400 | `nome` > 255 caracteres |
| 400 | `instituicao_ids` contém ID inexistente (FK violation) |

---

## PUT /api/projects/:id

### Request body

Idêntico ao POST.

### Comportamento

Substitui completamente os vínculos de instituição: DELETE FROM `projeto_instituicao` WHERE `projeto_id=?` + INSERT IGNORE para cada ID recebido. Operação em transação.

### Response 200

Idêntico ao Response 201 do POST.

### Errors

| Status | Condição |
|--------|----------|
| 400 | `nome` vazio ou ausente |
| 400 | `nome` > 255 caracteres |
| 404 | Projeto não encontrado |

---

## DELETE /api/projects/:id

**Sem mudança.** Continua bloqueando exclusão se o projeto estiver vinculado a reuniões.

---

## Sem mudança

- `GET /api/institutions` — já usa `projeto_instituicao` para contar projetos
- `DELETE /api/institutions/:id` — já usa `projeto_instituicao` para bloqueio
