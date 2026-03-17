# Quickstart: Add Projetos e Menu de Navegação

**Branch**: `003-add-projetos` | **Date**: 2026-03-17

> ⚠️ **LEITURA OBRIGATÓRIA ANTES DE EXECUTAR QUALQUER MIGRATION**
>
> Esta feature tem **duas migrations separadas** (005 e 006) com um **script de dados obrigatório entre elas**.
> Executar `npm run migrate` uma única vez cobrirá ambas e **destruirá a coluna legada antes do script de dados rodar**.
> Siga a sequência abaixo rigorosamente.

---

## Pré-requisitos

- MariaDB disponível em `DB_HOST:3333`, database `reunioes`
- Node.js 22 instalado localmente
- Arquivo `docs/source/memoriaReunioes-Projeto.csv` presente
- Arquivo `docs/source/memoriaReunioes-Reuniao.csv` presente (para matching legado)
- Código da feature implementado e testado localmente

---

## Sequência de Execução (OBRIGATÓRIA)

### Passo 1 — Aplicar migration 005 (cria tabelas)

```bash
# Aplica APENAS a migration 005 (cria projeto + reuniao_projeto)
# A 006 ainda não existe neste ponto OU deve ser renomeada temporariamente
npm run migrate
```

> Verificar que apenas `005_add_projetos.sql` foi aplicada. A tabela `reuniao.projeto` deve **ainda existir**.

```sql
-- Validação no banco:
DESCRIBE reuniao;           -- deve mostrar coluna 'projeto'
SHOW TABLES LIKE 'projeto%'; -- deve mostrar 'projeto' e 'reuniao_projeto'
```

---

### Passo 2 — Executar script de dados

```bash
# Na pasta docs/source/scripts/ (local, nunca commitado)
node migrate-projetos.js
```

> O script irá:
> 1. Importar 49 projetos do CSV → tabela `projeto`
> 2. Parsear `reuniao.projeto` TEXT → criar associações em `reuniao_projeto`
> 3. Exibir log de projetos não encontrados (esperado: zero ou poucos)

```sql
-- Validação no banco:
SELECT COUNT(*) FROM projeto;           -- deve ser 49
SELECT COUNT(*) FROM reuniao_projeto;   -- deve ser > 0
```

---

### Passo 3 — Validar a aplicação

```bash
npm run dev
```

> Verificar na interface:
> - Lista de projetos exibe todos os 49 registros
> - Ao criar/editar reunião, projetos aparecem no multi-select
> - Reuniões existentes mostram projetos associados corretamente

---

### Passo 4 — Aplicar migration 006 (remove coluna legada)

Apenas após validação completa:

```bash
npm run migrate
```

> Agora aplica `006_drop_projeto_col.sql`. A coluna `reuniao.projeto` e o índice `idx_projeto` são removidos.

```sql
-- Validação no banco:
DESCRIBE reuniao;  -- coluna 'projeto' NÃO deve aparecer
```

---

### Passo 5 — Commit e push

```bash
git add migrations/ src/ public/ specs/003-add-projetos/
git commit -m "feat: add projetos table, N:N relation with reuniao, navigation menu"
git push origin main
```

---

## Variáveis de Ambiente (aplicação)

```env
DB_HOST=DB_HOST
DB_PORT=3333
DB_NAME=reunioes
DB_USER=app_user
DB_PASSWORD=<app_password>
APP_PIN=<pin>
APP_PORT=3000
```

---

## Credenciais do Script de Migração

As credenciais root estão hardcoded em `docs/source/scripts/migrate-projetos.js`.
Este arquivo está no `.gitignore` e nunca deve ser commitado.

---

## Rollback (se necessário)

Antes da migration 006:
```sql
-- Desfaz associações e tabelas (não desfaz a 005 migration tracker)
DROP TABLE IF EXISTS reuniao_projeto;
DROP TABLE IF EXISTS projeto;
```

Após a migration 006 **não há rollback automático** — a coluna legada foi removida.
Restaurar a partir de backup do banco.
