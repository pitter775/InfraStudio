# InfraStudio - Especificacao Tecnica do Modo Demonstracao

## Introducao

O modo demonstracao do InfraStudio deve operar com isolamento total por usuario demo. Cada sessao demo recebe um projeto proprio, derivado de um template base, sem compartilhar agentes, APIs, widgets, chats, conectores ou canais com outros usuarios em demonstracao.

Objetivos do modo demo:

- permitir teste funcional do sistema com experiencia completa
- impedir vazamento de dados entre demos
- permitir uso real dos fluxos principais, incluindo WhatsApp
- descartar automaticamente dados sensiveis e sessoes temporarias ao fim da demo

Conceitos base:

- projeto demo isolado por usuario: cada usuario demo trabalha em um projeto proprio, criado a partir de um template
- duracao da demo: tempo limitado, recomendado em `30 minutos`
- dados persistentes: configuracoes e estruturas que podem ser herdadas na conversao para conta real
- dados efemeros: sessoes, historicos, tokens e informacoes sensiveis descartadas ao expirar ou converter

Premissa obrigatoria:

- o usuario precisa conseguir testar o sistema sem afetar outros usuarios demo e sem herdar dados sensiveis por acidente

## Regras Globais do Modo Demo

- cada usuario demo recebe um projeto proprio criado por clone de um projeto template
- nao existe compartilhamento de dados entre projetos demo
- todo acesso backend deve validar `is_demo`, `demo_expires_at` e estado do projeto
- projeto demo expirado nao pode executar mutacoes nem abrir novas sessoes externas
- cleanup automatico deve ser executado por job agendado
- cleanup deve desconectar WhatsApp, invalidar sessoes externas, remover dados sensiveis e encerrar o projeto demo

Modelo esperado de controle:

- `is_demo: boolean`
- `demo_expires_at: timestamp`
- `modo: "demo" | "real"`
- `demo_template_source_id: string | null`
- `demo_owner_user_id: string | null`
- `demo_status: "ativo" | "expirado" | "convertido" | "descartado"`

Validacoes obrigatorias no backend:

- se o projeto pertence ao usuario demo autenticado
- se o projeto esta dentro do prazo
- se a acao pode usar recurso externo no modo demo
- se o dado gerado deve ser persistido, limpo ou herdado na conversao

## Dashboard

### Como funciona no modo demo

O dashboard exibe dados reais do projeto demo isolado do usuario. Os numeros apresentados devem refletir apenas agentes, chats, widgets, canais e consumos gerados dentro daquele projeto demo.

### O que pode fazer

- leitura completa
- visualizar metricas do proprio projeto demo
- acompanhar atividade gerada durante a demonstracao

### O que e isolado por usuario

- contadores
- indicadores de uso
- chats
- logs
- canais e integrações

### O que e temporario

- metricas agregadas de uso da demo
- eventos de dashboard gerados durante a sessao

### O que sera herdado ao criar conta real

- nada diretamente do dashboard
- apenas os objetos reais herdados de outras abas impactarao o dashboard da conta convertida

### Regras especiais

- nao deve usar dados simulados se o objetivo for testar o fluxo real do projeto demo
- pode haver fallback visual vazio quando nenhuma acao tiver sido executada ainda

## Agentes

### Como funciona no modo demo

Agentes funcionam com CRUD completo dentro do projeto demo isolado. O usuario pode criar, editar, testar, ativar, desativar e excluir agentes.

### O que pode fazer

- criar agentes
- editar prompt base
- vincular APIs
- vincular widgets
- vincular conectores
- testar comportamento
- excluir agentes

### O que e isolado por usuario

- todos os agentes pertencem apenas ao projeto demo do usuario
- prompts, configuracoes e relacoes nao podem aparecer em outro projeto demo

### O que e temporario

- logs de execucao de teste
- estados transitivos de diagnostico

### O que sera herdado ao criar conta real

- agentes
- prompt base
- configuracoes nao sensiveis
- relacoes com APIs e widgets validos

### Regras especiais

