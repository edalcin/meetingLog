# API Contract: Meeting Log Application

**Phase**: 1 — Design
**Date**: 2026-03-14

All endpoints are served by the Hono backend under the `/api` prefix. The frontend is served as static files from the same process.

---

## Authentication

PIN verification is handled client-side using `sessionStorage`. The server does **not** enforce PIN authentication on API calls (the app is deployed on a private UNRAID LAN, not exposed to the internet). The PIN is used only as a UI gate.

> If future requirements demand server-side auth, a middleware check against `APP_PIN` can be added to all `/api/*` routes.

---

## Endpoints

### `GET /api/health`

Health check for container readiness probes and UNRAID monitoring.

**Response `200 OK`**
```json
{ "status": "ok", "db": "connected" }
```

**Response `503 Service Unavailable`** (DB unreachable)
```json
{ "status": "error", "db": "disconnected" }
```

---

### `GET /api/meetings`

Returns paginated, filterable, sortable list of meetings.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | `""` | Free-text filter applied to `projeto` and `participantes` |
| `sort` | string | `"data_hora"` | Column to sort by: `data_hora`, `tipo`, `participantes`, `projeto` |
| `order` | string | `"desc"` | Sort direction: `asc` or `desc` |
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `50` | Rows per page (max 200) |

**Response `200 OK`**
```json
{
  "data": [
    {
      "id": 1,
      "data_hora": "2026-03-13T14:00:00",
      "tipo": "Presencial",
      "participantes": "Leonardo Salgado, Viviane Fonseca",
      "projeto": "Useflora",
      "criado_em": "2026-03-14T10:00:00",
      "atualizado_em": "2026-03-14T10:00:00"
    }
  ],
  "total": 312,
  "page": 1,
  "limit": 50,
  "pages": 7
}
```

**Errors**
- `400 Bad Request` — invalid `sort` column or `order` value

---

### `GET /api/meetings/:id`

Returns a single meeting by ID.

**Response `200 OK`**
```json
{
  "id": 1,
  "data_hora": "2026-03-13T14:00:00",
  "tipo": "Presencial",
  "participantes": "Leonardo Salgado, Viviane Fonseca",
  "projeto": "Useflora",
  "criado_em": "2026-03-14T10:00:00",
  "atualizado_em": "2026-03-14T10:00:00"
}
```

**Errors**
- `404 Not Found` — no meeting with that ID

---

### `POST /api/meetings`

Creates a new meeting.

**Request Body** (`application/json`)
```json
{
  "data_hora": "2026-03-15T10:00:00",
  "tipo": "Remota",
  "participantes": "João Silva, Maria Santos",
  "projeto": "Useflora"
}
```

**Validation Rules**
- `data_hora`: required, valid ISO 8601 datetime string
- `tipo`: required, one of `"Presencial"` or `"Remota"`
- `participantes`: required, non-empty string
- `projeto`: required, non-empty string, max 255 characters

**Response `201 Created`**
```json
{
  "id": 313,
  "data_hora": "2026-03-15T10:00:00",
  "tipo": "Remota",
  "participantes": "João Silva, Maria Santos",
  "projeto": "Useflora",
  "criado_em": "2026-03-14T11:00:00",
  "atualizado_em": "2026-03-14T11:00:00"
}
```

**Errors**
- `400 Bad Request` — validation failure
  ```json
  { "error": "Validation failed", "fields": { "projeto": "Required" } }
  ```

---

### `PUT /api/meetings/:id`

Updates an existing meeting. All fields are required (full replacement).

**Request Body** (`application/json`) — same shape as `POST /api/meetings`

**Response `200 OK`** — returns updated meeting object (same shape as GET single)

**Errors**
- `400 Bad Request` — validation failure
- `404 Not Found` — no meeting with that ID

---

## Error Response Format

All error responses follow this shape:
```json
{
  "error": "Human-readable message",
  "fields": { "fieldName": "Specific issue" }
}
```
`fields` is optional and only present for validation errors.

---

## Static Routes (served by Hono, not REST API)

| Path | Serves |
|------|--------|
| `/` | `public/index.html` |
| `/manifest.json` | `public/manifest.json` |
| `/sw.js` | `public/sw.js` |
| `/assets/*` | `public/assets/*` |
| `/icons/*` | `public/icons/*` |
