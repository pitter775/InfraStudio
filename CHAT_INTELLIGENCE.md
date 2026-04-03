# Inteligencia do Chat

Este arquivo documenta a inteligencia atual do chat/orquestrador do projeto.

Objetivo:
- servir como memoria tecnica de continuidade
- explicar a logica atual de decisao
- registrar a direcao arquitetural que estamos construindo
- facilitar futuras evolucoes sem depender do contexto desta conversa

## Visao Geral

O chat deixou de ser apenas um fluxo simples de pergunta e resposta.
Hoje ele precisa lidar com:

- entrada livre do usuario
- contexto acumulado da conversa
- canal atual (`site`, `widget`, `whatsapp`)
- produtos e follow-up de catalogo
- APIs conectadas ao agente
- qualificacao comercial
- assets/anexos de resposta
- oferta ou escalada para humano

Por causa disso, a inteligencia esta sendo reorganizada em modulos, para evitar que tudo continue concentrado em um unico arquivo.

## Arquivos Principais

### Pipeline principal
- `C:\Projetos\infrastudio\lib\chat-service.ts`
  - recebe a mensagem
  - monta o contexto
  - chama o orquestrador
  - decide handoff humano
  - persiste mensagens, contexto e estatisticas

- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
  - ainda e o centro principal de resposta
  - decide como responder com base no contexto
  - integra heuristicas, OpenAI, Mercado Livre e APIs
  - esta em processo de modularizacao

### Modulos novos ja extraidos
- `C:\Projetos\infrastudio\lib\chat-context.ts`
  - tipos compartilhados de contexto
  - `ConversationContext`
  - `CatalogProductReference`

- `C:\Projetos\infrastudio\lib\chat-handoff-policy.ts`
  - politica de escalada humana
  - classifica `none`, `offer` e `required`
  - usa contexto adicional antes de escalar

- `C:\Projetos\infrastudio\lib\catalog-follow-up.ts`
  - roteador de follow-up de catalogo
  - decide entre:
    - referencia a item recente
    - referencia ambigua
    - nova busca
    - pedir mais opcoes
    - mensagem fora do fluxo de catalogo
  - agora tambem centraliza:
    - resposta heuristica de referencia ao catalogo
    - assets do catalogo recente
    - metadata e trace desse caminho

- `C:\Projetos\infrastudio\lib\chat-api-runtime.ts`
  - leitura e resposta com base em APIs conectadas
  - seleciona campos relevantes
  - gera contexto focado para o LLM
  - responde perguntas diretas ou analiticas sobre dados

- `C:\Projetos\infrastudio\lib\chat-intent-classifier.ts`
  - classificador central das prioridades heuristicas do pipeline
  - define a ordem atual entre:
    - confirmacao de nome do lead
    - referencia ao catalogo recente
    - heuristica Mercado Livre
    - precificacao de catalogo
    - identificacao de lead
  - agora tambem define a rota seguinte do orquestrador:
    - agente invalido/inativo
    - heuristica
    - guardrail sem OpenAI
    - OpenAI
  - agora tambem classifica o dominio amplo da conversa:
    - `catalog_commerce`
    - `api_runtime`
    - `lead_qualification`
    - `general_sales`
  - agora tambem considera sinais mais amplos para classificar dominio:
    - texto atual da mensagem
    - memoria resumida
    - contexto atual de catalogo
    - contexto atual de lead

- `C:\Projetos\infrastudio\lib\chat-domain-stage.ts`
  - transforma o dominio amplo da conversa em suporte operacional para a fase OpenAI
  - hoje define:
    - instrucao de dominio
    - janela recente de mensagens
    - limite de tokens por tipo de conversa
  - isso faz o classificador de dominio deixar de ser apenas observabilidade

- `C:\Projetos\infrastudio\lib\chat-pipeline-stage.ts`
  - consolida a resolucao conjunta das fases centrais do pipeline
  - hoje calcula em um ponto so:
    - `heuristicIntentStage`
    - `conversationDomainStage`
    - `orchestratorRouteStage`
    - `domainSupportState`
  - isso reduz a quantidade de classificacao espalhada no orquestrador

- `C:\Projetos\infrastudio\lib\chat-openai-stage.ts`
  - concentra a preparacao do payload da fase OpenAI
  - monta:
    - `instructions`
    - contexto de resumo
    - contexto de lead
    - contexto de qualificacao
    - janela recente de mensagens
    - `max_output_tokens`
  - isso tira do orquestrador uma parte sensivel de montagem do pedido ao modelo

- `C:\Projetos\infrastudio\lib\chat-openai-utils.ts`
  - utilitarios compartilhados da fase OpenAI
  - hoje centraliza a conversao do historico interno para o formato `input` da Responses API
  - isso evita duplicacao entre a resposta principal e o fluxo de resumo/memoria

- `C:\Projetos\infrastudio\lib\chat-summary-stage.ts`
  - concentra o fluxo de resumo/memoria da conversa
  - hoje define:
    - quando atualizar o resumo
    - fallback local sem OpenAI
    - chamada OpenAI para resumo estruturado em JSON compacto
  - isso tira do orquestrador outra responsabilidade transversal

- `C:\Projetos\infrastudio\lib\chat-context-stage.ts`
  - consolida a preparacao de contexto geral antes da fase heuristica/OpenAI
  - hoje resolve em um ponto so:
    - prompts base
    - instrucoes por canal
    - runtime prompt
    - focused API context
    - recovery reply
    - sinais de lead e precificacao
    - CTA da loja
  - isso reduz um bloco grande de montagem manual no orquestrador

- `C:\Projetos\infrastudio\lib\chat-prompt-builders.ts`
  - concentra builders de apresentacao e instrucao da resposta
  - hoje centraliza:
    - instrucao estruturada
    - instrucao por canal
    - instrucao analitica
    - prompt base do agente
    - runtime prompt
    - legacy agent prompt
    - tratamento de assets marcados
    - formatacao heuristica
  - isso tira do orquestrador uma familia grande de helpers de superficie

- `C:\Projetos\infrastudio\lib\chat-mercado-livre.ts`
  - concentracao das funcoes de resposta e apoio do dominio Mercado Livre
  - intencao comercial vs tecnica do produto
  - assets de produto
  - prompts de produto em foco
  - respostas de listagem, item unico e sem resultado
  - coordenacao de busca e enriquecimento dos produtos para o canal
  - agora tambem centraliza o estado heuristico do dominio:
    - produto em foco
    - resposta comercial de item selecionado
    - resposta ambigua de referencia ao catalogo
    - contexto de prompt do produto
    - metadata do produto atual para persistencia

