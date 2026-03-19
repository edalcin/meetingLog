# API Contracts: Pautas

**Date**: 2026-03-19 | **Plan**: [plan.md](../plan.md)

As pautas são integradas ao ciclo de save/load de reuniões. Não há endpoints autônomos de CRUD para pautas.

---

## GET /api/meetings/:id

Retorna os dados completos de uma reunião, incluindo suas pautas.

### Response 200

```json
{
  "id": 42,
  "data_hora": "2026-03-19T14:00:00.000Z",
  "tipo": "Presencial",
  "participante_ids": [1, 3],
  "participantes_nomes": "Alice, Bob",
  "projeto_ids": [2],
  "projeto_nomes": "Projeto X",
  "pautas": [
    { "id": 10, "texto": "Alinhamento do relatório", "ordem": 0 },
    { "id": 11, "texto": "Próximos passos", "ordem": 1 }
  ],
  "criado_em": "2026-03-19T14:00:00.000Z",
  "atualizado_em": "2026-03-19T14:00:00.000Z"
}
```

**Campo `pautas`**: array ordenado por `ordem ASC`. Vazio `[]` se a reunião não tiver pautas.

---

## POST /api/meetings

Cria uma nova reunião com pautas (opcional).

### Request Body

```json
{
  "data_hora": "2026-03-20T10:00:00",
  "tipo": "Remota",
  "participante_ids": [1, 2],
  "projeto_ids": [3],
  "pautas": [
    "Apresentar resultados",
    "Definir próximas ações"
  ]
}
```

**Campo `pautas`**: array de strings (textos das pautas). Opcional — omitir ou `[]` cria reunião sem pautas. Textos vazios após trim são ignorados. Ordem do array define o campo `ordem` de cada pauta.

### Response 201

```json
{
  "id": 43,
  "data_hora": "2026-03-20T10:00:00.000Z",
  "tipo": "Remota",
  "pautas": [
    { "id": 12, "texto": "Apresentar resultados", "ordem": 0 },
    { "id": 13, "texto": "Definir próximas ações", "ordem": 1 }
  ]
}
```

### Response 422 (validação)

```json
{
  "fields": {
    "data_hora": "Obrigatório",
    "tipo": "Obrigatório"
  }
}
```

---

## PUT /api/meetings/:id

Atualiza uma reunião existente. O campo `pautas` substitui **todas** as pautas existentes atomicamente (DELETE + INSERT em transação).

### Request Body

```json
{
  "data_hora": "2026-03-20T10:00:00",
  "tipo": "Presencial",
  "participante_ids": [1],
  "projeto_ids": [],
  "pautas": [
    "Pauta atualizada",
    "Nova pauta adicionada"
  ]
}
```

- Enviar `pautas: []` remove todas as pautas da reunião.
- Textos vazios após trim são ignorados.
- A ordem do array define o campo `ordem`.

### Response 200

```json
{
  "id": 43,
  "data_hora": "2026-03-20T10:00:00.000Z",
  "tipo": "Presencial",
  "pautas": [
    { "id": 14, "texto": "Pauta atualizada", "ordem": 0 },
    { "id": 15, "texto": "Nova pauta adicionada", "ordem": 1 }
  ]
}
```

---

## Regras de Validação das Pautas

| Regra | Comportamento |
|-------|---------------|
| Texto vazio (após trim) | Ignorado silenciosamente — não inserido |
| Texto > 1000 caracteres | Erro 422 com mensagem no campo `pautas` |
| `pautas` ausente no body | Tratado como `[]` (sem pautas) |
| `pautas` não é array | Erro 422 |

---

## Nota sobre GET /api/meetings (listagem)

O endpoint de listagem (`GET /api/meetings`) **não** inclui pautas no response. As pautas são carregadas somente ao abrir o formulário de edição (`GET /api/meetings/:id`).
