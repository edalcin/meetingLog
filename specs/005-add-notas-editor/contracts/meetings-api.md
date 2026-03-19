# API Contract: Meetings (updated for notas)

**Feature**: 005-add-notas-editor
**Base path**: `/api/meetings`

---

## GET /api/meetings

Paginated list. **`notas` is NOT included** — list view omits heavy text fields.

Response shape unchanged from current implementation.

---

## GET /api/meetings/:id

Returns full meeting detail including notes.

### Response (200 OK)

```json
{
  "id": 42,
  "data_hora": "2026-03-13T14:00:00.000Z",
  "tipo": "Presencial",
  "notas": "#### Decisões\n- Vivi coordena o ACT\n- Dalcin coordena o GEF",
  "criado_em": "...",
  "atualizado_em": "...",
  "participantes": [...],
  "participante_ids": [1, 2],
  "participantes_nomes": "...",
  "projetos": [...],
  "projeto_ids": [3],
  "projeto_nomes": "...",
  "pautas": [...]
}
```

**`notas`**: string or `null`. Newlines are literal `\n` in JSON.

---

## POST /api/meetings

Creates a new meeting. `notas` is optional.

### Request Body

```json
{
  "data_hora": "2026-03-19T14:00:00",
  "tipo": "Presencial",
  "notas": "- Item 1\n- Item 2",
  "participante_ids": [1, 2],
  "projeto_ids": [3],
  "pautas": ["Pauta 1", "Pauta 2"]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `notas` | string \| null | No | Any string; `null` or omitted → stored as NULL |

### Response (201 Created)

Same shape as `GET /api/meetings/:id`.

---

## PUT /api/meetings/:id

Updates a meeting. `notas` is optional — if omitted, existing value is set to NULL.

### Request Body

Same as POST. `notas` follows same rules.

### Response (200 OK)

Same shape as `GET /api/meetings/:id`.