- `C:\Projetos\infrastudio\lib\chat-lead-stage.ts`
  - concentra a parte madura de lead que saiu do orquestrador
  - hoje centraliza:
    - deteccao de resposta com nome
    - extracao de nome e telefone
    - confirmacao curta de nome
    - enriquecimento do contexto de lead

- `C:\Projetos\infrastudio\lib\chat-usage-metrics.ts`
  - concentra a classificacao pratica de uso de tokens e custo
  - hoje gera:
    - `billingOrigin`
    - `usageTelemetry`
  - a classificacao nasce com:
    - canal
    - provider
    - rota do pipeline
    - dominio da conversa
  - isso permite observar consumo por projeto com mais leitura de contexto

- `C:\Projetos\infrastudio\lib\ia-usage-types.ts`
  - centraliza os tipos compartilhados da leitura de uso
  - evita duplicacao entre:
    - modulo servidor de consolidacao
    - dashboard admin
    - pagina de IA tokens

- `C:\Projetos\infrastudio\lib\chat-sales-heuristics.ts`
  - concentra heuristicas comerciais e de busca que ainda pesavam no orquestrador
  - hoje centraliza:
    - continuidade de busca de produto
    - candidatos de busca
    - deteccao de listagem Mercado Livre
    - fallback do conector Mercado Livre
    - leitura de catalogo comercial
    - precificacao inicial de catalogo
    - momento de pedir identificacao do lead

- `C:\Projetos\infrastudio\lib\chat-text-utils.ts`
  - concentra utilitarios compartilhados de texto e canal
  - hoje centraliza:
    - `normalizeText`
    - `isWhatsAppChannel`
    - `singularizeToken`
    - `buildSearchTokens`
    - `levenshteinDistance`
  - isso reduz ruido e divergencia entre modulos

- `C:\Projetos\infrastudio\lib\chat-recovery-stage.ts`
  - concentra fallback/recovery e identificacao textual que ainda estavam no orquestrador
  - hoje centraliza:
    - heuristica global de resposta inicial
    - recovery contextual do agente
    - fallback focado em Mercado Livre
    - leitura de contexto first-party da InfraStudio
    - extracao de nome e telefone

## Ordem Mental do Pipeline Atual

De forma simplificada, o fluxo hoje funciona assim:

1. receber mensagem do usuario
2. carregar historico e contexto do chat
3. enriquecer contexto do lead
4. detectar se existe contexto forte de catalogo recente
5. decidir follow-up de catalogo antes de sair buscando coisa nova
6. avaliar dados de APIs quando a mensagem for sobre consulta/dados
7. montar prompts e contexto para OpenAI quando necessario
   - agora com suporte guiado pelo dominio atual da conversa
8. gerar resposta
9. decidir se oferece humano, exige humano ou segue normal
10. persistir resposta, contexto e logs
11. registrar telemetria de uso por projeto, canal, provider, rota e dominio

## Ajustes Operacionais de WhatsApp

- o canal WhatsApp agora foi ajustado para responder com uma unica mensagem textual por vez
- o `chat-service` nao persiste mais `followUpReply` separado quando o canal e `whatsapp`
- a `messageSequence` do WhatsApp foi colapsada para uma unica mensagem principal, evitando multiplos historicos/saidas em sequencia
- o retorno do WhatsApp tambem nao expoe mais `assets` na resposta final do webhook, reduzindo o risco de pontes externas dispararem midias/mensagens extras
- tambem foi adicionada uma sanitizacao operacional para remover promessas como:
  - `vou ver`
  - `vou verificar`
  - `ja vejo`
  - `deixa eu ver`
  - `ver o status`
- isso reduz ruido operacional e evita o agente prometer ao cliente uma consulta/status que nao deve verbalizar desse jeito
- os fallbacks de recovery tambem deixaram de sugerir `status` como topico de conversa para o cliente
- depois do colapso da sequencia do WhatsApp para uma unica mensagem, a entrega de lista de produtos foi ajustada para incorporar os links dos itens no mesmo texto
- essa decisao foi refinada depois: para listas de produtos no WhatsApp, o comportamento correto e enviar:
  - uma mensagem introdutoria
  - seguida de uma mensagem por produto
- isso favorece o preview/card de link do proprio WhatsApp e deixa a vitrine mais utilizavel no canal
- a persistencia interna do chat continua enxuta, sem criar varios registros desnecessarios so por causa do delivery externo
- agora tambem existe log de diagnostico para WhatsApp quando:
  - os assets foram incorporados com sucesso na mensagem unica
  - os assets vieram, mas nao tinham dados suficientes para montar a lista entregavel
- o identificador canonico do contato no WhatsApp agora prioriza o telefone real do contato (`remotePhone` / `rawContact.number`) antes de aceitar ids temporarios como `@lid`
- isso protege a continuidade do contexto e reduz o risco de o mesmo cliente ser tratado como conversa nova varias vezes

## Evolucao da Fala Comercial em Produto em Foco

- o caminho de `produto em foco` no Mercado Livre foi refinado para reduzir respostas secas e repetitivas
- a resposta comercial agora varia melhor conforme o momento da conversa:
  - duvida sobre garantia
  - duvida sobre frete
  - duvida sobre atributos/material/medidas/cor
  - demonstracao de interesse no produto
- em vez de sempre repetir o mesmo fechamento generico, o fluxo passou a:
  - usar melhor o descritivo do anuncio
  - sondar com mais contexto
  - ajudar o cliente a comparar criterios de decisao
  - puxar um fechamento mais consultivo quando houver interesse
- isso melhora a sinergia comercial e reduz a sensacao de resposta robotica no atendimento focado em um item especifico

## Evolucao da Camada Semantica

- a `semantic_intent_stage` ganhou mais precedencia no caminho de catalogo e Mercado Livre
- quando existe contexto real de catalogo (`produtoAtual` ou `ultimosProdutos`) e a classificacao semantica vem com confianca forte, o fallback heuristico deixa de ser o motor principal
- isso reduz a chance de:
  - continuidade curta ser sequestrada por heuristica
  - respostas vagas cairem cedo demais em busca ou relistagem
  - dominio de catalogo ser mantido apenas por palavras gatilho
- o classificador de dominio tambem passou a considerar a intencao semantica de catalogo:
  - se a intencao semantica indicar continuidade comercial, o dominio fica em `catalog_commerce`
  - se a intencao semantica vier como `generic`, o dominio nao fica preso no catalogo so porque havia contexto anterior
