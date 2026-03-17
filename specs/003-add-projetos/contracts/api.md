# API Contract: Projetos

**Branch**: `003-add-projetos` | **Date**: 2026-03-17

---

## Novo Endpoint: Listar Projetos

### `GET /api/projects`

Lista projetos cadastrados, com suporte a filtro e opção de retornar apenas ativos.

**Query Parameters**:

| Parâmetro  | Tipo    | Padrão | Descrição                                          |
|------------|---------|--------|----------------------------------------------------|
| q          | string  | ""     | Filtro por nome ou instituição (LIKE %q%)          |
| activeOnly | boolean | false  | Se `true`, retorna apenas projetos com ativo=TRUE  |
| limit      | int     | 200    | Máximo de resultados (max 500)                     |

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "nome": "Amazonia+10",
      "ativo": true,
      "instituicao": null
    },
    {
      "id": 3,
      "nome": "CITES",
      "ativo": false,
      "instituicao": "CITES"
    }
  ],
  "total": 49
}
```

---

## Endpoints Modificados: Reuniões

### `POST /api/meetings` *(modificado)*

**Request Body**:
```json
{
  "data_hora": "2026-03-17T14:00:00",
  "tipo": "Presencial",
  "participante_ids": [1, 5, 42],
  "projeto_ids": [3, 12]
}
```

**Mudança**: campo `projeto` (string) substituído por `projeto_ids` (array de IDs inteiros). Array vazio `[]` é válido — projetos são opcionais.

**Validation errors 400**:
```json
{
  "error": "Validation failed",
  "fields": {
    "projeto_ids": "IDs inválidos — projetos não encontrados: [99]"
  }
}
```

**Response 201**: Reunião criada com projetos expandidos.
```json
{
  "id": 10,
  "data_hora": "2026-03-17T14:00:00.000Z",
  "tipo": "Presencial",
  "participantes_nomes": "Eduardo Dalcin, Viviane Fonseca",
  "participante_ids": [1, 5],
  "projeto_nomes": "Amazonia+10, Useflora",
  "projeto_ids": [1, 49],
  "projetos": [
    { "id": 1, "nome": "Amazonia+10", "ativo": true, "instituicao": null },
    { "id": 49, "nome": "Useflora",   "ativo": true, "instituicao": null }
  ],
  "criado_em": "2026-03-17T14:00:00.000Z",
  "atualizado_em": "2026-03-17T14:00:00.000Z"
}
```

---

### `PUT /api/meetings/:id` *(modificado)*

Mesmo contrato de request/response que POST, mas retorna 200 e substitui completamente as associações de projetos.

---

### `GET /api/meetings` *(modificado)*

**Response 200** — cada item inclui `projeto_nomes` (string) e `projeto_ids` (array). Campo `projeto` TEXT removido.

```json
{
  "data": [
    {
      "id": 10,
      "data_hora": "2026-03-17T14:00:00.000Z",
      "tipo": "Presencial",
      "participantes_nomes": "Eduardo Dalcin, Viviane Fonseca",
      "participante_ids": [1, 5],
      "projeto_nomes": "Amazonia+10, Useflora",
      "projeto_ids": [1, 49],
      "criado_em": "...",
      "atualizado_em": "..."
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 50,
  "pages": 1
}
```

**Mudança**: campo `projeto` (TEXT) removido; substituído por `projeto_nomes` (string computada via GROUP_CONCAT) e `projeto_ids` (array de inteiros).

---

### `GET /api/meetings/:id` *(modificado)*

**Response 200** — inclui array completo de projetos:

```json
{
  "id": 10,
  "data_hora": "2026-03-17T14:00:00.000Z",
  "tipo": "Presencial",
  "participantes_nomes": "Eduardo Dalcin, Viviane Fonseca",
  "participantes": [
    { "id": 1, "nome": "Eduardo Dalcin", "instituicao": "JBRJ", "cargo": null, "email": null }
  ],
  "participante_ids": [1, 5],
  "projeto_nomes": "Amazonia+10, Useflora",
  "projetos": [
    { "id": 1, "nome": "Amazonia+10", "ativo": true, "instituicao": null },
    { "id": 49, "nome": "Useflora",   "ativo": true, "instituicao": null }
  ],
  "projeto_ids": [1, 49],
  "criado_em": "...",
  "atualizado_em": "..."
}
```

---

## Resumo das Mudanças de Contrato

| Endpoint              | Mudança                                                                        |
|-----------------------|--------------------------------------------------------------------------------|
| GET /api/projects     | **NOVO** — lista projetos com filtro e opção activeOnly                        |
| POST /api/meetings    | `projeto` string → `projeto_ids` array (opcional, pode ser `[]`)               |
| PUT /api/meetings/:id | `projeto` string → `projeto_ids` array (opcional, pode ser `[]`)               |
| GET /api/meetings     | Adiciona `projeto_nomes`, `projeto_ids`; remove campo `projeto` TEXT           |
| GET /api/meetings/:id | Adiciona `projetos` (array de objetos), `projeto_nomes`, `projeto_ids`; remove `projeto` TEXT |