- IDs internos do projeto demo nao devem ser reaproveitados na migracao final se houver clonagem
- arquivos de teste anexados ao agente devem seguir politica propria de expurgo ou migracao controlada

## APIs

### Como funciona no modo demo

APIs funcionam com CRUD completo dentro do projeto demo isolado. O usuario pode cadastrar endpoints, parametros, campos e testar chamadas.

### O que pode fazer

- criar APIs
- editar configuracao
- testar chamadas
- vincular APIs a agentes
- excluir APIs

### O que e isolado por usuario

- definicoes de endpoint
- campos e parametros
- vinculos entre agente e API
- resultados de teste salvos em log

### O que e temporario

- resultados brutos de teste
- traces e logs de debug
- segredos temporarios informados apenas para teste

### O que sera herdado ao criar conta real

- nome
- URL
- metodo
- descricao
- campos
- parametros
- relacoes com agentes

### Regras especiais

- credenciais sensiveis usadas em testes nao devem ser persistidas como parte da demo
- se houver segredo associado, ele deve ser descartado ao expirar e revalidado na conta real

## Integracoes / Conectores

### Como funciona no modo demo

O usuario pode configurar conectores e validar fluxos do projeto demo. A estrutura do conector pode ser salva no projeto demo, mas segredos devem ter tratamento temporario.

### O que pode fazer

- criar e editar conectores
- informar configuracoes basicas
- testar conexao
- vincular conectores a agentes
- excluir conectores

### O que e isolado por usuario

- definicao do conector
- vinculo com projeto e agente
- resultados de teste

### O que e temporario

- access tokens
- refresh tokens
- client secrets
- credenciais de seller
- qualquer segredo operacional

### O que sera herdado ao criar conta real

- nome
- tipo
- endpoint base
- configuracoes nao sensiveis
- vinculos com agentes

### Regras especiais

- segredos nao devem ser herdados automaticamente
- na conversao, conectores sensiveis devem migrar sem tokens ou exigir reconexao manual

## Chat / Inbox

### Como funciona no modo demo

Chat e inbox funcionam normalmente dentro do projeto demo. O usuario pode conversar pelo widget, testar fluxos do agente e receber mensagens originadas de canais associados ao proprio projeto demo.

### O que pode fazer

- iniciar conversas
- testar respostas do agente
- usar inbox humana
- testar handoff
- visualizar anexos gerados na demo

### O que e isolado por usuario

- chats
- mensagens
- anexos
- handoffs
- estados da inbox

### O que e temporario

- historico de mensagens
- anexos temporarios
- estados de atendimento humano
- logs operacionais de conversa

### O que sera herdado ao criar conta real

- nada do historico de conversas
- nada da inbox

### Regras especiais

- mensagens podem ser reais durante a demo, inclusive originadas de WhatsApp, desde que vinculadas ao projeto demo isolado
- historico nao deve ser migrado para a conta real

## WhatsApp

### Como funciona no modo demo

WhatsApp deve permitir conexao real via QR Code no projeto demo do usuario. Cada canal criado no demo pertence apenas ao projeto demo daquele usuario e nao pode ser visivel em outra demo.

### O que pode fazer

- cadastrar canal
- gerar QR Code
- conectar numero real
- enviar e receber mensagens reais
- testar handoff e alertas
- desconectar canal

### O que e isolado por usuario

- canal WhatsApp
- numero conectado
- sessao no worker
- mensagens originadas do canal
- contatos de handoff

### O que e temporario

- sessao do WhatsApp
- QR Code
- credenciais do canal no worker
- numero conectado
- contatos de handoff criados na demo

### O que sera herdado ao criar conta real

- nada da sessao conectada
- nada do numero
- nada do QR
- nada do historico de mensagens WhatsApp

### Regras especiais

- conexao real permitida somente dentro do projeto demo isolado do usuario
- sessao deve ter TTL, recomendado em `30 minutos`
- ao expirar:
- desconectar o canal
- invalidar a sessao no worker
- limpar persistencia local e remota
- remover ou anonimizar o numero salvo
- o numero nao deve ser mantido apos conversao
- a conta real precisa exigir reconexao do WhatsApp

