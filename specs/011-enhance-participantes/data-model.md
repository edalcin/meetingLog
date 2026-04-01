# Data Model: 011-enhance-participantes

## Entidade: `participante` (tabela existente — ALTER)

### Colunas atuais

| Coluna       | Tipo           | Constraints              |
|--------------|----------------|--------------------------|
| `id`         | INT UNSIGNED   | PK, AUTO_INCREMENT       |
| `nome`       | VARCHAR(255)   | NOT NULL, UNIQUE         |
| `instituicao`| VARCHAR(255)   | NULL                     |
| `cargo`      | VARCHAR(255)   | NULL                     |
| `email`      | VARCHAR(255)   | NULL                     |
| `criado_em`  | DATETIME       | NOT NULL, DEFAULT NOW()  |

### Colunas novas (esta feature)

| Coluna    | Tipo         | Constraints                  | Posição           |
|-----------|--------------|------------------------------|-------------------|
| `lotacao` | VARCHAR(255) | NULL                         | AFTER `instituicao` |
| `ativo`   | BOOLEAN      | NOT NULL, DEFAULT TRUE       | AFTER `email`     |
| `notas`   | TEXT         | NULL                         | AFTER `ativo`     |

### Índices novos

| Nome       | Coluna  | Tipo  | Motivo                                      |
|------------|---------|-------|---------------------------------------------|
| `idx_ativo`| `ativo` | KEY   | Filtragem frequente no autocomplete (WHERE ativo = TRUE) |

### Ordem dos campos na ficha (exibição/formulário)

1. Nome
2. Instituição
3. **Lotação** ← novo, entre Instituição e Cargo
4. Cargo
5. Email
6. **Status (Ativo/Inativo)** ← novo, campo de toggle
7. **Notas** ← novo, ao final (editor rico)

---

## Migration

**Arquivo**: `migrations/015_add_participante_enhancements.sql`

```sql
ALTER TABLE participante
  ADD COLUMN `lotacao` VARCHAR(255) NULL AFTER `instituicao`,
  ADD COLUMN `ativo`   BOOLEAN      NOT NULL DEFAULT TRUE AFTER `email`,
  ADD COLUMN `notas`   TEXT         NULL AFTER `ativo`,
  ADD KEY `idx_ativo` (`ativo`);
```

**Nota**: migration pura de adição de colunas — sem dados legados para migrar, sem coluna a remover. Pode ser aplicada com `npm run migrate` diretamente.

---

## Impacto em outras tabelas

- `reuniao_participante`: nenhum impacto. Os vínculos históricos são preservados independentemente do campo `ativo`.
- `reuniao`: nenhum impacto. A filtragem de ativos ocorre apenas no endpoint de autocomplete, não nas queries de reuniões existentes.

---

## Estado de transição: `ativo`

```
NOVO participante → ativo = TRUE (default)
    │
    ▼
[inativar na tela de manutenção]
    │
    ▼
ativo = FALSE
  → não aparece no autocomplete de reuniões
  → ainda aparece em reuniões já registradas (vínculos históricos)
  → ainda aparece na lista de manutenção (com badge/filtro "Inativos")
    │
    ▼
[reativar na tela de manutenção]
    │
    ▼
ativo = TRUE → volta ao autocomplete imediatamente
```
