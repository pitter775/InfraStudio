# InfraStudio - Fonte Unica de Contexto

Este arquivo e a referencia principal para manutencao, evolucao de arquitetura e operacao do projeto.
Antes de alterar codigo, considere este documento como a fonte de verdade.

## 1. Regras obrigatorias

### Banco de dados
- Nunca editar automaticamente `C:\Projetos\infrastudio\database\geral-schema.sql`.
- Tratar `C:\Projetos\infrastudio\database\geral-schema.sql` apenas como documentacao manual e snapshot do banco.
- Toda alteracao real de banco deve ser criada em um arquivo SQL dentro de `C:\Projetos\infrastudio\database\seeder\`.
- O assistente pode criar arquivos SQL em `C:\Projetos\infrastudio\database\seeder\`, mas nao deve sincronizar, sobrescrever ou atualizar automaticamente `C:\Projetos\infrastudio\database\geral-schema.sql`.
- Depois de aplicar mudancas no Supabase, a atualizacao de `C:\Projetos\infrastudio\database\geral-schema.sql` deve ser feita manualmente pelo usuario.

### Operacao
- Nao usar patch cego.
- Nao pedir confirmacao desnecessaria quando o caminho estiver claro.
- Considerar Windows e PowerShell primeiro.
- O repositorio do app e `C:\Projetos\infrastudio`.
- O worker do WhatsApp fica em repo separado: `C:\Projetos\whatsapp-service`.

## 2. O que o sistema e hoje

O `InfraStudio` nao e apenas um painel.
Hoje ele opera quatro frentes conectadas:

1. painel admin para projetos, agentes, APIs, canais, atendimento e uso
2. chat do site/widget travado por projeto e agente
3. canal oficial de WhatsApp via worker Node separado
4. inbox humana com handoff, retomada da IA e anexos

## 3. Arquitetura real

### App principal
- framework: Next.js App Router
- linguagem: TypeScript
- UI: React 19 + Tailwind CSS 4
- auth: JWT proprio + tabela `usuarios`
- dados: Supabase como banco de dados
- seguranca: JWT com `jose`
- hash de senha: `bcryptjs`
- IA: OpenAI Responses API

### Worker WhatsApp
- repo local: `C:\Projetos\whatsapp-service`
- endereco fisico no disco: `C:\Projetos\whatsapp-service`
- repositorio remoto: `https://github.com/pitter775/servidor_node.git`
- deploy separado
- runtime esperado: Node persistente
- biblioteca: `whatsapp-web.js` + Puppeteer
- sessao persistente: `LocalAuth` com volume/disco persistente
- servidor HTTP local esperado: `http://localhost:3010`
- health local: `http://localhost:3010/health`
- health de producao: `https://servidornode-production-c17f.up.railway.app/health`

### Infra atual
- app principal roda na Vercel
- worker do WhatsApp roda separado
- o app conversa com o worker por HTTP
- o health publico do worker usado na operacao e:
  `https://servidornode-production-c17f.up.railway.app/health`

## 4. Estrutura principal do codigo