- na pratica, isso empurra o sistema para:
  - menos dependecia de heuristicas
  - mais interpretacao por contexto
  - mais comportamento fluido no follow-up comercial

## Follow-up de Catalogo

Esse foi um dos pontos mais importantes corrigidos.

Antes:
- qualquer frase nova podia cair como nova busca literal
- exemplo: `gostei da sopeira que mandou` podia virar busca por `sopeira que mandou`

Agora:
- o sistema olha primeiro para o catalogo recente salvo no contexto
- tenta entender se a mensagem se refere aos itens mostrados
- so depois considera busca nova

Decisoes possiveis:
- `recent_product_reference`
- `recent_product_reference_ambiguous`
- `new_product_search`
- `load_more_results`
- `non_catalog_message`

O contexto de catalogo hoje guarda:
- `ultimaBusca`
- `produtoAtual`
- `ultimosProdutos`
- `snapshotId`
- `snapshotCreatedAt`
- `snapshotTurnId`
- `cardIndex` dos itens

Isso permite:
- entender `primeiro`, `segundo`, `o de 250`
- resolver referencias a item ja mostrado
- priorizar produto em foco
- evitar busca nova em mensagens curtas sem sinal forte

## Escalada Humana

Outro ponto importante foi parar de escalar cedo demais.

Antes:
- um `agent_scoped_recovery`
- ou um simples `handoffSuggested`
- ja podia acionar humano no WhatsApp

Agora:
- a politica de handoff foi separada
- a decisao nao e mais booleana

Estados:
- `none`
  - nao oferece nem escala
- `offer`
  - oferece humano como opcao
  - nao aciona atendimento automaticamente
- `required`
  - realmente abre handoff

Criterios atuais:
- pedido explicito do cliente por humano -> `required`
- dificuldade isolada -> normalmente `none`
- dificuldade intermediaria -> `offer`
- contexto sensivel, repeticao de falhas ou classificacao forte -> `required`

Antes de escalar automaticamente, o sistema agora pode mandar mais contexto para o GPT para classificar melhor a necessidade de handoff.

## Uso de LLM

O GPT nao deve ser chamado como atalho para tudo, nem deve ser cortado cedo demais quando ele realmente ajuda.

Direcao adotada:
- heuristica local para casos fortes e baratos
- GPT para classificacao quando existe ambiguidade relevante
- GPT com contexto adicional quando precisamos decidir melhor

Exemplos de uso atual:
- classificar follow-up ambiguo de catalogo
- classificar necessidade real de escalada humana
- responder com base no contexto da conversa e dos conectores

## Telemetria de Uso

Entrou uma camada leve de observabilidade de consumo no fluxo real.

Objetivo:
- mensurar melhor o uso de tokens por projeto
- separar consumo por tipo de conversa
- evitar criar um sistema pesado demais antes da hora

O fluxo real agora grava classificacao de uso em dois lugares:
- `metadata` da mensagem assistente
- linha de `consumos` via campo `origem`

Formato atual:
- `chat:<canal>:<provider>:<rota>:<dominio>`

Exemplos:
- `chat:whatsapp:openai:openai:catalog_commerce`
- `chat:web:heuristic:heuristic:catalog_commerce`
- `chat:whatsapp:agent_scoped_recovery:guardrail_no_openai:general_sales`

Com isso, a leitura de uso passa a permitir:
- custo por projeto
- custo por canal
- custo por provider
- custo por rota do pipeline
- custo por dominio da conversa

No `C:\Projetos\infrastudio\lib\ia-usage.ts`, a consolidacao agora tambem expande:
- `porOrigem` no overview
- `topOrigins` no summary
- `recentActivity` com:
  - `origem`
  - `origemLabel`
  - `provider`
  - `routeStage`
  - `domainStage`

Isso ainda nao e um dashboard completo de analytics, mas ja e uma base pratica para observar onde o consumo real esta acontecendo.

Refino estrutural seguinte:
- o `C:\Projetos\infrastudio\lib\dashboard.ts` deixou de manter uma consolidacao paralela de uso
- ele agora consome a mesma base do `C:\Projetos\infrastudio\lib\ia-usage.ts`
- isso reduz risco de divergencia entre:
  - dashboard geral
  - tela de tokens
  - leitura de consumo por projeto

Efeito visual/pratico:
- `C:\Projetos\infrastudio\app\admin\ia-tokens\page.tsx`
  - passou a exibir `topOrigins`
  - atividade recente agora mostra classificacao de origem/provider/rota/dominio
- `C:\Projetos\infrastudio\app\admin\dashboard\page.tsx`
  - passou a exibir bloco de origens com maior consumo
  - atividade recente agora mostra a origem classificada

