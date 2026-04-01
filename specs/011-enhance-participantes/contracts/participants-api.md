# API Contract: /api/participants

## GET /api/participants

Lista participantes com busca textual e paginação.

### Query Parameters

| Parâmetro | Tipo    | Obrigatório | Padrão | Descrição |
|-----------|---------|-------------|--------|-----------|
| `q`       | string  | não         | `''`   | Busca textual em `nome`, `instituicao` e `lotacao` (LIKE) |
| `limit`   | integer | não         | `200`  | Máximo de resultados (1–500) |
| `ativo`   | integer | não         | —      | `1` = apenas ativos; omitido = todos |

### Response 200

```json
{
  "data": [
    {
      "id": 1,
      "nome": "João Silva",
      "instituicao": "Ministério X",
      "lotacao": "COGEP",
      "cargo": "Analista",
      "email": "joao@gov.br",
      "ativo": true,
      "reuniao_count": 12
    }
  ],
  "total": 1
}
```

**Nota sobre `notas`**: O campo `notas` (TEXT) **não** é retornado na listagem (GET /) para manter payload leve. É retornado apenas no GET /:id (se implementado) ou no contexto do formulário de edição.

---

## POST /api/participants

Cria novo participante.

### Request Body

```json
{
  "nome": "João Silva",
  "instituicao": "Ministério X",
  "lotacao": "COGEP",
  "cargo": "Analista",
  "email": "joao@gov.br",
  "ativo": true,
  "notas": "<p>Ponto focal para reuniões de acompanhamento.</p>"
}
```

| Campo       | Tipo    | Obrigatório | Validação             |
|-------------|---------|-------------|-----------------------|
| `nome`      | string  | **sim**     | 1–255 chars, único    |
| `instituicao`| string | não         | máx. 255 chars        |
| `lotacao`   | string  | não         | máx. 255 chars        |
| `cargo`     | string  | não         | máx. 255 chars        |
| `email`     | string  | não         | máx. 255 chars        |
| `ativo`     | boolean | não         | default: `true`       |
| `notas`     | string  | não         | TEXT, sem limite fixo |

### Response 201

Retorna o participante criado com todos os campos (incluindo `notas`).

### Response 400

```json
{ "error": "Nome é obrigatório" }
```

---

## PUT /api/participants/:id

Atualiza participante existente.

### Request Body

Mesmos campos do POST (todos opcionais exceto `nome`).

### Response 200

Retorna o participante atualizado com todos os campos (incluindo `notas`).

### Response 404

```json
{ "error": "Participante não encontrado" }
```

---

## DELETE /api/participants/:id

Sem alterações nesta feature. Comportamento existente preservado.

---

## Comportamento do filtro `?ativo=1`

Quando `ativo=1` é passado:
- `WHERE ativo = TRUE` é adicionado à query
- Usado exclusivamente pelo `loadParticipants()` do formulário de reunião
- Participantes inativos vinculados a reuniões existentes **não são afetados** — o vínculo histórico é gerenciado via `reuniao_participante`, não via este endpoint