- `C:\Projetos\infrastudio\app\`
  paginas, layouts e rotas
- `C:\Projetos\infrastudio\app\(cliente)\`
  area do cliente com visoes por projeto
- `C:\Projetos\infrastudio\app\admin\`
  painel administrativo
- `C:\Projetos\infrastudio\app\api\`
  endpoints HTTP finos
- `C:\Projetos\infrastudio\middleware.ts`
  protecao de rotas e APIs com JWT proprio
- `C:\Projetos\infrastudio\lib\`
  regra de negocio, chat, handoff, logs, integracoes
- `C:\Projetos\infrastudio\lib\supabase\`
  acesso administrativo e env do Supabase como banco
- `C:\Projetos\infrastudio\database\`
  snapshot manual + seeds SQL
- `C:\Projetos\infrastudio\public\`
  widget e assets
- `C:\Projetos\infrastudio\logs\`
  artefatos locais

## 5. Fluxos principais

### Chat do site
1. widget chama `POST /api/chat`
2. `lib/chat-service.ts` resolve projeto, agente e contexto
3. `lib/chat-orchestrator.ts` coordena heuristica, OpenAI, APIs, ML e handoff
4. resposta, consumo e logs sao persistidos

### WhatsApp oficial
1. o worker recebe a mensagem no canal
2. envia para o backend do app principal
3. o backend reutiliza o mesmo pipeline do chat
4. o worker devolve a resposta ao cliente
5. sessao, QR e runtime voltam para o painel
6. a sessao deve sobreviver a restart via volume persistente

### Handoff humano
1. cliente pede humano ou a politica decide offer/required
2. o backend abre handoff para o chat
3. numeros cadastrados recebem alerta
4. humano assume e a IA silencia
5. ao liberar, a IA volta

### Inbox humana
1. `admin/atendimento` mistura site e WhatsApp
2. humano pode responder manualmente
3. anexos reais existem nessa inbox
4. arquivos vao para storage e ficam vinculados ao chat

## 6. Arquivos mais importantes hoje

### Chat e inteligencia
- `C:\Projetos\infrastudio\lib\chat-service.ts`
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
- `C:\Projetos\infrastudio\lib\chat-intent-classifier.ts`
- `C:\Projetos\infrastudio\lib\chat-domain-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-openai-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-summary-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-context-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-pipeline-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-prompt-builders.ts`
- `C:\Projetos\infrastudio\lib\chat-api-runtime.ts`
- `C:\Projetos\infrastudio\lib\catalog-follow-up.ts`
- `C:\Projetos\infrastudio\lib\chat-mercado-livre.ts`
- `C:\Projetos\infrastudio\lib\chat-handoff-policy.ts`
- `C:\Projetos\infrastudio\lib\chat-lead-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-sales-heuristics.ts`
- `C:\Projetos\infrastudio\lib\chat-recovery-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-contact-utils.ts`
- `C:\Projetos\infrastudio\lib\chat-text-utils.ts`

### Atendimento
- `C:\Projetos\infrastudio\app\admin\atendimento\page.tsx`
- `C:\Projetos\infrastudio\app\api\admin\chats\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\chats\[id]\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\chats\[id]\attachments\route.ts`
- `C:\Projetos\infrastudio\lib\chat-attachments.ts`

### Projeto detalhado
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\_components\project-whatsapp-section.tsx`
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\_components\project-chats-section.tsx`
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\_components\project-mercado-section.tsx`

### WhatsApp
- `C:\Projetos\infrastudio\lib\whatsapp-service.ts`
- `C:\Projetos\infrastudio\lib\whatsapp-handoff-alerts.ts`
- `C:\Projetos\infrastudio\lib\whatsapp-handoff-contatos.ts`
- `C:\Projetos\infrastudio\lib\chat-handoffs.ts`
- `C:\Projetos\whatsapp-service\server.js`

### Logs e uso
- `C:\Projetos\infrastudio\lib\chat-logs.ts`
- `C:\Projetos\infrastudio\lib\runtime-error-log.ts`
- `C:\Projetos\infrastudio\lib\chat-usage-metrics.ts`
- `C:\Projetos\infrastudio\lib\ia-usage.ts`
- `C:\Projetos\infrastudio\lib\billing.ts`
- `C:\Projetos\infrastudio\lib\planos.ts`
- `C:\Projetos\infrastudio\app\admin\chat-logs\page.tsx`
- `C:\Projetos\infrastudio\app\admin\planos\page.tsx`
- `C:\Projetos\infrastudio\app\admin\planos\_components\*`
- `C:\Projetos\infrastudio\app\(cliente)\projetos\page.tsx`
- `C:\Projetos\infrastudio\app\(cliente)\projetos\_components\*`
- `C:\Projetos\infrastudio\lib\session.ts`
- `C:\Projetos\infrastudio\lib\session-token.ts`
- `C:\Projetos\infrastudio\app\api\auth\login\route.ts`
- `C:\Projetos\infrastudio\app\api\auth\me\route.ts`
- `C:\Projetos\infrastudio\app\api\auth\logout\route.ts`

## 7. Estado atual da inteligencia do chat

