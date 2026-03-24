# Quickstart: Notas e Links em Projetos

**Feature**: 010-project-notes-links
**Date**: 2026-03-24

---

## Sequência de Deploy

### 1. Aplicar migrations

Rodar as duas migrations em sequência:

```bash
npm run migrate
```

Isso aplica:
- `013_add_projeto_notas.sql` — adiciona coluna `notas` à tabela `projeto`
- `014_add_projeto_link.sql` — cria tabela `projeto_link`

**Nota**: Não há coluna legada a remover. Não há script de dados. Uma única execução de `npm run migrate` é suficiente.

---

## Cenários de Teste Manual

### US1 — Notas

1. Abrir a aba **Projetos** → clicar em editar em qualquer projeto → verificar que o editor Quill aparece na seção "Notas" do formulário
2. Digitar texto formatado (negrito, lista) → clicar **Salvar** → fechar o modal
3. Reabrir o mesmo projeto → verificar que as notas são carregadas com a formatação correta
4. Salvar com o editor vazio → reabrir → verificar que o editor aparece limpo (sem erro)

### US2 — Links

1. Abrir o formulário de edição de um projeto → localizar a seção "Links"
2. Preencher apenas o campo URL (sem nome) → clicar **Adicionar** → verificar que o link aparece na lista com a URL como texto
3. Adicionar um segundo link com nome e URL → **Salvar** → fechar o modal
4. Reabrir o projeto → verificar que ambos os links estão presentes e são clicáveis (abrem em nova aba)
5. Remover um dos links → **Salvar** → reabrir → verificar que apenas o link restante persiste
6. Verificar que o botão **Adicionar** está desabilitado quando o campo URL está vazio

---

## Rollback

Se necessário reverter:
```sql
-- Remover tabela projeto_link
DROP TABLE IF EXISTS projeto_link;

-- Remover coluna notas de projeto
ALTER TABLE projeto DROP COLUMN notas;

-- (Remover registros de schema_migrations se necessário)
DELETE FROM schema_migrations WHERE version IN ('013', '014');
```
