# Próximos passos

Última atualização: 2026-11-06

## Estado atual

- Produção: UNRAID puxa `ghcr.io/edalcin/meetinglog:latest`. Todo push no `main` publica `latest` + `sha-*` (`build-and-publish.yml`). Não há etapa de promoção (o antigo `promote-to-prod.yml` dependia da tag `:edge`, que não existia mais, e foi removido).
- **Chat** implementado (PRD #7, [ADR-002](adr/002-chat-acervo-no-contexto.md)): aba Chat, `POST /api/chat` com SSE, acervo inteiro no contexto do Gemini, modelo escolhido em Manutenção → Configurações.

## Para ativar o Chat em produção

1. Criar a chave Gemini no **tier pago** (o free tier usa os dados para treino).
2. No UNRAID, adicionar a variável `GEMINI_API_KEY` ao container (ver [unraid-install.md](unraid-install.md)) e atualizar a imagem.
3. Fazer algumas perguntas reais e conferir: latência até o primeiro token (~100k tokens de entrada; não medida), acerto do cache implícito (custo no painel do AI Studio) e precisão em contagens.

## Pendências e ideias

- Se as contagens do Chat errarem na prática: adicionar uma tool de contagem exata (híbrido, ADR-002 §1).
- Se o cache implícito não acertar: usar cache explícito (`cachedContents`).
- A interface não tem tema escuro (regra global pede alternância claro/escuro). Nenhuma aba usa `dark:` hoje.
- Conteúdo de Anexos (PDF/imagem) fica fora do Chat; só o nome do arquivo entra.
