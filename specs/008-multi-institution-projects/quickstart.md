# Quickstart: Projetos Multi-Institucionais

**Feature**: 008-multi-institution-projects
**Date**: 2026-03-23

---

## Sequência de deploy (IMPORTANTE — não alterar a ordem)

### ⚠️ NÃO executar `npm run migrate` uma única vez cobrindo as etapas abaixo.

A migration `012_drop_projeto_instituicao_col.sql` remove a coluna `projeto.instituicao`.
O script de dados lê essa coluna. Se rodar migrate antes do script, os dados serão perdidos.

### Passo 1 — Executar o script de migração de dados

```bash
# Certifique-se de que as variáveis de ambiente estão configuradas
node docs/source/scripts/migrate_projeto_instituicao.js
```

Verifique no log se há registros `[UNMATCHED]` — projetos cujo valor de `instituicao` não corresponde a nenhuma sigla cadastrada. Esses projetos ficarão sem instituição vinculada. Se necessário, ajuste manualmente via interface antes de prosseguir.

### Passo 2 — Deploy do novo código

```bash
git push origin main
# GitHub Actions faz build e publica no GHCR
# UNRAID: pull da nova imagem + restart do container
```

### Passo 3 — Aplicar a migration de remoção da coluna

```bash
# No container ou via docker exec:
npm run migrate
# Aplica apenas 012_drop_projeto_instituicao_col.sql (as demais já foram aplicadas)
```

---

## Desenvolvimento local

```bash
npm install
npm run dev
# Acesse http://localhost:3000
```

### Testar a migration localmente

```bash
# 1. Rodar o script de dados primeiro
node docs/source/scripts/migrate_projeto_instituicao.js

# 2. Depois aplicar a migration
npm run migrate
```

---

## Verificação pós-deploy

1. Abra a aba **Projetos**
2. Edite um projeto que tinha instituição preenchida → deve exibir a instituição como tag
3. Adicione uma segunda instituição ao projeto e salve → ambas devem aparecer na lista
4. Digite uma sigla inexistente no campo de instituição e pressione ENTER → nova instituição deve ser criada e vinculada
5. Verifique que a coluna de instituição na lista exibe as siglas separadas por vírgula
6. Verifique que a busca de projetos por nome de instituição retorna os projetos corretos

---

## Rollback

Se necessário reverter:
1. Parar o container
2. Fazer pull da imagem anterior
3. A coluna `projeto.instituicao` já não existirá (migration 012 já foi aplicada)
4. Restaurar backup do banco de dados se necessário
