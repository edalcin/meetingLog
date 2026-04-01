# Quickstart: 011-enhance-participantes

## Pré-requisitos

- Node.js 22+, variáveis de ambiente configuradas (`.env`)
- Acesso ao banco MariaDB `reunioes`

## Deploy

### 1. Aplicar migration

```bash
npm run migrate
```

Esta feature tem **uma única migration** (`015_add_participante_enhancements.sql`) que apenas adiciona colunas à tabela existente. Sem dados legados a migrar. Sem migration de remoção de coluna.

> **Seguro rodar `npm run migrate` diretamente** — não há sequência especial a respeitar (diferente das features que adicionam tabelas associadas à `reuniao`).

### 2. Deploy da aplicação

```bash
git push origin main
# GitHub Actions faz build e publica no GHCR
# UNRAID: pull da nova imagem + restart do container
```

## Verificação pós-deploy

1. Abrir a aba **Participantes** — confirmar que o filtro "Todos / Ativos / Inativos" aparece
2. Criar um participante com Lotação e Notas — confirmar que os campos são salvos
3. Inativar um participante — confirmar que ele some do autocomplete ao registrar uma reunião
4. Confirmar que o participante inativo ainda aparece em reuniões históricas já registradas

## Rollback

Caso necessário, reverter manualmente:

```sql
ALTER TABLE participante
  DROP COLUMN lotacao,
  DROP COLUMN ativo,
  DROP COLUMN notas,
  DROP INDEX idx_ativo;
```

> Atenção: dados de Notas e status serão perdidos no rollback.