### Direcao geral
- o chat hoje trabalha com contexto acumulado
- o pipeline tenta resolver localmente casos fortes e baratos
- OpenAI entra quando ha ambiguidade relevante ou resposta mais rica
- a escalada humana nao e mais booleana; usa `none`, `offer` e `required`

### Pontos fortes atuais
- follow-up de catalogo ficou mais inteligente
- referencias a item recente melhoraram
- contexto de produto em foco esta mais comercial
- fallback factual de API ficou mais robusto
- identidade canonica do cliente no WhatsApp foi reforcada
- telemetria de uso agora classifica canal, provider, rota e dominio

### Follow-up de catalogo
Estados principais:
- `recent_product_reference`
- `recent_product_reference_ambiguous`
- `new_product_search`
- `load_more_results`
- `non_catalog_message`

O contexto de catalogo considera:
- `ultimaBusca`
- `produtoAtual`
- `ultimosProdutos`
- `snapshotId`
- `snapshotCreatedAt`
- `snapshotTurnId`
- `cardIndex`

### Mercado Livre
- lista e produto em foco foram refinados para vender melhor
- a resposta usa melhor descricao do anuncio
- o fluxo evita relistar o mesmo item sem necessidade
- a conversa tenta ficar consultiva quando o cliente demonstra interesse

### API runtime
- o agente consegue responder melhor perguntas factuais e analiticas
- fallback factual continua util mesmo quando a camada OpenAI falha
- o contexto focado de API tenta segurar a continuidade curta

### WhatsApp
- o texto para o canal foi sanitizado
- links e lista de produtos foram ajustados para delivery melhor no WhatsApp
- o envio manual do atendimento usa formatter proprio do WhatsApp
- o worker agora aceita envio de anexo mesmo sem texto
- arquivos genericos usam `sendMediaAsDocument`

## 7.1. Billing e uso de tokens

### Direcao atual
- o controle de uso esta centralizado em `C:\Projetos\infrastudio\lib\billing.ts`
- o frontend nao deve recalcular regra de negocio de billing
- `chat-service` continua como ponto de bloqueio operacional antes da resposta da IA
- `chat-orchestrator` agora pode expor snapshot operacional em `metadata.billingControl`

### Ordem de consumo ativa
- `tokens_avulsos`
- limite do plano
- excedente quando permitido
- bloqueio quando excedente nao for permitido

### Comportamento operacional atual
- ao atingir 80% do limite total do ciclo, marca `alerta_80`
- ao atingir 100% do limite total do ciclo, marca `alerta_100`
- se `permitir_excedente = false`, o ciclo marca `bloqueado = true` e a IA para responder
- se `permitir_excedente = true`, o ciclo continua ativo e calcula `excedente_tokens` e `excedente_custo`
- inbox humana continua fora desse bloqueio operacional

### Ciclo e persistencia
- o ciclo aberto em `projetos_ciclos_uso` guarda limite, alertas, bloqueio, excedente e `plano_id`
- novo ciclo reseta tokens, custo, alertas, bloqueio e excedente
- `registrarUso` consome tokens avulsos antes de acumular no ciclo/plano
- `consumos` continua sendo gravado como trilha de uso cobrado no plano

### Arquivos-chave de billing
- `C:\Projetos\infrastudio\lib\billing.ts`
- `C:\Projetos\infrastudio\app\api\admin\uso\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\planos\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\planos\[id]\route.ts`

## 8. Testes e laboratorio

Scripts principais:
- `npm run lint`
- `npm run test:chat-intelligence`
- `npm run test:chat-intelligence:scenarios`
- `npm run test:chat-intelligence:domains`
- `npm run test:chat-intelligence:full`

