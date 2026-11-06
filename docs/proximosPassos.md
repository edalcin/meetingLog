# Próximos passos

Última atualização: 2026-11-06

## Estado atual

- Produção: UNRAID puxa `ghcr.io/edalcin/meetinglog:latest`. Todo push no `main` publica `latest` + `sha-*` (`build-and-publish.yml`). Não há etapa de promoção (o antigo `promote-to-prod.yml` dependia da tag `:edge`, que não existia mais, e foi removido).
- **Chat** implementado e publicado (PRD #7 fechado, [ADR-002](adr/002-chat-acervo-no-contexto.md)), commit `e639eb9`: aba Chat, `POST /api/chat` com SSE, acervo inteiro no contexto do Gemini (gerado a cada pergunta, ~16 ms), modelo escolhido em Manutenção → Configurações.
- **Chat em produção** desde 2026-11-06, com chave real (tier pago), confirmado pelo usuário.

## Acompanhar no Chat

- Latência até o primeiro token (~100k tokens de entrada).
- Acerto do cache implícito (custo no painel do AI Studio).
- Precisão em contagens.

## Pendências e ideias

- Se as contagens do Chat errarem na prática: adicionar uma tool de contagem exata (híbrido, ADR-002 §1).
- Se o cache implícito não acertar: usar cache explícito (`cachedContents`).
- A interface não tem tema escuro (regra global pede alternância claro/escuro). Nenhuma aba usa `dark:` hoje.
- Conteúdo de Anexos (PDF/imagem) fica fora do Chat; só o nome do arquivo entra.
- Warnings a11y pré-existentes no build do Svelte (`label` sem controle em MaintenanceTab/ReplaceEntitySection).
