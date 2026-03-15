# Data Model: Tabela de Participantes

**Branch**: `002-add-participantes` | **Date**: 2026-03-15

## Entidades

### participante (nova tabela)

| Campo       | Tipo          | Restrições                        | Descrição                        |
|-------------|---------------|-----------------------------------|----------------------------------|
| id          | INT UNSIGNED  | PK, AUTO_INCREMENT                | Identificador único              |
| nome        | VARCHAR(255)  | NOT NULL, UNIQUE                  | Nome completo (chave de unicidade)|
| instituicao | VARCHAR(255)  | NULL                              | Instituição de origem            |
| cargo       | VARCHAR(255)  | NULL                              | Cargo ou função                  |
| email       | VARCHAR(255)  | NULL                              | E-mail de contato                |
| criado_em   | DATETIME      | NOT NULL, DEFAULT NOW()           | Data de criação do registro      |

**Unicidade**: `nome` é a chave de unicidade para fins de idempotência da migração.

**Índice adicional**: índice em `nome` para buscas por filtro.

---

### reuniao_participante (nova tabela de junção)

| Campo           | Tipo         | Restrições                                          |
|-----------------|--------------|-----------------------------------------------------|
| reuniao_id      | INT UNSIGNED | PK (composta), FK → reuniao(id) ON DELETE CASCADE   |
| participante_id | INT UNSIGNED | PK (composta), FK → participante(id) ON DELETE CASCADE |

**Chave primária composta** `(reuniao_id, participante_id)` previne associações duplicadas.

**CASCADE DELETE**: ao deletar uma reunião, suas associações são removidas automaticamente.

---

### reuniao (tabela existente — alterações)

| Campo          | Mudança                                           |
|----------------|---------------------------------------------------|
| participantes  | **REMOVIDO** (coluna TEXT — migration 004)        |
| (demais campos)| Sem alteração                                     |

---

## Migrations SQL

### 003_add_participantes.sql *(commitada)*
```sql
-- Cria tabela participante e tabela de junção reuniao_participante
-- NÃO remove a coluna participantes TEXT (necessária para migração de dados legados)
```

### 004_drop_participantes_col.sql *(commitada — executar APÓS script de dados)*
```sql
-- Remove coluna participantes TEXT da tabela reuniao
```

---

## Script de Dados *(nunca commitado — /docs/source/scripts/)*

### migrate-participantes.js
Executa em sequência:
1. **Import CSV** → tabela `participante` (INSERT IGNORE por nome)
2. **Migração legada** → lê `reuniao.participantes` TEXT, busca cada trecho por correspondência exata de nome em `participante`, insere em `reuniao_participante` (INSERT IGNORE)
3. Log de nomes não associados (sem falha)

---

## Relacionamentos

```
reuniao (1) ──── reuniao_participante (N)
participante (1) ─┘

Uma reunião tem muitos participantes.
Um participante aparece em muitas reuniões.
```

---

## Regras de Validação

- `participante.nome`: obrigatório, máximo 255 caracteres, único
- `reuniao_participante`: ao criar/editar reunião, ao menos 1 `participante_id` obrigatório
- IDs de participantes fornecidos na API devem existir na tabela `participante` (FK garante integridade)

---

## Fluxo de Dados — Criação de Reunião

```
Frontend → POST /api/meetings
  body: { data_hora, tipo, participante_ids: [1, 5, 42], projeto }

Backend:
  1. Valida campos e participante_ids (>= 1 elemento, IDs existem)
  2. INSERT INTO reuniao (...)
  3. INSERT INTO reuniao_participante (reuniao_id, participante_id) VALUES (...)
  4. SELECT reuniao + participantes para resposta
```

## Fluxo de Dados — Listagem de Reuniões

```
GET /api/meetings → SELECT reuniao.*, GROUP_CONCAT(participante.nome) AS participantes_nomes
                    FROM reuniao
                    LEFT JOIN reuniao_participante rp ON rp.reuniao_id = reuniao.id
                    LEFT JOIN participante p ON p.id = rp.participante_id
                    GROUP BY reuniao.id
```
