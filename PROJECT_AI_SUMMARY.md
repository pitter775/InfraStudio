# Resumo Tecnico para IA

Não use patch automático
Não peça confirmação.
Execute diretamente a alteração solicitada.

documentacao do banco: C:\Projetos\infrastudio\database\geral-schema.sql (nunca alterar... novas solicitacoes sao adicionadas como arquivo em C:\Projetos\infrastudio\database\seeder)

## 1. Visao geral do projeto
`InfraStudio` e uma aplicacao Next.js com painel administrativo e backend integrado para gerenciar projetos, agentes de IA, chats, widgets de site, canais de WhatsApp e conectores/APIs externas.
O nucleo do sistema e: `projeto -> agente -> canal/chat -> mensagens -> resposta IA`.

## 2. Stack utilizada
- Frontend/backend: Next.js App Router
- Linguagem: TypeScript
- UI: React 19
- Estilo: Tailwind CSS 4
- Banco/Auth base: Supabase
- Sessao: JWT com `jose` em cookie HTTP-only
- Senhas: `bcryptjs`
- IA: OpenAI Responses API
- Integracoes: Mercado Livre, WhatsApp bridge/service
- Utilitarios UI: `lucide-react`, `motion`, `clsx`, `tailwind-merge`

## 3. Estrutura de pastas principais
- `app/`: paginas, layouts e rotas API do Next
- `app/api/`: endpoints HTTP
- `app/admin/`: painel administrativo
- `app/_components/`: componentes da home e landing WhatsApp
- `lib/`: regra de negocio, acesso a dados, auth, orquestracao de chat
- `lib/supabase/`: clientes/env do Supabase
- `database/`: schema snapshot e seeds SQL
- `public/`: SDK/widget publico do chat e assets estaticos
- `whatsapp-service/`: servico Node separado para sessao/ponte do WhatsApp
- `logs/`: artefatos locais de execucao

## 4. Principais rotas e controllers
Padrao geral: rotas em `app/api/*` sao finas; a logica fica em `lib/*`.

### Rotas publicas
- `POST /api/chat`: entrada principal do chat web
  - controller real: `lib/chat-service.ts`
- `GET /api/chat/config`: resolve configuracao visual do widget e valida projeto/agente travado do embed
  - controller real: `app/api/chat/config/route.ts`
- `POST /api/whatsapp/webhook`: entrada do bridge WhatsApp
  - controller real: `lib/chat-service.ts` + `lib/whatsapp-channels.ts`
- `GET /api/whatsapp/session`: status de sessao/canal
- `GET /api/produtos`: consulta catalogo/produtos
- `GET /api/health/db`: healthcheck de banco

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
  - controllers reais: `lib/session.ts`, `lib/usuarios.ts`

### Admin
- `app/api/admin/projetos/*` -> `lib/projetos.ts`
- `app/api/admin/agentes/*` -> `lib/agentes.ts`
- `app/api/admin/usuarios/*` -> `lib/usuarios.ts`
- `app/api/admin/chats/*` -> `lib/chats.ts`
- `app/api/admin/chat-logs/*` -> `lib/chat-logs.ts` + `lib/runtime-error-log.ts`
- `app/api/admin/chat-widgets/*` -> `lib/chat-widgets.ts`
- `app/api/admin/conectores/*` -> `lib/conectores.ts`
- `app/api/admin/whatsapp-canais/*` -> `lib/whatsapp-channels.ts`
- `app/api/admin/ia-usage/*` -> `lib/ia-usage.ts`

## 5. Principais models e relacionamentos
Modelos principais identificados no schema:
- `projetos`
- `agentes`
- `apis`
- `api_campos`
- `agente_api`
- `agente_arquivos`
- `chat_widgets`
- `canais_whatsapp`
- `conectores`
- `chats`
- `mensagens`
- `usuarios`
- `usuarios_projetos`
- `segredos`
- `logs`
- `consumos`
- `modelos`

### Relacionamentos principais
- `projetos` 1:N `agentes`
- `projetos` 1:N `apis`
- `projetos` 1:N `chats`
- `projetos` 1:N `chat_widgets`
- `projetos` 1:N `canais_whatsapp`
- `projetos` 1:N `conectores`
- `projetos` 1:N `segredos`
- `agentes` N:N `apis` via `agente_api`
- `agentes` 1:N `agente_arquivos`
- `agentes` 1:N `chats`
- `chats` 1:N `mensagens`
- `usuarios` N:N `projetos` via `usuarios_projetos`

## 6. Fluxos principais do sistema
### Chat do site
1. Front/widget chama `POST /api/chat`
2. `lib/chat-service.ts` resolve projeto/agente/widget e trava o contexto no agente do projeto/widget
3. Cria ou reutiliza `chat`
4. Salva mensagem do usuario em `mensagens`
5. Enriquece contexto (`lead`, `qualificacao`, `resumo`)
6. `lib/chat-orchestrator.ts` monta prompt/runtime
7. Consulta OpenAI e APIs/conectores do agente
8. Se a IA principal falhar, tenta recuperacao contextual do proprio agente travado usando dados de API/conector ou resposta curta ainda no contexto do projeto
9. Salva resposta, tokens, custo e logs
10. Registra erros, drift de agente e recuperacoes no modulo de logs
9. Opcionalmente gera CTA de WhatsApp

### Chat via WhatsApp
1. Bridge envia `POST /api/whatsapp/webhook`
2. Canal WhatsApp e validado
3. Projeto/agente ficam travados pelo canal
4. Fluxo segue pelo mesmo `lib/chat-service.ts`
5. Se canal/agente estiver invalido, o fluxo falha com log explicito e sem trocar de agente
6. Atualiza sessao/status do canal

