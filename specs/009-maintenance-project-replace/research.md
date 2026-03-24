# Research: Substituição de Projetos em Reuniões

**Feature**: `009-maintenance-project-replace`
**Date**: 2026-03-24

---

## Decisão 1: Estratégia da operação atômica de substituição

**Decision**: Usar dois statements SQL dentro de uma única transação:
1. `DELETE` das associações do projeto de origem em reuniões que **já possuem** o projeto de destino (para evitar duplicatas)
2. `UPDATE` das associações restantes do projeto de origem para o destino

**Rationale**: A abordagem DELETE+UPDATE é mais simples e eficiente do que uma abordagem INSERT+DELETE. Usa o padrão de `pool.getConnection() + beginTransaction/commit/rollback` já estabelecido em `projects.js` e `meetings.js`.

**SQL exato**:
```sql
-- Passo 1: remover duplicatas (reuniões que já têm o destino)
DELETE rp FROM reuniao_projeto rp
  INNER JOIN reuniao_projeto rp2
    ON rp2.reuniao_id = rp.reuniao_id AND rp2.projeto_id = ?  -- to_id
WHERE rp.projeto_id = ?  -- from_id

-- Passo 2: remapiear as restantes
UPDATE reuniao_projeto SET projeto_id = ? WHERE projeto_id = ?  -- to_id, from_id
```

**Alternatives considered**:
- INSERT … SELECT + DELETE: mais verboso e risco de violar UNIQUE KEY antes do DELETE
- Aplicar UPDATE primeiro: pode criar duplicatas temporárias se `(reuniao_id, projeto_id)` tiver UNIQUE KEY

---

## Decisão 2: Estrutura do dry run

**Decision**: O dry run executa a mesma consulta SELECT que identificaria as reuniões afetadas, retornando lista com `id`, `data_hora` e `participantes_nomes` (GROUP_CONCAT de participantes).

**SQL**:
```sql
SELECT r.id,
       DATE_FORMAT(r.data_hora, '%d/%m/%Y, %H:%i') AS data_fmt,
       COALESCE(
         GROUP_CONCAT(DISTINCT p.nome ORDER BY p.nome SEPARATOR ', '),
         '—'
       ) AS participantes_nomes
FROM reuniao r
JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
LEFT JOIN reuniao_participante rpart ON rpart.reuniao_id = r.id
LEFT JOIN participante p ON p.id = rpart.participante_id
WHERE rp.projeto_id = ?
GROUP BY r.id
ORDER BY r.data_hora DESC
```

**Rationale**: Consistente com o padrão GROUP_CONCAT já usado em `meetings.js` (IV.3 da constitution). Formatar `data_hora` no banco evita serialização de Date no frontend.

---

## Decisão 3: Rota e namespace

**Decision**: `POST /api/maintenance/replace-project` em `src/routes/maintenance.js`

**Rationale**: Isola operações de manutenção num namespace dedicado, facilitando adicionar futuras operações sem poluir as rotas de recursos (projects, meetings, etc.). Segue o padrão `app.route('/api/[recurso]', router)` de `server.js`.

---

## Decisão 4: Criação inline de projeto no campo PARA

**Decision**: Implementar no método `maintCreateProject(nome)` do Alpine.js: POST `/api/projects` com `{ nome, ativo: true }`, e ao receber a resposta adicionar o projeto a `allProjects` e definir `maintReplaceTo` com o projeto recém-criado.

**Rationale**: Reutiliza o endpoint existente `POST /api/projects` sem criar nova lógica de backend. Igual ao que `saveProject()` já faz no formulário de projetos.

---

## Decisão 5: Sem nova migration SQL

**Decision**: Nenhuma migration necessária.

**Rationale**: A feature opera exclusivamente sobre `reuniao_projeto` (junction table existente desde a migration `005_add_projetos.sql`). Não há alteração de schema.
