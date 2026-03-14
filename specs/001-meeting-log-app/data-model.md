# Data Model: Meeting Log Application

**Phase**: 1 — Design
**Date**: 2026-03-14
**Spec**: [spec.md](spec.md)

---

## Entities

### `reuniao` (Meeting)

The sole business entity. Represents a single meeting event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Surrogate key |
| `data_hora` | `DATETIME` | `NOT NULL` | Date and time of the meeting |
| `tipo` | `ENUM('Presencial','Remota')` | `NOT NULL` | Meeting format |
| `participantes` | `TEXT` | `NOT NULL` | Comma-separated participant names |
| `projeto` | `VARCHAR(255)` | `NOT NULL` | Project name(s); free text |
| `criado_em` | `DATETIME` | `NOT NULL DEFAULT NOW()` | Record creation timestamp |
| `atualizado_em` | `DATETIME` | `NOT NULL DEFAULT NOW() ON UPDATE NOW()` | Last update timestamp |

**Notes**:
- No unique constraint on `(data_hora, projeto)` — duplicate meetings are allowed (see spec edge cases).
- `participantes` is free text; no normalisation into a participants table (v1 scope).
- `projeto` is free text; no normalisation into a projects table (v1 scope).

---

### `schema_migrations` (Migration Tracking)

Internal table used by the entrypoint migration runner to track which SQL migration files have been applied. Enables idempotent startup migrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Surrogate key |
| `filename` | `VARCHAR(255)` | `NOT NULL UNIQUE` | Migration file name (e.g., `001_init.sql`) |
| `applied_at` | `DATETIME` | `NOT NULL DEFAULT NOW()` | Timestamp when migration was run |

---

## SQL Schema (DDL)

```sql
-- Migration: 001_init.sql
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename`   VARCHAR(255) NOT NULL,
  `applied_at` DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `reuniao` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `data_hora`     DATETIME     NOT NULL,
  `tipo`          ENUM('Presencial','Remota') NOT NULL,
  `participantes` TEXT         NOT NULL,
  `projeto`       VARCHAR(255) NOT NULL,
  `criado_em`     DATETIME     NOT NULL DEFAULT NOW(),
  `atualizado_em` DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  KEY `idx_data_hora` (`data_hora`),
  KEY `idx_projeto`   (`projeto`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## CSV → Database Field Mapping

Source file: `docs/source/memoriaReunioes-Reuniao.csv` (delimiter: `;`)

| CSV Column | DB Column | Transformation |
|------------|-----------|----------------|
| `data` | `data_hora` | Parse `DD/MM/YYYY HH:mm` → `YYYY-MM-DD HH:mm:00` |
| `tipo` | `tipo` | Direct map; values are already `Presencial` or `Remota` |
| `participantes` | `participantes` | Direct copy (free text) |
| `projeto` | `projeto` | Direct copy (free text) |

---

## Query Patterns

| Use Case | Query Strategy |
|----------|---------------|
| List all meetings (default) | `SELECT * FROM reuniao ORDER BY data_hora DESC` |
| Filter by text | `WHERE projeto LIKE '%term%' OR participantes LIKE '%term%'` |
| Sort by column | `ORDER BY {column} {ASC\|DESC}` — column name validated against allowlist |
| Create meeting | `INSERT INTO reuniao (data_hora, tipo, participantes, projeto)` |
| Update meeting | `UPDATE reuniao SET ... WHERE id = ?` |
| Count for pagination | `SELECT COUNT(*) FROM reuniao WHERE ...` |

---

## Validation Rules

| Field | Rule |
|-------|------|
| `data_hora` | Required; must be a valid datetime |
| `tipo` | Required; must be exactly `Presencial` or `Remota` |
| `participantes` | Required; non-empty string |
| `projeto` | Required; non-empty string, max 255 characters |
