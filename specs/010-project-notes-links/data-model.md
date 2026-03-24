# Data Model: Notas e Links em Projetos

**Feature**: 010-project-notes-links
**Date**: 2026-03-24

---

## Entidades Modificadas

### projeto (modificação)

Adição de coluna `notas` à tabela existente.

| Campo      | Tipo         | Null | Default | Descrição                                  |
|------------|--------------|------|---------|---------------------------------------------|
| id         | INT UNSIGNED | NO   | AI      | Chave primária (existente)                  |
| nome       | VARCHAR(255) | NO   | —       | Nome do projeto (existente)                 |
| ativo      | TINYINT(1)   | NO   | 1       | Flag ativo (existente)                      |
| **notas**  | **TEXT**     | **YES** | **NULL** | **Delta JSON do Quill editor — novo**  |
| criado_em  | DATETIME     | NO   | NOW()   | (existente)                                 |
| atualizado_em | DATETIME  | NO   | NOW()   | (existente)                                 |

**Migration**: `013_add_projeto_notas.sql`
```sql
ALTER TABLE projeto
  ADD COLUMN notas TEXT NULL AFTER ativo;
```

---

## Entidades Novas

### projeto_link (nova tabela)

Relação 1:N com `projeto`. Um projeto pode ter zero ou mais links. Cada link pertence a um único projeto.

| Campo      | Tipo              | Null | Default | Descrição                              |
|------------|-------------------|------|---------|----------------------------------------|
| id         | INT UNSIGNED      | NO   | AI      | Chave primária                         |
| projeto_id | INT UNSIGNED      | NO   | —       | FK → projeto.id (CASCADE DELETE/UPDATE)|
| nome       | VARCHAR(500)      | YES  | NULL    | Nome/rótulo do link (opcional)         |
| url        | VARCHAR(2048)     | NO   | —       | URL do link (obrigatório)              |
| ordem      | SMALLINT UNSIGNED | NO   | 0       | Ordem de exibição                      |
| criado_em  | DATETIME          | NO   | NOW()   | Timestamp de criação                   |

**Índices**:
- `PRIMARY KEY (id)`
- `UNIQUE KEY uq_projeto_link (projeto_id, url(500))` — um projeto não pode ter a mesma URL duplicada
- `KEY idx_projeto_link_ordem (projeto_id, ordem)`

**Constraint**: `FOREIGN KEY (projeto_id) REFERENCES projeto(id) ON DELETE CASCADE ON UPDATE CASCADE`

**Diferença do modelo `link` (reuniões)**: `nome` é `NULL`-able aqui porque projetos suportam links com apenas URL (a URL é usada como texto de exibição quando `nome` está ausente).

**Migration**: `014_add_projeto_link.sql`
```sql
CREATE TABLE IF NOT EXISTS `projeto_link` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `projeto_id` INT UNSIGNED  NOT NULL,
  `nome`       VARCHAR(500)  NULL,
  `url`        VARCHAR(2048) NOT NULL,
  `ordem`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `criado_em`  DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_projeto_link` (`projeto_id`, `url`(500)),
  KEY `idx_projeto_link_projeto_ordem` (`projeto_id`, `ordem`),
  CONSTRAINT `fk_projeto_link_projeto`
    FOREIGN KEY (`projeto_id`) REFERENCES `projeto`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Diagrama de Relacionamentos (simplificado)

```
projeto (1) ──── (N) projeto_link
  id ──────────────── projeto_id
  nome
  ativo
  notas (TEXT NULL)
```
