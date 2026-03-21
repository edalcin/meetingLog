# Data Model: Adicionar Tabela de Links

**Date**: 2026-03-21 | **Plan**: [plan.md](./plan.md)

---

## Nova Tabela: `link`

```sql
CREATE TABLE IF NOT EXISTS `link` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `reuniao_id` INT UNSIGNED  NOT NULL,
  `nome`       VARCHAR(500)  NOT NULL,
  `url`        VARCHAR(2048) NOT NULL,
  `ordem`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `criado_em`  DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_link` (`reuniao_id`, `url`(500)),
  KEY `idx_link_reuniao_ordem` (`reuniao_id`, `ordem`),
  CONSTRAINT `fk_link_reuniao`
    FOREIGN KEY (`reuniao_id`) REFERENCES `reuniao`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Campos

| Campo | Tipo | Nulo | Padrão | Descrição |
|-------|------|------|--------|-----------|
| `id` | INT UNSIGNED | NÃO | AUTO_INCREMENT | Identificador único |
| `reuniao_id` | INT UNSIGNED | NÃO | — | FK → `reuniao.id` |
| `nome` | VARCHAR(500) | NÃO | — | Nome descritivo do link (não vazio) |
| `url` | VARCHAR(2048) | NÃO | — | URL do recurso externo (não vazio) |
| `ordem` | SMALLINT UNSIGNED | NÃO | 0 | Posição de exibição (0-based) |
| `criado_em` | DATETIME | NÃO | NOW() | Timestamp de criação |

### Constraints

- `PRIMARY KEY (id)` — identificador autoincrementado
- `UNIQUE KEY uq_link (reuniao_id, url(500))` — garante idempotência do script de migração; a mesma URL não pode aparecer duas vezes na mesma reunião (chave de unicidade clarificada em `/speckit.clarify`)
- `FOREIGN KEY fk_link_reuniao` → `reuniao.id` ON DELETE CASCADE — ao excluir uma reunião, seus links são excluídos automaticamente
- `nome` e `url` não podem ser vazios (validação na camada de aplicação + NOT NULL no banco)

---

## Tabela Existente: `reuniao` (sem alterações)

A tabela `reuniao` não recebe nenhuma nova coluna. A relação é inteiramente representada pela FK em `link.reuniao_id`.

```
reuniao (existente, imutável nesta feature)
├── id            INT UNSIGNED PK
├── data_hora     DATETIME
├── tipo          ENUM(...)
├── notas         TEXT NULL
├── criado_em     DATETIME
└── atualizado_em DATETIME
```

---

## Diagrama de Relações

```
reuniao (1) ────────────────────── (N) link
  id ◄──────────────── reuniao_id

reuniao ──── reuniao_participante ──── participante  (N:N existente)
reuniao ──── reuniao_projeto ──────── projeto        (N:N existente)
reuniao ──── pauta                                   (1:N existente)
reuniao ──── link                                    (1:N — NOVA)
```

---

## Índices e Performance

- `idx_link_reuniao_ordem (reuniao_id, ordem)` — query principal: `SELECT * FROM link WHERE reuniao_id = ? ORDER BY ordem ASC`
- `uq_link (reuniao_id, url(500))` — também serve como índice de lookup para idempotência (INSERT IGNORE)

---

## Validação de Dados

| Regra | Onde aplicar |
|-------|-------------|
| `nome` não vazio (após trim) | Frontend (botão Adicionar desabilitado) + Backend (antes do INSERT) |
| `url` não vazio (após trim) | Frontend (botão Adicionar desabilitado) + Backend (antes do INSERT) |
| `reuniao_id` deve existir | FK constraint no banco |
| Mesmo URL por reunião | UNIQUE KEY — segunda inserção ignorada via INSERT IGNORE |
| Máximo de `nome`: 500 chars | VARCHAR(500) no banco |
| Máximo de `url`: 2048 chars | VARCHAR(2048) no banco |

---

## Migration File

**Arquivo**: `migrations/010_add_link.sql`
**Conteúdo**: CREATE TABLE link (acima)
**Número sequencial**: 010 (após 009_add_notas.sql)
**Sem migration de remoção**: `link` é entidade nova; não há coluna legada em `reuniao` a remover.