## Widgets / Chat do Site

### Como funciona no modo demo

Widgets funcionam integralmente no projeto demo isolado. O usuario pode criar, editar, copiar codigo e testar o chat do site vinculado ao proprio agente.

### O que pode fazer

- CRUD completo
- gerar snippet
- testar comportamento do widget
- vincular agente e configuracoes de estilo

### O que e isolado por usuario

- widgets
- slug
- configuracao visual
- vinculo com agente
- dominio configurado

### O que e temporario

- dominios ou URLs de teste criados apenas para a demo, se houver politica de expurgo

### O que sera herdado ao criar conta real

- widgets
- configuracoes visuais
- vinculos com agentes
- dados nao sensiveis de embed

### Regras especiais

- se o widget usar telefone de WhatsApp exibivel, esse telefone nao pode apontar para sessao demo expirada

## Configuracoes do Projeto

### Como funciona no modo demo

Configuracoes do projeto demo podem ser alteradas normalmente dentro do projeto isolado.

### O que pode fazer

- editar nome
- editar descricao
- editar tipo
- editar configuracoes basicas de uso
- ajustar opcoes nao sensiveis

### O que e isolado por usuario

- metadata do projeto demo
- configuracoes visuais e operacionais basicas

### O que e temporario

- configuracoes que dependam de credenciais ou sessoes externas

### O que sera herdado ao criar conta real

- nome
- descricao
- tipo
- configuracoes basicas nao sensiveis

### Regras especiais

- billing real nao deve ser herdado do demo
- configuracoes dependentes de credenciais externas devem exigir revalidacao apos conversao

## Conversao para Conta Real

Na conversao de demo para conta real, o sistema deve migrar apenas estruturas seguras e nao sensiveis do projeto demo isolado.

### O que e migrado

- agentes
- APIs
- configuracoes basicas do projeto
- widgets
- conectores sem segredos
- relacoes nao sensiveis entre objetos

### O que nao e migrado

- WhatsApp conectado
- sessoes do worker
- numeros de telefone
- QR Codes
- historico de mensagens
- inbox humana
- anexos temporarios
- tokens sensiveis
- access tokens
- refresh tokens
- client secrets

### Regra de migracao

- a conversao deve gerar um projeto real limpo ou promover o projeto demo removendo os dados sensiveis antes da promocao
- qualquer recurso externo conectado em demo deve exigir reconexao na conta real

## Expiracao da Demo

Tempo limite recomendado:

- `30 minutos` por projeto demo

Comportamento esperado ao expirar:

- bloquear novas mutacoes no projeto demo
- desconectar WhatsApp
- remover sessoes no worker
- invalidar tokens e segredos temporarios
- marcar o projeto como expirado
- opcionalmente excluir dados efemeros imediatamente
- opcionalmente excluir o projeto demo inteiro em job posterior

Cleanup automatico esperado:

- cron ou job recorrente
- varrer projetos `is_demo = true`
- identificar `demo_expires_at < now()`
- executar desconexao e purge de canais
- remover dados sensiveis
- encerrar ou excluir projeto demo

## Observacoes Tecnicas

- o frontend nao deve confiar sozinho no estado demo
- toda regra de demo precisa existir no backend
- rotas administrativas devem validar dono do projeto demo e expiracao
- recursos externos precisam de politica clara de TTL
- o projeto template nunca deve ser usado diretamente pelo usuario demo; ele serve apenas como origem de clone
- logs devem permitir auditoria de criacao, expiracao, conversao e cleanup do projeto demo

## Resumo de Implementacao Esperada

- criar projeto demo por usuario ao iniciar demonstracao
- clonar estrutura inicial de um template
- permitir CRUD real em agentes, APIs, widgets e configuracoes
- permitir WhatsApp real com sessao temporaria e cleanup obrigatorio
- manter chats e inbox funcionais apenas durante a demo
- migrar apenas estrutura segura ao converter conta
- descartar automaticamente dados sensiveis e historicos efemeros
