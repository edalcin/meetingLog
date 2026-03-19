# Data Model: Adicionar Tabela de Pauta

**Date**: 2026-03-19 | **Plan**: [plan.md](./plan.md)

---

## Nova Tabela: `pauta`

```sql
CREATE TABLE IF NOT EXISTS `pauta` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `reuniao_id` INT UNSIGNED  NOT NULL,
  `texto`      VARCHAR(1000) NOT NULL,
  `ordem`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `criado_em`  DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pauta` (`reuniao_id`, `texto`(500)),
  KEY `idx_pauta_reuniao_ordem` (`reuniao_id`, `ordem`),
  CONSTRAINT `fk_pauta_reuniao`
    FOREIGN KEY (`reuniao_id`) REFERENCES `reuniao`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Campos

| Campo | Tipo | Nulo | Padrão | Descrição |
|-------|------|------|--------|-----------|
| `id` | INT UNSIGNED | NÃO | AUTO_INCREMENT | Identificador único |
| `reuniao_id` | INT UNSIGNED | NÃO | — | FK → `reuniao.id` |
| `texto` | VARCHAR(1000) | NÃO | — | Texto da pauta (não vazio) |
| `ordem` | SMALLINT UNSIGNED | NÃO | 0 | Posição de exibição (0-based) |
| `criado_em` | DATETIME | NÃO | NOW() | Timestamp de criação |

### Constraints

- `PRIMARY KEY (id)` — identificador autoincrementado
- `UNIQUE KEY uq_pauta (reuniao_id, texto(500))` — garante idempotência do script de migração; impede duplicatas exatas por reunião
- `FOREIGN KEY fk_pauta_reuniao` → `reuniao.id` ON DELETE CASCADE — ao excluir uma reunião, suas pautas são excluídas automaticamente
- `texto` não pode ser vazio (validação na camada de aplicação + NOT NULL no banco)

---

## Tabela Existente: `reuniao` (sem alterações)

A tabela `reuniao` não recebe nenhuma nova coluna. A relação é inteiramente representada pela FK em `pauta.reuniao_id`.

```
reuniao (existente, imutável nesta feature)
├── id          INT UNSIGNED PK
├── data_hora   DATETIME
├── tipo        ENUM(...)
├── criado_em   DATETIME
└── atualizado_em DATETIME
```

---

## Diagrama de Relações

```
reuniao (1) ────────────── (N) pauta
  id ◄──────── reuniao_id

reuniao ──── reuniao_participante ──── participante  (N:N existente)
reuniao ──── reuniao_projeto ──────── projeto        (N:N existente)
```

---

## Índices e Performance

- `idx_pauta_reuniao_ordem (reuniao_id, ordem)` — query principal: `SELECT * FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC`
- `uq_pauta (reuniao_id, texto(500))` — também serve como índice de lookup para idempotência (INSERT IGNORE)

---

## Validação de Dados

| Regra | Onde aplicar |
|-------|-------------|
| `texto` não vazio (trim) | Frontend (before add) + Backend (before INSERT) |
| `reuniao_id` deve existir | FK constraint no banco |
| Máximo de texto: 1000 chars | VARCHAR(1000) no banco |
| Pautas com texto idêntico na mesma reunião | UNIQUE KEY — segunda inserção ignorada via INSERT IGNORE |

---

## Migration File

**Arquivo**: `migrations/008_add_pauta.sql`
**Conteúdo**: CREATE TABLE pauta (acima)
**Número sequencial**: 008 (após 007_add_instituicoes.sql)
**Sem migration de remoção**: `pauta` é entidade nova; não há coluna legada em `reuniao` a remover.
