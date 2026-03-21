# Research: Adicionar Tabela de Links

**Date**: 2026-03-21 | **Plan**: [plan.md](./plan.md)

Nenhum NEEDS CLARIFICATION identificado no Technical Context — a feature é estruturalmente idêntica a `pauta` (feature 004), com os diferenciais de: dois campos de dados (nome + url), exibição como âncora clicável e painel de detalhes (somente-leitura).

---

## Decisão 1: Parsing do formato `[nome] url` no CSV

**Decision**: Regex `/^\[(.+?)\]\s+(.+)$/` aplicada linha a linha ao campo `linkDoc`.

**Rationale**: O formato é simples e consistente (colchetes + espaço + url). O grupo 1 captura o nome (conteúdo entre `[` e `]`), o grupo 2 captura o URL (tudo após o `] `). Variações como aspas externas no CSV (ex: `"[Nome] url"`) são tratadas pelo parser CSV padrão que remove as aspas antes de aplicar a regex.

**Alternatives considered**:
- Split por `] ` (primeiro ocorrência): menos robusto para nomes com colchetes internos.
- Parser dedicado: desnecessário para esse formato simples.

---

## Decisão 2: Chave de unicidade para idempotência

**Decision**: `UNIQUE KEY (reuniao_id, url(500))` — URL como chave natural por reunião.

**Rationale**: Clarificado em `/speckit.clarify` (Q2). A mesma URL não pode aparecer duas vezes na mesma reunião. O nome é apenas um rótulo descritivo e pode variar entre re-migrações. Prefixo `url(500)` para compatibilidade com índices MariaDB em campos longos.

**Alternatives considered**:
- `(reuniao_id, nome, url)`: mais restritivo, permitiria o mesmo URL com nomes diferentes — indesejável.
- `(reuniao_id, nome)`: nome pode repetir, não garante unicidade real do recurso.

---

## Decisão 3: Tamanho do campo URL

**Decision**: `TEXT` para `url` (sem limite prático) — ou `VARCHAR(2048)` se precisar de índice direto.

**Rationale**: URLs do dataset incluem URLs longas do OneDrive e Google Docs (ex: `https://docs.google.com/presentation/d/...`). Limite conservador de 2048 chars cobre todos os casos observados e permite UNIQUE KEY sem prefixo excessivo.

**Alternatives considered**:
- `VARCHAR(500)`: muito curto para URLs de compartilhamento do Google/OneDrive.
- `TEXT`: não permite UNIQUE KEY sem prefixo — requer `url(500)` no índice.

**Final choice**: `VARCHAR(2048)` com `UNIQUE KEY (reuniao_id, url(500))` — índice usa prefixo de 500 chars, suficiente para distinguir URLs na prática.

---

## Decisão 4: Integração no ciclo de meetings (sem rota autônoma)

**Decision**: Links integrados em POST/PUT /api/meetings via transação atômica (DELETE all + INSERT new), idêntico ao padrão de pautas.

**Rationale**: Constitution I.1 — simplicidade. Pautas estabeleceram o padrão canônico. Uma transação garante consistência sem race conditions. Atende FR-009 (API expõe create/update/delete) via o ciclo de save.

**Alternatives considered**:
- Endpoints `/api/meetings/:id/links` com CRUD individual: mais RESTful, mas mais complexidade desnecessária para single-user tool.

---

## Decisão 5: Exibição no painel de detalhes (read-only)

**Decision**: Links exibidos no painel de detalhes (`openMeetingInfo`) como lista de `<a href="url" target="_blank">nome</a>`, carregados junto com os outros dados do `GET /api/meetings/:id`.

**Rationale**: Clarificado em `/speckit.clarify` (Q1). O endpoint `GET /api/meetings/:id` já é chamado ao abrir o painel de detalhes. Links vêm no mesmo payload — sem fetch adicional. Exibição simples, sem editor.

---

## Análise do CSV fonte

**Arquivo**: `docs/source/memoriaReunioes-DocsRelacionados.csv`
**Linhas**: ~324 (1 header + ~323 dados)
**Separador**: `;`
**Formato da data**: `DD/MM/YYYY HH:MM` (BRT, UTC-3)
**Formato do link**: `[nome] url`

**Observações do dataset**:
- Algumas linhas têm aspas externas: `"[Nome] url\n"` — parser CSV padrão trata corretamente.
- Reuniões com múltiplos links na mesma data: ex. `27/06/2022 14:00` tem 5 links — cada linha é um registro separado.
- Algumas URLs são muito longas (Google Docs, OneDrive com tokens de compartilhamento).
- Nenhum link com nome ou URL vazio observado no dataset, mas validação deve ser implementada.

**Conversão de data BRT→UTC**: `DD/MM/YYYY HH:MM` → `new Date(Date.UTC(y, mo-1, d, h+3, m, 0))` — mesma lógica usada em migrate_notas_from_csv.js.
