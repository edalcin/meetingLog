# Research: Adicionar Tabela de Pauta

**Date**: 2026-03-19 | **Plan**: [plan.md](./plan.md)

---

## Decisão 1: Tipo de relação pauta ↔ reunião

**Decision**: 1:N — coluna `reuniao_id` com FK na tabela `pauta`
**Rationale**: Cada pauta pertence a exatamente uma reunião; não há reutilização de pautas entre reuniões (diferente de participantes/projetos). FK direta é mais simples que junction table.
**Alternatives considered**: N:N via junction table — rejeitada, pois não há caso de uso de reuso de pauta entre reuniões.

---

## Decisão 2: Estratégia de save/load de pautas na API

**Decision**: Pautas integradas ao ciclo de save/load de reuniões (replace-all atômico)
- `GET /api/meetings/:id` → retorna `pautas: [{id, texto, ordem}]`
- `POST /api/meetings` e `PUT /api/meetings/:id` → aceitam `pautas: string[]` e fazem DELETE + INSERT das pautas atomicamente via transação

**Rationale**: Simplicidade (constituição I.1). Evita endpoint autônomo `/api/pautas` com CRUD separado. O estado final do card é sempre o correto — substituição total (DELETE + INSERT) dentro de uma transação é idempotente e simples de implementar e testar.
**Alternatives considered**:
- CRUD autônomo (`POST /api/pautas`, `DELETE /api/pautas/:id`) — rejeitado: mais complexidade sem ganho real para sistema single-user.
- PATCH incremental (só envia diffs) — rejeitado: requer state management mais complexo no frontend.

---

## Decisão 3: Estratégia de idempotência do script de migração CSV

**Decision**: UNIQUE KEY `uq_pauta (reuniao_id, texto(500))` na tabela + `INSERT IGNORE` no script
**Rationale**: Segue constituição II.3. O script pode ser reexecutado sem duplicatas. O prefixo 500 caracteres é suficiente para distinguir pautas na prática (nenhuma pauta do CSV tem mais de ~200 caracteres).
**Alternatives considered**:
- Check-before-insert (SELECT + INSERT se não existe) — rejeitado: mais verbose, mesma segurança.
- ON DUPLICATE KEY UPDATE — rejeitado: desnecessário (não queremos atualizar, apenas ignorar).

---

## Decisão 4: Matching CSV → banco (reuniao_id lookup)

**Decision**: Match por `data_hora` exato usando `DATE_FORMAT(data_hora,'%Y-%m-%dT%H:%i:%s')` no MariaDB
**Rationale**: Segue constituição II.4 e III.2. O CSV tem timestamps com offset `-03:00`; o banco armazena em UTC ou local. O script faz conversão de timezone antes do match (normalize para UTC subtraindo 3h, ou usar `CONVERT_TZ`).
**Alternatives considered**:
- Match por data_hora + projeto — rejeitado: pautas CSV não têm coluna de projeto, apenas `data_hora`.
- Match por índice posicional — rejeitado: não há correspondência posicional confiável.

---

## Decisão 5: Exibição de pautas na listagem de reuniões

**Decision**: Pautas NÃO aparecem na tabela de listagem — apenas no formulário de edição
**Rationale**: Clarificação Q1 do /speckit.clarify. Mantém a tabela compacta e consistente com o design atual.
**Alternatives considered**: Coluna resumida na tabela — rejeitada pelo usuário.

---

## Decisão 6: Mecanismo de confirmação de nova pauta no formulário

**Decision**: Botão explícito "+" ou "Adicionar" ao lado do campo de texto
**Rationale**: Clarificação Q2 do /speckit.clarify. Evita envio acidental com Enter e é consistente com o padrão visual existente.
**Alternatives considered**: Tecla Enter, ou ambos — rejeitados pelo usuário em favor do botão explícito.

---

## Decisão 7: Número da próxima migration

**Decision**: `008_add_pauta.sql`
**Rationale**: Última migration existente é `007_add_instituicoes.sql`. Não há coluna legada em `reuniao` a remover (pauta é entidade inteiramente nova), portanto apenas uma migration é necessária.
**Alternatives considered**: Duas migrations (criação + remoção) — rejeitada: não há coluna TEXT legada a remover.

---

## Decisão 8: Ordem das pautas

**Decision**: Campo `ordem SMALLINT UNSIGNED DEFAULT 0` — preenchido pela posição no array enviado pelo frontend (0-based index)
**Rationale**: Preserva ordem de inserção de forma determinística. O frontend envia array ordenado; o backend atribui `ordem = index`.
**Alternatives considered**: Sem campo de ordem (ORDER BY id) — rejeitado: após DELETE+INSERT, novos IDs não preservam ordem original. Auto-increment de exibição baseado em posição no array é mais robusto.
