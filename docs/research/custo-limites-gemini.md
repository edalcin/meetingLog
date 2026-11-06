# Custo e limites do Gemini

Data da pesquisa: 2026-11-06. Todas as cifras vêm da documentação oficial (ai.google.dev). Preços em USD por 1M tokens.

## Fontes

- Preços: https://ai.google.dev/gemini-api/docs/pricing
- Modelos: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash e https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
- Caching: https://ai.google.dev/gemini-api/docs/caching
- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Termos (uso de dados): https://ai.google.dev/gemini-api/terms

## Modelos e preços (tier pago, Standard)

| Modelo | Input | Output (inclui thinking) | Cache (leitura) | Free tier |
|---|---|---|---|---|
| `gemini-3.5-flash-lite` | 0,30 | 2,50 | 0,03 | Sim |
| `gemini-3.8-flash` | 0,75 até 31/12/2026; 1,50 a partir de 01/01/2027 | 3,75 até 31/12/2026; 7,50 a partir de 01/01/2027 | 0,075 (0,15 em 2027) | Sim |
| `gemini-3.1-pro-preview` | 2,00 (prompts ≤ 200k) | 12,00 | 0,20 | Não |
| `gemini-4-argon` (flagship) | 2,00 até 30/11/2026; 4,00 a partir de 01/12/2026 | 10,00 até 30/11/2026; 20,00 a partir de 01/12/2026 | 0,10 (0,20 em dez/2026) | Não |

Notas:
- Também existe `gemini-3.6-flash` (mesmo preço do 3.8 Flash). A página de preços não mostra um "Gemini 3.x Pro" estável: o Pro atual é o `gemini-3.1-pro-preview`.
- O preço do 3.8 Flash e do Argon **dobra** em 2027 / dez 2026 (promoção com data de fim). Planeje com o preço cheio.
- Output inclui thinking tokens. O custo real pode ser maior que "1k de resposta". `minimal` thinking não existe no 3.8 Flash (só low/medium/high).
- Batch API: 50% de desconto (Flex e Batch têm o mesmo preço).

## Limite de contexto

- `gemini-3.8-flash`: input 1.048.576 tokens; output 65.536.
- `gemini-4-argon`: janela unificada (input + output) de 1.048.576; output 65.536 (até 1.048.576 com long decode).
- O acervo inteiro (~60k tokens) cabe com folga em qualquer modelo.

## Context caching

- **Implícito**: ligado por padrão em todos os modelos 2.5 e novos. Sem configuração. O desconto aparece só se houver cache hit. Mínimo: **4.096 tokens** (3.8 Flash, 3.6 Flash, 3.1 Pro, Argon). Dica oficial: coloque o conteúdo grande e comum no início do prompt; envie pedidos com prefixo igual em pouco tempo. O campo `usage.total_cached_tokens` mostra os hits. O preço de leitura do cache está na tabela acima (10% do preço de input no Flash 3.8).
- **Explícito**: existe nos modelos Gemini 3 e 2.5 via `generateContent` (não na Interactions API, e **não** no Argon). Tem preço de armazenamento: 3.8 Flash $0,50 / 1M tokens / hora (até 31/12/2026; $1,00 depois); 3.5 Flash-Lite $1,00; 3.1 Pro $4,50.
- **TTL do explícito**: a página de caching que consegui ler não traz o TTL. Não confirmei o valor. [INFERENCE] O padrão histórico é 1 hora, mas verifique antes de usar.
- Exemplo: guardar 60k tokens no 3.8 Flash = 0,06 × $0,50 = $0,03/hora, ou ~$0,72/dia. Para um app pequeno, o cache implícito é mais barato e mais simples.

## Rate limits

- Os números exatos por modelo (RPM/TPM/RPD) **não estão na documentação**. Eles aparecem só no painel https://aistudio.google.com/rate-limit para o seu projeto. Limites são por projeto, não por chave. RPD zera à meia-noite do horário do Pacífico.
- Tiers: Free (projeto ativo); Tier 1 (billing ligado; teto de gasto $250); Tier 2 (pagou $100 + 3 dias; teto $2.000); Tier 3 (pagou $1.000 + 30 dias).
- Limite de gasto por 10 minutos: Tier 1 $10; Tier 2 e 3 $200. Free: N/A.
- Limites são mais baixos em modelos preview e experimentais (o `gemini-3.1-pro-preview` é preview).
- Batch API: 100 jobs concorrentes.

## Free tier: política de dados

- Free tier = "Unpaid Services". O Google **usa prompts, respostas, arquivos e cached content** para melhorar produtos e treinar modelos de ML. **Revisores humanos podem ler** entradas e saídas (dados desconectados da conta/chave/projeto). O termo diz: "Do not submit sensitive, confidential, or personal information".
- Tier pago (projeto com billing ativo): o Google **não** usa os dados para melhorar produtos. Guarda logs por tempo limitado só para detectar abuso e cumprir lei.
- No EEE, Suíça e Reino Unido, as regras de "Paid" valem também para o free. Além disso, apps com usuários nesses locais só podem usar serviços pagos.
- Consequência: Reuniões têm nomes, participantes e notas. **Não use o free tier com dados reais.** Use o tier pago (Tier 1 basta).

## Estimativa de custo por pergunta

Premissas: saída = 1k tokens (sem thinking extra); (a) 5k tokens de input somados nas 2 chamadas; preços de lista de hoje. Arredondado.

| Arquitetura | Input | Flash-Lite 3.5 | Flash 3.8 (hoje) | Flash 3.8 (2027) | 3.1 Pro | Argon (hoje) |
|---|---|---|---|---|---|---|
| (a) text-to-SQL, 2 chamadas | 5k | $0,0040 | $0,0075 | $0,015 | $0,022 | $0,020 |
| (b) acervo inteiro | 60k | $0,0205 | $0,049 | $0,098 | $0,132 | $0,130 |
| (b) com cache implícito (hit total) | 60k | $0,0043 | $0,0083 | $0,016 | $0,024 | $0,016 |
| (c) RAG com ~8 Reuniões | 10k | $0,0055 | $0,011 | $0,023 | $0,032 | $0,030 |

Em 1.000 perguntas/mês com Flash 3.8 (preço de hoje): (a) ~$7,50; (b) ~$49 (sem cache) ou ~$8 (com cache); (c) ~$11. Com o preço de 2027, dobre.

Leitura:
- Todas as opções custam centavos por pergunta. Custo não decide a arquitetura.
- (b) é a mais cara sem cache, mas cai ~6× com cache implícito, se o acervo ficar idêntico e no início do prompt. Qualquer Reunião nova invalida o prefixo.
- (a) e (c) são baratas e escalam bem se o acervo crescer além de 1M tokens; (b) não.
- Flash-Lite 3.5 é o mais barato; Pro e Argon custam ~3× o Flash 3.8 sem ganho necessário para perguntas simples.
