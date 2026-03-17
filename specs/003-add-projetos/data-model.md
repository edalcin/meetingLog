# Data Model: Tabela de Projetos

**Branch**: `003-add-projetos` | **Date**: 2026-03-17

---

## Entidades

### projeto (nova tabela)

| Campo         | Tipo          | Restrições                         | Descrição                                    |
|---------------|---------------|------------------------------------|----------------------------------------------|
| id            | INT UNSIGNED  | PK, AUTO_INCREMENT                 | Identificador único                          |
| nome          | VARCHAR(255)  | NOT NULL, UNIQUE                   | Nome do projeto (chave de unicidade)         |
| ativo         | BOOLEAN       | NOT NULL, DEFAULT TRUE             | Status ativo (TRUE) ou inativo (FALSE)       |
| instituicao   | VARCHAR(255)  | NULL                               | Instituição parceira associada (opcional)    |
| criado_em     | DATETIME      | NOT NULL, DEFAULT NOW()            | Data de criação do registro                  |

**Unicidade**: `nome` é a chave de unicidade para fins de idempotência da migração.

**Índice adicional**: índice em `nome` para buscas por filtro; índice em `ativo` para filtro de ativos.

---

### reuniao_projeto (nova tabela de junção)

| Campo       | Tipo         | Restrições                                              |
|-------------|--------------|----------------------------------------------------------|
| reuniao_id  | INT UNSIGNED | PK (composta), FK → reuniao(id) ON DELETE CASCADE        |
| projeto_id  | INT UNSIGNED | PK (composta), FK → projeto(id) ON DELETE CASCADE        |

**Chave primária composta** `(reuniao_id, projeto_id)` previne associações duplicadas.

**CASCADE DELETE**: ao deletar uma reunião, suas associações de projetos são removidas automaticamente.

---

### reuniao (tabela existente — alterações)

| Campo     | Mudança                                                  |
|-----------|----------------------------------------------------------|
| projeto   | **REMOVIDO** (coluna VARCHAR(255) — migration 006)       |
| idx_projeto | **REMOVIDO** (índice sobre coluna projeto — migration 006) |
| (demais campos) | Sem alteração                                      |

---

## Migrations SQL

### 005_add_projetos.sql *(commitada)*
```sql
-- Cria tabela projeto e tabela de junção reuniao_projeto
-- NÃO remove a coluna projeto VARCHAR (necessária para migração de dados legados)
CREATE TABLE `projeto` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `nome`       VARCHAR(255)  NOT NULL,
  `ativo`      BOOLEAN       NOT NULL DEFAULT TRUE,
  `instituicao` VARCHAR(255) NULL,
  `criado_em`  DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nome` (`nome`),
  KEY `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `reuniao_projeto` (
  `reuniao_id` INT UNSIGNED NOT NULL,
  `projeto_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`reuniao_id`, `projeto_id`),
  FOREIGN KEY (`reuniao_id`) REFERENCES `reuniao`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`projeto_id`) REFERENCES `projeto`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 006_drop_projeto_col.sql *(commitada — executar APÓS script de dados)*
```sql
-- Remove coluna projeto VARCHAR da tabela reuniao
-- ⚠️ EXECUTAR APENAS APÓS migrate-projetos.js ter rodado com sucesso
ALTER TABLE `reuniao`
  DROP INDEX `idx_projeto`,
  DROP COLUMN `projeto`;
```

---

## Script de Dados *(nunca commitado — docs/source/scripts/)*

### migrate-projetos.js
Executa em sequência:
1. **Import CSV** → tabela `projeto` (INSERT IGNORE por nome, converte VERDADEIRO/FALSO para 1/0)
2. **Migração legada** → lê `reuniao.projeto` TEXT, split por vírgula + trim, lookup por nome exato em `projeto`, insere em `reuniao_projeto` (INSERT IGNORE)
3. Log de nomes não associados (sem falha — padrão constituição II.4)

**Credenciais**: root / `***REMOVED***` — hardcoded no script (nunca commitado)

---

## Relacionamentos

```
reuniao (1) ──── reuniao_projeto (N)
projeto  (1) ─┘

Uma reunião tem muitos projetos.
Um projeto aparece em muitas reuniões.
```

---

## Regras de Validação

- `projeto.nome`: obrigatório, máximo 255 caracteres, único
- `reuniao_projeto`: projetos são opcionais — uma reunião pode ter zero projetos
- IDs de projetos fornecidos na API devem existir na tabela `projeto` (FK garante integridade)
- No campo de seleção do formulário: apenas projetos `ativo = TRUE` são oferecidos como novas opções
- Projetos `ativo = FALSE` já associados à reunião devem ser preservados e exibidos como pré-selecionados

---

## Fluxo de Dados — Criação/Edição de Reunião

```
Frontend → POST /api/meetings
  body: { data_hora, tipo, participante_ids: [1, 5], projeto_ids: [3, 12] }

Backend:
  1. Valida campos, participante_ids (>= 1), projeto_ids (>= 0, IDs existem)
  2. BEGIN TRANSACTION
  3. INSERT INTO reuniao (data_hora, tipo)
  4. DELETE FROM reuniao_participante WHERE reuniao_id = ?  (edição)
  5. INSERT INTO reuniao_participante (reuniao_id, participante_id) VALUES (...)
  6. DELETE FROM reuniao_projeto WHERE reuniao_id = ?  (edição)
  7. INSERT INTO reuniao_projeto (reuniao_id, projeto_id) VALUES (...)
  8. COMMIT
  9. SELECT reuniao + participantes + projetos para resposta
```

## Fluxo de Dados — Listagem de Reuniões

```
GET /api/meetings →
  SELECT r.*,
         GROUP_CONCAT(DISTINCT p.nome  ORDER BY p.nome  SEPARATOR ', ') AS participantes_nomes,
         GROUP_CONCAT(DISTINCT p.id    ORDER BY p.nome)                  AS participante_ids_str,
         GROUP_CONCAT(DISTINCT pr.nome ORDER BY pr.nome SEPARATOR ', ') AS projeto_nomes,
         GROUP_CONCAT(DISTINCT pr.id   ORDER BY pr.nome)                 AS projeto_ids_str
  FROM reuniao r
  LEFT JOIN reuniao_participante rp ON rp.reuniao_id = r.id
  LEFT JOIN participante p          ON p.id = rp.participante_id
  LEFT JOIN reuniao_projeto rpj     ON rpj.reuniao_id = r.id
  LEFT JOIN projeto pr              ON pr.id = rpj.projeto_id
  GROUP BY r.id
```