Refino estrutural adicional:
- uma faixa grande de heuristicas comerciais saiu de `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
- o orquestrador continua coordenando, mas deixou de carregar sozinho regras como:
  - continuar ou nao uma busca de produto
  - detectar listagem de loja
  - decidir fallback de conector de catalogo
  - montar precificacao inicial do catalogo
  - decidir quando pedir nome do lead em fluxo comercial
- isso aproxima ainda mais o arquivo principal do papel de coordenador de fases

Refino seguinte de ruido:
- os utilitarios de texto/canal deixaram de ficar duplicados em varios pontos
- modulos principais como:
  - `chat-orchestrator.ts`
  - `chat-prompt-builders.ts`
  - `catalog-follow-up.ts`
  agora compartilham a mesma base em `chat-text-utils.ts`
- isso reduz risco de comportamento levemente diferente entre:
  - normalizacao de texto
  - leitura de canal WhatsApp
  - montagem de tokens de busca
  - comparacao textual aproximada

Refino adicional de espinha dorsal:
- recovery e fallback deixaram de ficar misturados no arquivo principal
- `chat-orchestrator.ts` agora delega essa familia para `chat-recovery-stage.ts`
- isso reduz mais uma parte transversal do nucleo:
  - fallback comercial
  - fallback first-party
  - extracao de nome/telefone
  - resposta de recovery com foco em API ou Mercado Livre

## Problema Arquitetural Identificado

O crescimento do projeto fez o `chat-orchestrator.ts` ganhar responsabilidades demais.

Ele passou a acumular:
- classificacao de intencao
- follow-up de catalogo
- consultas de API
- estrategia comercial
- fallback
- formatação por canal
- logica de assets
- integracao com OpenAI

Isso torna o sistema:
- menos previsivel
- mais dificil de testar
- mais dificil de evoluir
- mais suscetivel a regressao

## Direcao de Arquitetura que Estamos Construindo

Estamos movendo o sistema para uma arquitetura mais modular.

Direcao alvo:

1. `chat-service`
   - pipeline principal de entrada/saida

2. `intent / policy / resolver`
   - classificacao da mensagem
   - politicas de decisao
   - resolvedores por dominio

3. modulos especializados
   - catalogo
   - handoff
   - api runtime
   - contexto
   - depois: resolvedor Mercado Livre completo
   - depois: classificador central de dominio

## Estado Atual da Reorganizacao

Ja foi feito:
- contexto compartilhado extraido
- handoff policy extraida
- catalog follow-up extraido
- api runtime extraido
- extracao inicial do dominio Mercado Livre para modulo proprio

Em andamento:
- extracao do dominio Mercado Livre/catalogo comercial
- reducao do peso do `chat-orchestrator.ts`

Etapa concluida nesta rodada:
- o `chat-orchestrator.ts` deixou de montar inline uma parte importante do estado heuristico do Mercado Livre
- essa montagem foi movida para `C:\Projetos\infrastudio\lib\chat-mercado-livre.ts` via um resolvedor/coordenador proprio
- com isso, o orquestrador ficou mais proximo de um papel de pipeline e menos de um arquivo que acumula decisao + execucao + composicao

Etapa concluida na rodada seguinte:
 - o classificador de dominio deixou de ser apenas um log auxiliar
 - foi criado `C:\Projetos\infrastudio\lib\chat-domain-stage.ts`
 - a fase OpenAI agora recebe um `domainSupportState` com:
   - instrucao dedicada por dominio
   - janela recente de mensagens
   - `max_output_tokens` ajustado ao tipo de conversa
 - isso prepara melhor o pipeline para futuros resolvedores por dominio, porque a conversa ja influencia a resposta final de forma explicita

Etapa concluida na rodada atual:
 - o `chat-orchestrator.ts` passou a usar o suporte de dominio de forma real na fase OpenAI
 - conversas de catalogo/comercio, API e qualificacao agora podem ajustar:
   - profundidade recente do historico
   - tamanho maximo da resposta
   - instrucao comportamental da fase LLM
 - a suite automatizada ganhou cobertura para esse suporte de dominio
 - o runner de cenarios agora registra tambem:
   - `domain.max_output_tokens`
   - `domain.recent_message_window`

Etapa concluida na rodada mais recente:
 - foi criado `C:\Projetos\infrastudio\lib\chat-pipeline-stage.ts`
 - o orquestrador deixou de montar separadamente:
   - heuristica
   - dominio
   - rota
   - suporte de dominio
 - essas etapas agora podem ser resolvidas juntas por um helper proprio de pipeline
 - o runner de cenarios passou a usar essa mesma consolidacao, o que aproxima observabilidade e execucao real
 - a suite automatizada ganhou cobertura para o estado consolidado do pipeline

Etapa concluida na rodada atual:
 - foi criado `C:\Projetos\infrastudio\lib\chat-openai-stage.ts`
 - a montagem do payload da Responses API saiu do `chat-orchestrator.ts`
 - o orquestrador agora delega ao builder de OpenAI:
   - historico recente
   - resumo
   - contexto do lead
   - contexto de qualificacao
   - instrucoes consolidadas
   - `max_output_tokens`
 - essa etapa e decisiva porque reduz o maior bloco restante de preparacao inline da fase LLM
 - a suite automatizada ganhou cobertura direta para esse builder

Etapa concluida na rodada mais recente:
 - foi criado `C:\Projetos\infrastudio\lib\chat-summary-stage.ts`
 - o fluxo de resumo/memoria saiu do `chat-orchestrator.ts`
 - agora o resumo compartilha a mesma base de utilitarios OpenAI da resposta principal
 - isso melhora consistencia entre:
   - payload da Responses API
   - parsing da resposta
   - formato do historico enviado
 - a suite automatizada ganhou cobertura do gatilho de refresh do resumo

Etapa concluida na rodada atual:
 - foi criado `C:\Projetos\infrastudio\lib\chat-context-stage.ts`
 - a preparacao de contexto geral saiu do corpo principal do orquestrador
 - o orquestrador agora delega para esse modulo a montagem de:
   - prompts
   - instrucoes
   - focused API context
   - recovery reply
   - sinais de lead/catalogo
 - essa etapa aproxima ainda mais o `chat-orchestrator.ts` de um coordenador de fases

Etapa concluida na rodada mais recente:
 - o classificador central de dominio ganhou mais autoridade
 - ele agora usa sinais de:
   - API na mensagem atual
   - memoria resumida
   - continuidade curta do cliente
   - contexto atual de catalogo
   - contexto atual de lead
 - isso melhora a leitura de mensagens curtas e ambiguas sem depender apenas de heuristica vencedora
- as respostas heuristicas do Mercado Livre tambem passaram a ser resolvidas no modulo `C:\Projetos\infrastudio\lib\chat-mercado-livre.ts`

Etapa concluida na rodada atual:
 - o repertorio do runner de cenarios foi ampliado
 - agora observamos melhor casos de:
   - preco curto
   - continuidade curta de lead
   - contexto de API
   - catalogo vivo sem referencia textual forte
   - memoria resumida
 - os arquivos `analise-chat-test-<timestamp>.md` agora saem com resumo por categoria, o que ajuda a ler mais rapido cada rodada

Etapa concluida na rodada mais recente:
 - a heuristica de catalogo ficou mais robusta em casos cinzentos
 - agora ela:
   - respeita snapshot vencido tambem na resolucao textual
   - entende melhor typo contextual como `dopeira`
   - trata cor como familia (`amarelo` / `amarela`)
   - evita cravar item unico quando o cliente cita apenas um atributo compartilhado

Etapa concluida na rodada atual:
 - foi criado `C:\Projetos\infrastudio\lib\chat-prompt-builders.ts`
 - a fonte de verdade dos builders de apresentacao e prompt comecou a sair do `chat-orchestrator.ts`
 - o orquestrador ja passou a consumir esse modulo nas fases de:
   - contexto
   - formatacao heuristica
   - resposta OpenAI
 - isso prepara uma limpeza futura do arquivo principal com risco bem menor
- isso inclui:
  - resposta comercial de produto em foco
  - listagem recente do conector
  - resposta direta de busca no conector
  - resposta de busca sem resultado
- o `chat-orchestrator.ts` agora so registra trace/log e devolve o objeto montado, sem conhecer o detalhe da composicao comercial do Mercado Livre

Etapa concluida nesta nova rodada:
- a preparacao operacional do fluxo Mercado Livre tambem saiu do `chat-orchestrator.ts`
- o modulo `C:\Projetos\infrastudio\lib\chat-mercado-livre.ts` agora concentra a decisao de:
  - referencia explicita ao catalogo recente
  - listagem generica da loja
  - busca nova de produto
  - candidatos de busca
  - produto atual em foco do catalogo
- isso reduz mais uma camada de ifs no orquestrador e deixa o dominio Mercado Livre com fronteiras mais claras entre:
  - preparacao de fluxo
  - busca/enriquecimento
  - estado heuristico
  - resposta heuristica

Refino adicional:
- o proprio modulo Mercado Livre agora devolve tambem o payload especifico de trace usado nos logs heuristico-comerciais
- com isso, o `chat-orchestrator.ts` precisa saber ainda menos sobre detalhes internos do caminho Mercado Livre

Etapa concluida agora:
- a resposta heuristica de referencia ao catalogo recente saiu do `chat-orchestrator.ts`
- o modulo `C:\Projetos\infrastudio\lib\catalog-follow-up.ts` agora monta:
  - resposta de referencia resolvida
  - resposta de referencia ambigua
  - assets do lote recente
  - metadata e trace desse caminho
- isso aproxima ainda mais o orquestrador de um pipeline que apenas delega, registra e retorna

Refino estrutural seguinte:
- o `chat-orchestrator.ts` ganhou uma fase interna explicita para montar o estado heuristico inicial do pipeline
- essa fase agora consolida em um helper proprio:
  - contexto recente de catalogo
  - decisao de follow-up
  - classificacao ambigua com LLM
  - estado operacional inicial do fluxo Mercado Livre
- isso nao muda o comportamento esperado, mas melhora muito a legibilidade e prepara o caminho para um classificador central de dominio

Etapa concluida agora:
- foi criado um classificador central das prioridades heuristicas em `C:\Projetos\infrastudio\lib\chat-intent-classifier.ts`
- ele ainda nao e o classificador final de dominio completo, mas ja cumpre um papel importante:
  - a ordem das heuristicas deixou de ficar escondida em um bloco de `ifs`
  - o pipeline passou a ter uma decisao central explicita sobre qual caminho heuristico vence primeiro
- isso prepara o passo seguinte, que e expandir esse classificador para dominios mais amplos do orquestrador

Refino seguinte:
- o classificador passou a definir tambem a rota do orquestrador apos a fase heuristica
- com isso, o pipeline ja consegue explicitar melhor quando deve:
  - bloquear agente invalido/inativo
  - retornar uma heuristica vencedora
  - cair no guardrail por falta de OpenAI
  - seguir para o caminho OpenAI
- esse passo deixa o `generateSalesReply(...)` mais proximo de um fluxo por fases nomeadas

Evolucao seguinte:
- o classificador central comecou a ganhar uma leitura mais ampla do dominio da conversa
- isso ainda nao reescreve a logica do orquestrador inteiro, mas ja ajuda a responder perguntas como:
  - estamos em catalogo/comercial?
  - estamos em consulta de API?
  - estamos em qualificacao de lead?
  - estamos em conversa comercial geral?
- essa camada prepara muito bem o proximo refactor do pipeline por dominios

Refino estrutural adicional:
- o `chat-orchestrator.ts` passou a usar um helper padrao para retornos com uso zero
- isso reduz duplicacao na montagem de respostas heuristicas e de recovery
- nao altera a regra de negocio, mas melhora a consistencia estrutural do pipeline

Etapa concluida agora:
- a execucao da fase heuristica do `generateSalesReply(...)` saiu para um helper proprio
- isso significa que o orquestrador agora:
  - classifica a rota heuristica
  - delega a execucao dessa rota
  - segue para guardrail/OpenAI quando necessario
- com isso, o corpo principal do orquestrador fica cada vez mais proximo de um pipeline por fases nomeadas

Etapa concluida na sequencia:
- a execucao do caminho OpenAI tambem saiu do corpo principal para um helper proprio
- isso organiza melhor o pipeline em tres blocos mais claros:
  - heuristica
  - guardrail
  - OpenAI
- o comportamento continua o mesmo, mas a manutencao fica bem mais segura porque a responsabilidade de cada fase fica menos misturada

Refino seguinte:
- a execucao do guardrail tambem passou a usar helper proprio
- com isso, o corpo principal do orquestrador fica ainda mais perto de um coordenador puro de fases
- hoje a leitura do fluxo principal esta muito mais proxima de:
  - classificar
  - delegar heuristica
  - delegar guardrail
  - delegar OpenAI

Proximas etapas desejadas:
- criar resolvedor completo de Mercado Livre
- criar classificador central de intencao/domino
- deixar o orquestrador mais fino
- criar suite de testes automatizados quando a estrutura estiver mais estavel

## Testes da Inteligencia

Foi criada uma primeira bateria leve de smoke tests para os modulos extraidos:

- `C:\Projetos\infrastudio\tests\chat-intelligence.smoke.ts`
  - valida follow-up de catalogo
  - valida referencia por preco e item recente
  - valida preparacao de fluxo do Mercado Livre
  - valida resposta heuristica do Mercado Livre
  - valida resposta heuristica de referencia ao catalogo
  - valida prioridade do classificador heuristico central
  - valida a decisao de rota do orquestrador
  - valida bloqueio de agente invalido/inativo no classificador de rota
  - valida classificacao ampla de dominio da conversa
  - valida classificacao da telemetria de uso

- `C:\Projetos\infrastudio\tests\chat-intelligence.scenarios.ts`
  - runner observavel de cenarios praticos
  - foca em situacoes normais e fora da normalidade
  - ajuda a enxergar o desenrolar da inteligencia sem depender apenas de `pass/fail`
  - agora cobre melhor:
    - catalogo
    - Mercado Livre
    - pipeline geral
    - memoria resumida
    - continuidade curta de lead
    - sinais de API
  - mostra:
    - decisao de follow-up
    - referencias resolvidas
    - estado do fluxo Mercado Livre
    - resposta ambigua ou comercial
    - classificacao heuristica e rota do orquestrador
    - dominio amplo da conversa
    - resumo por categoria no arquivo gerado
    - estimativa de tokens por execucao e por cenario

- `C:\Projetos\infrastudio\analises\analise-chat-test-<timestamp>.md`
  - arquivo gerado na pasta `analises` a cada execucao do runner de cenarios
  - cada execucao cria um novo `.md`
  - isso facilita acompanhar a evolucao de um papo/teste por vez sem misturar rodadas
  - agora tambem registra estimativa de tokens:
    - total da execucao
    - entrada
    - observacoes
    - por cenario
  - essa camada continua sendo estimativa de laboratorio; a telemetria do fluxo real passa a registrar classificacao real de uso por projeto/origem

- `C:\Projetos\infrastudio\tests\server-only.ts`
  - stub usado pelo `tsconfig.tests.json` para remapear `server-only` so no contexto dos testes

- `C:\Projetos\infrastudio\tsconfig.tests.json`
  - configuracao dedicada do runner de testes
  - preserva o comportamento normal da aplicacao e remapeia apenas dependencias de ambiente no teste

Script disponivel:
- `npm run test:chat-intelligence`
- `npm run test:chat-intelligence:scenarios`

## Como Evoluir Este Arquivo

Sempre que houver mudanca importante na inteligencia:
- registrar o que mudou
- registrar por que mudou
- registrar quais arquivos passaram a ser fonte de verdade
- registrar novas regras de decisao
- registrar novas fases do pipeline

## Principio de Evolucao

Nao estamos tentando deixar o sistema apenas "funcionando".
Estamos tentando deixar:

- assertivo para o cliente
- previsivel para a equipe
- modular para evoluir
- testavel no futuro
- legivel quando a memoria desta conversa nao existir mais

Este arquivo deve continuar sendo enriquecido nas proximas rodadas.

## Ultima Limpeza de Ruido Estrutural

Foi feita uma ultima varredura no `C:\Projetos\infrastudio\lib\chat-orchestrator.ts` para remover duplicacao de builders de prompt e apresentacao.

O que mudou:
- o orquestrador deixou de manter copias locais de helpers que ja tinham sido promovidos para `C:\Projetos\infrastudio\lib\chat-prompt-builders.ts`
- a fonte de verdade para esta familia ficou consolidada em `chat-prompt-builders.ts`
- permaneceram no orquestrador apenas helpers que ainda sao realmente locais ao fluxo, como a montagem de `runtimeAssets`

Familias removidas do orquestrador nesta limpeza:
- instrucoes de resposta estruturada
- instrucoes de canal
- instrucao analitica
- instrucao de assets
- extracao de tags de assets
- preferencia por resposta estruturada
- formatacao heuristica
- prompt de sistema
- prompt de runtime
- prompt legado do agente
- deteccao de rota de prompt

Impacto:
- menos peso morto dentro do orquestrador
- menos risco de divergencia entre modulo compartilhado e copia local
- melhor manutencao para a reta final da arquitetura

## Unificacao Final de Contato

Foi criado o modulo compartilhado `C:\Projetos\infrastudio\lib\chat-contact-utils.ts` para consolidar a extracao de nome e telefone.

O que mudou:
- `chat-lead-stage.ts` passou a delegar `extractName` e `extractPhone` para `chat-contact-utils.ts`
- `chat-recovery-stage.ts` passou a delegar `extractName` e `extractPhone` para `chat-contact-utils.ts`
- o objetivo foi remover a ultima duplicacao transversal mais evidente entre lead e recovery

Impacto:
- uma unica fonte de verdade para identificacao textual de contato
- menos risco de um modulo reconhecer nome/telefone de um jeito e o outro de outro
- acabamento mais consistente para o fechamento da arquitetura

## Laboratorio de Fixtures para Evolucao

Foi criada uma base reutilizavel de fixtures para acelerar testes de evolucao do orquestrador e dos dominios.

Arquivos criados:
- `C:\Projetos\infrastudio\tests\fixtures\catalog-context.base.json`
  - contexto base de catalogo recente
- `C:\Projetos\infrastudio\tests\fixtures\api-runtime-context.products.json`
  - simulacao de APIs de produto e status de pedido
- `C:\Projetos\infrastudio\tests\fixtures\mercado-livre-products.json`
  - simulacao de listagem, busca e detalhes de produtos do Mercado Livre
- `C:\Projetos\infrastudio\tests\chat-test-fixtures.ts`
  - loader central dos fixtures
  - normalizacao compartilhada
  - deps base para busca e follow-up em laboratorio

Como esta sendo usado agora:
- `chat-intelligence.smoke.ts` passou a consumir os fixtures compartilhados
- `chat-intelligence.scenarios.ts` passou a consumir o contexto base e os deps do laboratorio
- a suite agora fica mais preparada para crescer sem duplicar grandes objetos inline em cada teste

Objetivo pratico:
- permitir novas baterias de testes com contexto consistente
- facilitar simulacao de API de produtos e de Mercado Livre
- reduzir o custo de montar cenarios de regressao e evolucao

## Expansao do Laboratorio de Regressao

O laboratorio de fixtures foi ampliado com casos dificeis e com um runner separado por dominio.

Novos fixtures:
- `C:\Projetos\infrastudio\tests\fixtures\catalog-context.stale.json`
  - snapshot vencido para validar bloqueio de referencia antiga
- `C:\Projetos\infrastudio\tests\fixtures\api-runtime-context.error.json`
  - API com erro/timeout para validar fallback factual
- `C:\Projetos\infrastudio\tests\fixtures\mercado-livre-ambiguous.json`
  - itens muito parecidos para validar ambiguidade comercial

Novas capacidades do loader:
- `loadStaleCatalogContextFixture()`
- `loadApiRuntimeErrorFixture()`
- `loadMercadoLivreAmbiguousFixture()`

Novo runner:
- `C:\Projetos\infrastudio\tests\chat-intelligence.domain-regression.ts`
  - foca em regressao por dominio
  - separa observacao de:
    - catalogo
    - api
    - mercado livre

Novo script:
- `npm run test:chat-intelligence:domains`

Objetivo pratico:
- facilitar validacao de casos dificeis sem depender apenas do runner geral
- criar uma base mais preparada para evolucao segura por dominio

## Cobertura de Lead e Handoff no Laboratorio

O runner de regressao por dominio foi ampliado para cobrir tambem lead e handoff.

Novos fixtures:
- `C:\Projetos\infrastudio\tests\fixtures\lead-context.base.json`
  - contexto base para identificacao de lead no WhatsApp
- `C:\Projetos\infrastudio\tests\fixtures\handoff-cases.json`
  - mensagens e historico minimo para validar escalada humana

Novas leituras de regressao:
- `lead`
  - reconhecimento de resposta de nome
  - enriquecimento de nome e telefone
  - acknowledgement comercial apos nome identificado
- `handoff`
  - deteccao de pedido explicito de humano
  - oferta opcional de humano
  - resposta de handoff no canal
  - bloqueio de escalada automatica fora do WhatsApp

## Ajuste Final de Utilitarios Compartilhados

Foi feito mais um ajuste pequeno para reduzir divergencia futura:
- `C:\Projetos\infrastudio\lib\chat-intent-classifier.ts` passou a usar `normalizeText` de `C:\Projetos\infrastudio\lib\chat-text-utils.ts`

Impacto:
- menos utilitario local redundante
- classificacao central mais alinhada com a mesma normalizacao usada no restante da inteligencia

## Fechamento Executivo

Foi criado o arquivo final de fechamento:
- `C:\Projetos\infrastudio\RELATORIO_FINAL_EXECUTIVO.md`

Tambem foi criado o script consolidado:
- `npm run test:chat-intelligence:full`

Objetivo desse fechamento:
- facilitar subida e validacao final
- deixar documentado que nao houve necessidade de mudanca em banco
- consolidar entregas, validacao e riscos residuais

## Virada para Semantic Intent Stage

Foi iniciada a troca do motor de interpretacao de mensagens do usuario no fluxo de catalogo:
- `C:\Projetos\infrastudio\lib\chat-semantic-intent-stage.ts`

Responsabilidade:
- usar OpenAI apenas para classificar semanticamente a intencao do usuario
- ler mensagem atual + contexto recente de catalogo
- devolver JSON estruturado com:
  - `intent`
  - `confidence`
  - `reason`

Categorias atuais:
- `product_interest`
- `product_question`
- `product_rejection`
- `new_search`
- `generic`

Integracao atual:
- a fase semantica passou a rodar antes do follow-up de catalogo no `chat-orchestrator.ts`
- quando houver contexto recente de catalogo, ela vira o motor principal de decisao
- a heuristica local continua apenas como fallback tecnico quando a classificacao semantica nao estiver disponivel

Evolucao herdada para API:
- a mesma familia semantica passou a apoiar tambem o dominio de API quando existir `focusedApiContext`
- nesse caminho, a classificacao nao responde o usuario; ela apenas ajuda o classificador central a decidir se a mensagem continua no contexto factual de API ou se voltou para um fluxo generico/comercial
- isso reduz o risco de o contexto de API sequestrar mensagens que na verdade ja mudaram de assunto

## Ajuste de Linguagem Pos-Lista

Foi removida a dependencia de copy que exigia a palavra `"mais"` apos envio de lista de produtos no WhatsApp.

Arquivos principais:
- `C:\Projetos\infrastudio\lib\chat-mercado-livre.ts`
- `C:\Projetos\infrastudio\lib\chat-service.ts`

Mudanca:
- as respostas de vitrine/listagem passaram a convidar continuidade livre da conversa
- exemplos de nova direcao:
  - "Me diga se gostou de algum..."
  - "Se gostar desse estilo..."
  - "Posso te mostrar outras opcoes parecidas..."

Objetivo pratico:
- nao ensinar o usuario a depender de uma palavra gatilho
- deixar a `semantic_intent_stage` assumir mais da interpretacao
- reduzir loops causados por heuristica presa a frase esperada

## Reducao de Peso da Heuristica de Catalogo

Foi feita mais uma rodada para empurrar a heuristica de catalogo para um papel mais secundario.

Mudancas:
- `C:\Projetos\infrastudio\lib\catalog-follow-up.ts`
  - deixou de usar sinais amplos de compra/detalhe como motor de referencia de catalogo
  - removeu boost heuristico que prendia a interpretacao ao produto atual apenas por linguagem comercial generica

Impacto esperado:
- menos chance de o fallback heuristico "adivinhar" intencao do usuario
- mais espaco para a `semantic_intent_stage` decidir pelo contexto
- fallback local mais tecnico e contido, em vez de motor principal de conversa

Laboratorio:
- `C:\Projetos\infrastudio\tests\chat-intelligence.domain-regression.ts`
- `C:\Projetos\infrastudio\tests\chat-intelligence.scenarios.ts`

Nova observacao:
- os runners passaram a olhar tambem o pipeline semantico integrado em catalogo, e nao apenas helpers heuristicos isolados

## Reducao de Busca Automatizada Solta

Foi feita uma rodada para reduzir disparos de busca automatica baseados em memoria textual do proprio assistente.

Arquivos:
- `C:\Projetos\infrastudio\lib\chat-sales-heuristics.ts`

Mudanca:
- `shouldContinueProductSearch(...)` deixou de depender de frases anteriores do assistente como indicio de continuidade
- `shouldUseMercadoLivreConnectorFallback(...)` deixou de disparar fallback solto apenas porque a frase tinha cara vaga de produto

Regra nova:
- esses dois caminhos agora exigem contexto real de busca anterior (`catalogo.ultimaBusca`) para continuar automaticamente

Objetivo pratico:
- evitar repeticao
- evitar busca nova em mensagens curtas como "gostei desse"
- reduzir a sensacao de fluxo apressado e engessado

## Fortalecimento da Fala Comercial do Produto

Foi feita uma rodada para o agente vender melhor quando o produto entra em foco, principalmente no Mercado Livre.

Arquivo principal:
- `C:\Projetos\infrastudio\lib\chat-mercado-livre.ts`

Mudanca:
- a resposta comercial passou a usar melhor a `descricao` detalhada do anuncio
- a fala agora mistura:
  - preco
  - pontos fortes do anuncio
  - resumo curto do descritivo
  - convite natural para seguir no papo de venda

Objetivo pratico:
- evitar resposta seca demais
- melhorar conducao comercial
- aproveitar melhor o contexto detalhado ja disponivel do anuncio

Refino adicional:
- quando o fluxo estiver em produto unico ou produto em foco e o cliente demonstrar interesse, a resposta deve priorizar conversa comercial sobre esse item
- nesse caso, o agente nao deve apenas relistar ou reapresentar o mesmo produto; ele deve usar o descritivo detalhado para vender melhor e sondar o cliente
- o modo "produto em foco" tambem passou a valer quando o proprio pipeline semantico ja decidiu que o item atual e a continuidade correta da conversa
- os runners de laboratorio passaram a observar explicitamente se o produto em foco virou conversa consultiva, com:
  - uso do descritivo
  - pergunta de sondagem
  - bloqueio de relistagem

Objetivo pratico:
- reduzir dependencia de listas fixas de frases
- diminuir loops de listagem e busca
- fazer a decisao depender mais de contexto e menos de palavra exata

## Reforco da Suite de WhatsApp no Inicio do Atendimento

Foi adicionada uma rodada mais realista de testes para pegar problemas logo no comeco da conversa via WhatsApp, antes do teste vivo.

Arquivos envolvidos:
- `C:\Projetos\infrastudio\tests\fixtures\whatsapp-context.base.json`
- `C:\Projetos\infrastudio\tests\chat-intelligence.smoke.ts`
- `C:\Projetos\infrastudio\tests\chat-intelligence.domain-regression.ts`
- `C:\Projetos\infrastudio\tests\chat-intelligence.scenarios.ts`

Cobertura nova:
- identidade canonica do contato quando o inbound vier com `@lid`
- preservacao da frase humana de follow-up na intro da lista
- entrega da lista no formato:
  - intro
  - um produto por mensagem
- continuidade curta apos lista no WhatsApp, evitando reiniciar o atendimento como se fosse cliente novo

Objetivo pratico:
- capturar perda de contexto logo no inicio
- evitar que a mesma cliente pareca "nova" por divergencia de identificador
- garantir que a lista continue convidando o cliente a responder livremente

## Fallback Factual de API quando OpenAI falha

Foi reforcado o comportamento do orquestrador e do recovery para nao abandonar perguntas factuais de API quando a chamada principal ao OpenAI falhar.

Arquivos envolvidos:
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
- `C:\Projetos\infrastudio\lib\chat-recovery-stage.ts`
- `C:\Projetos\infrastudio\tests\chat-intelligence.smoke.ts`

Mudanca:
- o recovery contextual agora sempre tenta `buildApiFallbackReply(...)` quando existirem campos relevantes de API, sem depender apenas de regex estreita como `status`, `codigo` ou `consulta`
- o fail-closed do OpenAI passou a registrar melhor se havia fallback factual de API disponivel
- quando houver fallback factual utilizavel, ele pode ser preferido ao recovery generico

Objetivo pratico:
- reduzir a sensacao de que o agente "nao acessou a API"
- manter respostas factuais uteis mesmo em queda da camada OpenAI
- aumentar a capacidade de diagnosticar se a falha real estava na API, no OpenAI ou no payload

## Suite Avancada para API no Chat Externo

Foi criada uma camada de testes mais proxima do caso real do widget externo usando API factual de imovel.

Arquivos envolvidos:
- `C:\Projetos\infrastudio\tests\fixtures\api-runtime-context.real-estate.json`
- `C:\Projetos\infrastudio\lib\chat-api-runtime.ts`
- `C:\Projetos\infrastudio\lib\chat-recovery-stage.ts`
- `C:\Projetos\infrastudio\tests\chat-intelligence.smoke.ts`
- `C:\Projetos\infrastudio\tests\chat-intelligence.scenarios.ts`

Cobertura nova:
- pergunta analitica tipo `sera que vale a pena`
- follow-up longo com muito contexto de risco, cartorio e matricula
- follow-up curto em variacoes naturais, sem depender de frase exata
- resposta mais empatica no fallback analitico de API

Mudanca de comportamento:
- o fallback analitico agora prioriza melhor campos de risco, cartorio, matricula e custo antes de titulo/descricao genericos
- o recovery de API segura continuacoes curtas de forma mais contextual, sem depender de uma frase fixa especifica
- o `buildFocusedApiContext(...)` tambem preserva contexto factual em continuacoes curtas, para o pipeline principal nao perder o fio da analise nem reiniciar o atendimento em mensagens como `sim segue`
- datas de API, como `data_leilao`, passaram a ser normalizadas em formato humano (`dd/mm/aaaa hh:mm`) com icone `📅`, tanto em resposta direta quanto em leitura analitica
- a suite agora mede ruido de UX no fluxo de API do widget externo, observando explicitamente:
  - reinicio generico do atendimento
  - ausencia de empatia
  - data crua em ISO
  - perda de contexto na sequencia `datas -> vale a pena -> sim segue`
- a suite tambem cobre o `chat de teste do agente` em produto focado, observando:
  - repeticao indevida do mesmo produto
  - reinicio generico do atendimento
  - relistagem em vez de resposta tecnica
  - riqueza da resposta com base na descricao detalhada do anuncio

Objetivo pratico:
- evitar que o chat externo se perca logo depois de uma boa resposta factual
- manter a conversa consultiva mesmo quando a camada OpenAI falhar
- reduzir resposta seca ou genérica em cenarios de `vale a pena` e `segue`


## Atualizacao 2026-04-03 - laboratorio de inicio de conversa ML
- O laboratorio agora valida explicitamente o caminho de recovery do Mercado Livre no chat de teste do agente.
- Novos sinais observados nos cenarios:
  - `agent_test.ml_recovery_guided_search`
  - `agent_test.ml_recovery_generic_form`
  - `agent_test.listing_intent_detected`
  - `agent_test.listing_reuses_previous_search`
- O objetivo dessa rodada foi capturar antes do teste real quando o fluxo cair cedo demais em texto generico do tipo `Como este agente esta focado na loja do Mercado Livre...`.
- O recovery contextual do Mercado Livre agora tenta transformar pedidos claros de produto em busca guiada, inclusive com typo simples como `soperia`, em vez de abrir um formulario generico.

## Atualizacao 2026-04-03 - higiene de resposta e produto em foco
- A sanitizacao do `chat-service` ficou mais robusta para remover vazamentos de prompt/estilo que escapem para a resposta final, incluindo variantes com acento e pontuacao residual.
- Exemplo protegido: `de forma natural, simp�tica e acolhedora`.
- O `semantic_intent_stage` foi ajustado para que `product_interest` e `product_question`, quando existe `produtoAtual`, nao voltem automaticamente para `catalog_reference`.
- Isso reduz o loop de reafirmacao do item e deixa mais espaco para a resposta consultiva baseada no produto em foco.

## Atualizacao 2026-04-03 - cenario de confusao apos produto unico
- O laboratorio agora tem um cenario explicito para o ponto em que o agente entrega um unico produto e o cliente continua com uma pergunta tecnica/comercial.
- Sinais observados nesse novo cenario:
  - `agent_test.single_product_delivery_is_commercial`
  - `agent_test.single_product_delivery_uses_description`
  - `agent_test.follow_up_mentions_material`
  - `agent_test.follow_up_mentions_state`
  - `agent_test.follow_up_avoids_restart`
  - `agent_test.follow_up_avoids_relisting`
- O objetivo dessa cobertura e impedir que o fluxo volte a repetir card, reafirmar item de forma seca ou reiniciar o atendimento apos o primeiro produto entregue.
