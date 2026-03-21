# API Contracts: Links

**Date**: 2026-03-21 | **Plan**: [plan.md](../plan.md)

Os links são integrados ao ciclo de save/load de reuniões. Não há endpoints autônomos de CRUD para links — o padrão espelha o de pautas (feature 004).

---

## GET /api/meetings/:id

Retorna os dados completos de uma reunião, incluindo seus links.

### Response 200

```json
{
  "id": 42,
  "data_hora": "2026-03-21T14:00:00.000Z",
  "tipo": "Presencial",
  "participante_ids": [1, 3],
  "participantes_nomes": "Alice, Bob",
  "projeto_ids": [2],
  "projeto_nomes": "Projeto X",
  "pautas": [
    { "id": 10, "texto": "Alinhamento do relatório", "ordem": 0 }
  ],
  "links": [
    { "id": 1, "nome": "Panorama da STI", "url": "https://1drv.ms/w/s!...", "ordem": 0 },
    { "id": 2, "nome": "Memória", "url": "https://docs.google.com/...", "ordem": 1 }
  ],
  "notas": "{\"ops\":[...]}",
  "criado_em": "2026-03-21T14:00:00.000Z",
  "atualizado_em": "2026-03-21T14:00:00.000Z"
}
```

**Campo `links`**: array ordenado por `ordem ASC`. Vazio `[]` se a reunião não tiver links.

---

## POST /api/meetings

Cria uma nova reunião com links (opcional).

### Request Body

```json
{
  "data_hora": "2026-03-21T10:00:00",
  "tipo": "Remota",
  "participante_ids": [1, 2],
  "projeto_ids": [3],
  "pautas": ["Apresentar resultados"],
  "links": [
    { "nome": "Apresentação", "url": "https://docs.google.com/presentation/..." },
    { "nome": "Ata anterior", "url": "https://drive.google.com/..." }
  ]
}
```

**Campo `links`**: array de objetos `{nome, url}`. Opcional — omitir ou `[]` cria reunião sem links. Itens com `nome` ou `url` vazios (após trim) são ignorados. A ordem do array define o campo `ordem` de cada link.

### Response 201

```json
{
  "id": 43,
  "data_hora": "2026-03-21T10:00:00.000Z",
  "tipo": "Remota",
  "links": [
    { "id": 5, "nome": "Apresentação", "url": "https://docs.google.com/presentation/...", "ordem": 0 },
    { "id": 6, "nome": "Ata anterior", "url": "https://drive.google.com/...", "ordem": 1 }
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

Atualiza uma reunião existente. O campo `links` substitui **todos** os links existentes atomicamente (DELETE + INSERT em transação).

### Request Body

```json
{
  "data_hora": "2026-03-21T10:00:00",
  "tipo": "Presencial",
  "participante_ids": [1],
  "projeto_ids": [],
  "pautas": ["Pauta atualizada"],
  "links": [
    { "nome": "Novo documento", "url": "https://docs.google.com/..." }
  ]
}
```

- Enviar `links: []` remove todos os links da reunião.
- Itens com `nome` ou `url` vazios após trim são ignorados.
- A ordem do array define o campo `ordem`.

### Response 200

```json
{
  "id": 43,
  "data_hora": "2026-03-21T10:00:00.000Z",
  "tipo": "Presencial",
  "links": [
    { "id": 7, "nome": "Novo documento", "url": "https://docs.google.com/...", "ordem": 0 }
  ]
}
```

---

## Regras de Validação dos Links

| Regra | Comportamento |
|-------|---------------|
| `nome` vazio (após trim) | Item ignorado silenciosamente — não inserido |
| `url` vazia (após trim) | Item ignorado silenciosamente — não inserido |
| `nome` > 500 caracteres | Truncado a 500 chars ou erro 422 com mensagem no campo `links` |
| `url` > 2048 caracteres | Erro 422 com mensagem no campo `links` |
| `links` ausente no body | Tratado como `[]` (sem links) |
| `links` não é array | Erro 422 |
| Objeto sem `nome` ou sem `url` | Item ignorado silenciosamente |

---

## Nota sobre GET /api/meetings (listagem)

O endpoint de listagem (`GET /api/meetings`) **não** inclui links no response. Os links são carregados somente ao abrir o formulário de edição ou o painel de detalhes (`GET /api/meetings/:id`).
