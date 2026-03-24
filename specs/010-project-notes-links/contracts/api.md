# API Contracts: Notas e Links em Projetos

**Feature**: 010-project-notes-links
**Date**: 2026-03-24

---

## Endpoints Novos

### GET /api/projects/:id/detail

Retorna os dados completos de um projeto, incluindo `notas` e array `links`. Chamado ao abrir o formulário de edição.

**Response 200**:
```json
{
  "id": 1,
  "nome": "GO FAIR",
  "ativo": true,
  "notas": "{\"ops\":[{\"insert\":\"Texto das notas\\n\"}]}",
  "instituicao_ids": [2, 5],
  "instituicao_nomes": "IBICT, LNCC",
  "links": [
    { "id": 10, "nome": "Repositório", "url": "https://github.com/gofair", "ordem": 0 },
    { "id": 11, "nome": null, "url": "https://gofair.science", "ordem": 1 }
  ]
}
```

**Campos**:
- `notas`: string JSON (delta Quill) ou `null`
- `links`: array ordenado por `ordem ASC`; `nome` pode ser `null`

**Response 404**: `{ "error": "Projeto não encontrado" }`

---

## Endpoints Modificados

### POST /api/projects

Passa a aceitar `notas` e `links` no body.

**Request body** (adições):
```json
{
  "nome": "Novo Projeto",
  "ativo": true,
  "instituicao_ids": [1],
  "notas": "{\"ops\":[{\"insert\":\"\\n\"}]}",
  "links": [
    { "nome": "Site", "url": "https://exemplo.com" },
    { "nome": null, "url": "https://outro.com" }
  ]
}
```

**Regras**:
- `notas`: opcional; `null` limpa as notas
- `links`: opcional; array de `{ nome?, url }` — `url` obrigatório, `nome` opcional (null/vazio aceito)
- Links com `url` vazia são ignorados silenciosamente
- Duplicatas de URL por projeto são ignoradas via `INSERT IGNORE`

**Response 201**: Objeto projeto completo (mesmo formato do GET /detail acima)

---

### PUT /api/projects/:id

Passa a aceitar `notas` e `links` no body (mesmo contrato do POST acima).

**Comportamento de links**:
1. `DELETE FROM projeto_link WHERE projeto_id = ?` — remove todos os links existentes
2. `INSERT` de cada link válido do array recebido

**Response 200**: Objeto projeto completo

---

## Sem Mudanças

- `GET /api/projects` — continua retornando lista sem notas/links (não necessário no contexto de listagem)
- `DELETE /api/projects/:id` — sem mudanças (CASCADE na FK garante que `projeto_link` é limpa automaticamente)