Arquivos principais do laboratorio:
- `C:\Projetos\infrastudio\tests\chat-intelligence.smoke.ts`
- `C:\Projetos\infrastudio\tests\chat-intelligence.scenarios.ts`
- `C:\Projetos\infrastudio\tests\chat-intelligence.domain-regression.ts`
- `C:\Projetos\infrastudio\tests\chat-test-fixtures.ts`
- `C:\Projetos\infrastudio\tests\fixtures\*.json`
- `C:\Projetos\infrastudio\analises\`

Cobertura importante atual:
- catalogo
- Mercado Livre
- API factual
- lead
- handoff
- identidade de contato no WhatsApp
- inicio de conversa no WhatsApp

## 9. Localhost e operacao local

### App principal
```powershell
cd C:\Projetos\infrastudio
npm run dev
```

URL:
- `http://localhost:3000`

### Worker do WhatsApp
```powershell
cd C:\Projetos\whatsapp-service
npm run dev
```

URL:
- `http://localhost:3010`

Health:
```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3010/health
```

### Variavel importante no app principal
No `.env.local`, garantir:
```env
NEXT_PUBLIC_WHATSAPP_SERVICE_URL=http://localhost:3010
```

### Ordem recomendada
1. subir o app principal
2. subir o worker do WhatsApp
3. abrir o painel admin
4. testar a aba de WhatsApp do projeto

## 10. Hotspots atuais

Arquivos mais sensiveis para refactor:
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\admin\atendimento\page.tsx`
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
- `C:\Projetos\infrastudio\lib\chat-service.ts`

## 11. Decisoes de UX e operacao recentes

- atendimento mobile teve varios ajustes de scroll
- botao manual de atualizar foi removido da inbox
- menu mobile do atendimento foi corrigido
- o atalho de assumir/liberar IA foi levado para perto da caixa de texto
- caixa de resposta do atendimento cresce de 1 ate 5 linhas
- anexos no atendimento ganharam preview e truncamento melhor
- tela de projetos no mobile ficou mais compacta
- modal de editar agente no mobile virou fluxo com abas
- secao de WhatsApp do projeto no mobile tambem ganhou abas
- `admin/planos` virou tela unificada de planos e consumo
- a tela unificada prioriza resumo no topo, lista simples de planos e lista principal de projetos
- status visual de uso segue cores por estado operacional: verde, amarelo, laranja, vermelho e azul para excedente
- a listagem de projetos em `admin/planos` usa dados prontos de `/api/admin/uso`, sem recalculo local de billing
- a area do cliente agora possui `app/(cliente)/projetos/page.tsx` com visao por projeto
- a visao do cliente mostra nome do projeto, plano atual, barra de uso, tokens usados, limite, custo e status visual
- o detalhe do projeto abre em modal e exibe uso detalhado, custo, limite do plano e status atual
- as acoes `trocar plano` e `comprar tokens` existem como placeholders no frontend
- a tela do cliente consome apenas APIs existentes e nao recalcula billing no frontend
- o login principal usa `usuarios.email` + `usuarios.senha` e cria sessao JWT propria
- a verificacao de sessao foi centralizada em `lib/session-token.ts`
- `middleware.ts` agora protege paginas `/admin`, `/projetos` e APIs internas com JWT proprio
- usuarios inativos nao conseguem autenticar
- o app nao depende mais de Supabase Auth como fonte principal; Supabase fica como banco

## 12. O que sempre lembrar antes de mexer

- widget do site e inbox humana nao sao a mesma entrega
- anexos reais existem hoje no atendimento humano
- o worker do WhatsApp e separado do app principal
- UI verde no painel nao basta; checar runtime real quando necessario
- persistencia principal da sessao do WhatsApp depende de volume do worker
- a fonte de verdade da conversa e handoff e a inbox de `admin/atendimento`
- qualquer mudanca de banco vai para `database/seeder`
- nunca mexer automaticamente no `database/geral-schema.sql`

## 13. Direcao de evolucao da arquitetura

Objetivo continuo:
- manter o sistema modular
- reduzir peso do `chat-orchestrator.ts`
- deixar o `chat-service.ts` mais claro como pipeline
- evoluir observabilidade de uso real
- validar cada ajuste importante com laboratorio e cenario real

Resumo executivo atual:
- base forte de inteligencia ja existe
- sem necessidade recente de mudanca estrutural em banco para essa frente
- sistema esta mais testavel, mais observavel e mais modular do que no ponto de partida

