# API Contract: Participantes

**Branch**: `002-add-participantes` | **Date**: 2026-03-15

---

## Novo Endpoint: Listar Participantes

### `GET /api/participants`

Lista todos os participantes cadastrados, com suporte a filtro.

**Query Parameters**:

| Parâmetro | Tipo   | Padrão | Descrição                                      |
|-----------|--------|--------|------------------------------------------------|
| q         | string | ""     | Filtro por nome ou instituição (LIKE %q%)      |
| limit     | int    | 200    | Máximo de resultados (max 500)                 |

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "nome": "Eduardo Dalcin",
      "instituicao": "JBRJ",
      "cargo": null,
      "email": null
    }
  ],
  "total": 383
}
```

---

## Endpoints Modificados: Reuniões

### `POST /api/meetings` *(modificado)*

**Request Body**:
```json
{
  "data_hora": "2026-03-15T14:00:00",
  "tipo": "Presencial",
  "participante_ids": [1, 5, 42],
  "projeto": "Nome do Projeto"
}
```

**Mudança**: campo `participantes` (string) substituído por `participante_ids` (array de IDs inteiros). Ao menos 1 ID obrigatório.

**Validation errors 400**:
```json
{
  "error": "Validation failed",
  "fields": {
    "participante_ids": "Obrigatório — selecione ao menos um participante"
  }
}
```

**Response 201**: Reunião criada com participantes expandidos.
```json
{
  "id": 10,
  "data_hora": "2026-03-15T14:00:00.000Z",
  "tipo": "Presencial",
  "participantes_nomes": "Eduardo Dalcin, Viviane Fonseca",
  "participantes": [
    { "id": 1, "nome": "Eduardo Dalcin", "instituicao": "JBRJ" },
    { "id": 5, "nome": "Viviane Fonseca", "instituicao": "JBRJ" }
  ],
  "participante_ids": [1, 5],
  "projeto": "Nome do Projeto",
  "criado_em": "2026-03-15T14:00:00.000Z",
  "atualizado_em": "2026-03-15T14:00:00.000Z"
}
```

---

### `PUT /api/meetings/:id` *(modificado)*

Mesmo contrato de request/response que POST, mas retorna 200 e substitui completamente as associações de participantes.

---

### `GET /api/meetings` *(modificado)*

**Response 200** — cada item inclui campo `participantes_nomes` (string com nomes separados por vírgula) e `participante_ids` (array de IDs):

```json
{
  "data": [
    {
      "id": 10,
      "data_hora": "2026-03-15T14:00:00.000Z",
      "tipo": "Presencial",
      "participantes_nomes": "Eduardo Dalcin, Viviane Fonseca",
      "participante_ids": [1, 5],
      "projeto": "Nome do Projeto",
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

**Mudança**: campo `participantes` (TEXT) removido; substituído por `participantes_nomes` (string computada) e `participante_ids` (array).

**Ordenação**: opção `sort=participantes` removida. Valores válidos: `data_hora`, `tipo`, `projeto`.

---

### `GET /api/meetings/:id` *(modificado)*

**Response 200** — inclui array completo de participantes:

```json
{
  "id": 10,
  "data_hora": "2026-03-15T14:00:00.000Z",
  "tipo": "Presencial",
  "participantes_nomes": "Eduardo Dalcin, Viviane Fonseca",
  "participantes": [
    { "id": 1, "nome": "Eduardo Dalcin", "instituicao": "JBRJ", "cargo": null, "email": null },
    { "id": 5, "nome": "Viviane Fonseca", "instituicao": "JBRJ", "cargo": null, "email": null }
  ],
  "participante_ids": [1, 5],
  "projeto": "Nome do Projeto",
  "criado_em": "...",
  "atualizado_em": "..."
}
```

---

## Resumo das Mudanças de Contrato

| Endpoint              | Mudança                                                         |
|-----------------------|-----------------------------------------------------------------|
| GET /api/participants | **NOVO** — lista participantes com filtro                       |
| POST /api/meetings    | `participantes` string → `participante_ids` array              |
| PUT /api/meetings/:id | `participantes` string → `participante_ids` array              |
| GET /api/meetings     | Adiciona `participantes_nomes`, `participante_ids`; remove `participantes`; remove sort por `participantes` |
| GET /api/meetings/:id | Adiciona `participantes` (array de objetos), `participante_ids`; remove `participantes` string |