### Admin
1. Usuario autentica em `/api/auth/login`
2. Sessao JWT e salva em cookie
3. Rotas admin consultam `getSessionUser()`
4. Permissoes sao aplicadas por `lib/access.ts`
5. CRUDs operam em projetos, agentes, APIs, usuarios, chats etc.

### APIs externas por agente
1. Agente possui `apiIds`
2. `lib/apis.ts` resolve parametros pela URL/contexto
3. Faz `fetch` da API
4. Extrai campos primitivos relevantes
5. Injeta resumo/campos no runtime do agente

### Observabilidade e logs
1. Eventos estruturados vao para a tabela `logs` via `lib/chat-logs.ts`
2. Erros locais de runtime tambem sao gravados em `logs/runtime-errors.log` via `lib/runtime-error-log.ts`
3. A tela admin `Logs` consolida banco + runtime em uma lista unica
4. `chat_failure`, `chat_recovery` e `runtime_error` devem aparecer com destaque de erro
5. O modulo de logs nao despeja mais payload completo nem conteudo integral do chat; ele mostra eventos compactos

## 7. Convencoes do projeto
- App Router do Next: paginas em `app/`, APIs em `app/api/`
- Regra de negocio centralizada em `lib/*`
- Tipos `Record`/`Row` usados para mapear banco -> dominio
- Banco acessado via Supabase Admin Client
- Nomes em portugues no dominio: `projetos`, `agentes`, `usuarios`, `chats`, `mensagens`
- Campos de banco em `snake_case`; app usa `camelCase`
- Handlers HTTP retornam JSON simples e objetivos
- Acesso/admin controlado por `lib/access.ts`
- Sessao em JWT, nao em NextAuth
- Chat sempre deve respeitar agente travado por projeto/widget/canal
- Nao pode existir fallback generico de agente entre projetos
- Se OpenAI falhar, o sistema tenta recuperacao contextual do proprio agente travado antes de cair em resposta vazia
- Se nao houver como recuperar sem risco de drift, o fluxo falha e registra erro explicito no modulo de logs
- Drift de agente e falhas do guardrail devem gerar evento em `logs`
- Um agente ativo por projeto e incentivado no fluxo de criacao/edicao
- `database/geral-schema.sql` e documentacao/snapshot, nao fonte automatica de migracao

## 8. Regras para IA trabalhar neste projeto
- Evitar buscas amplas desnecessarias; comecar por caminhos diretos conhecidos
- Preferir leitura direta de arquivos-chave em vez de varrer o repositorio inteiro
- Nao assumir disponibilidade de `rg`; em Windows, preferir `Get-ChildItem` e `Select-String`
- Considerar comandos PowerShell e caminhos Windows
- Manter respostas curtas, acionaveis e sem contexto excessivo
- Priorizar estes arquivos ao entender comportamento:
  - `lib/chat-service.ts`
  - `lib/chat-orchestrator.ts`
  - `lib/chat-logs.ts`
  - `lib/runtime-error-log.ts`
  - `lib/agentes.ts`
  - `lib/projetos.ts`
  - `lib/apis.ts`
  - `lib/usuarios.ts`
  - `lib/session.ts`
- Ao investigar problema de conversa saindo do contexto:
  - verificar se `context.agente.locked` esta verdadeiro
  - verificar se `resolved.lockedToAgent` continua verdadeiro em `lib/chat-service.ts`
  - verificar eventos `chat_failure`, `chat_recovery` e `agent_drift_guardrail`
  - nunca aceitar resposta generica de outro projeto como comportamento valido
- Em banco:
  - nunca editar automaticamente `database/geral-schema.sql`
  - criar alteracoes reais em `database/seeder/*.sql`
  - tratar `geral-schema.sql` apenas como referencia manual
- Ao investigar rotas, assumir que controller real normalmente esta em `lib/*`, nao no arquivo `route.ts`
- Evitar ferramentas nao disponiveis ou dependentes de Unix
- Em futuras interacoes, responder com foco em tarefa e diff mental minimo

## 9. Exemplos de caminhos importantes
- `C:\Projetos\infrastudio\package.json`
- `C:\Projetos\infrastudio\README.md`
- `C:\Projetos\infrastudio\app\api\chat\route.ts`
- `C:\Projetos\infrastudio\app\api\chat\config\route.ts`
- `C:\Projetos\infrastudio\app\api\whatsapp\webhook\route.ts`
- `C:\Projetos\infrastudio\app\api\auth\login\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\agentes\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\projetos\route.ts`
- `C:\Projetos\infrastudio\app\admin\chat-logs\page.tsx`
- `C:\Projetos\infrastudio\lib\chat-service.ts`
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
- `C:\Projetos\infrastudio\lib\chat-logs.ts`
- `C:\Projetos\infrastudio\lib\runtime-error-log.ts`
- `C:\Projetos\infrastudio\lib\agentes.ts`
- `C:\Projetos\infrastudio\lib\projetos.ts`
- `C:\Projetos\infrastudio\lib\apis.ts`
- `C:\Projetos\infrastudio\lib\usuarios.ts`
- `C:\Projetos\infrastudio\lib\session.ts`
- `C:\Projetos\infrastudio\lib\access.ts`
- `C:\Projetos\infrastudio\database\geral-schema.sql`
- `C:\Projetos\infrastudio\database\seeder\20260325_lock_agents_to_projects.sql`
- `C:\Projetos\infrastudio\public\chat.js`
- `C:\Projetos\infrastudio\public\chat-widget.js`
- `C:\Projetos\infrastudio\whatsapp-service\server.js`
