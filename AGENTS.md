# InfraStudio - contexto rapido

Usar este arquivo como contexto curto para entender e evoluir o projeto com seguranca.

## 1. Regras fixas

- repo principal: `C:\Projetos\infrastudio`
- worker WhatsApp: `C:\Projetos\whatsapp-service`
- usar Windows e PowerShell primeiro
- executar direto quando o caminho estiver claro
- nao usar patch cego

### Banco
- nunca editar automaticamente `C:\Projetos\infrastudio\database\geral-schema.sql`
- tratar `geral-schema.sql` como snapshot manual
- mudanca real de banco vai em `C:\Projetos\infrastudio\database\seeder\`

### Billing
- modelo atual: `planos + billing + consumo por tokens`
- nao voltar logica de assinaturas
- tela principal de gestao: `C:\Projetos\infrastudio\app\admin\planos\page.tsx`
- nao recalcular custo no frontend
- billing fica centralizado no backend
- evitar mexer em `C:\Projetos\infrastudio\lib\billing.ts` sem necessidade clara
- politica atual de limite: ao atingir o limite o projeto deve bloquear novas interacoes; avisos e fluxos mais sofisticados ficam para depois

## 2. Realidade atual

InfraStudio hoje opera 4 frentes:

1. painel admin de projetos, agentes, planos, canais, APIs e atendimento
2. chat do site/widget por projeto e agente
3. WhatsApp oficial via worker Node separado
4. inbox humana com handoff, retomada da IA e anexos

Perfis atuais:
- `admin` = acesso global
- `viewer` = usuario comum por projeto
- nao usar mais logica de `master`

Auth atual:
- auth propria com JWT
- login/sessao sempre pelo backend (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`)
- cadastro manual com backend em `/api/auth/register`
- login social via OAuth hoje suporta `google`, `github` e `facebook`
- `instagram` ja existe no modal, mas ainda nao tem backend OAuth funcional
- existe modo demonstracao real no client e no backend
- o modo demo bloqueia mutacoes persistentes e empurra conversao para login/cadastro

## 3. Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase para banco/storage/logs
- `jose` + `bcryptjs`
- OpenAI Responses API

## 4. Infra real

### App
- deploy principal na Vercel
- local: `http://localhost:3000`

### Demo / onboarding
- existe fluxo de demonstracao com usuario demo real
- entrada principal demo hoje passa por `C:\Projetos\infrastudio\app\nova_home\nova-home-client.tsx`
- criacao/conversao demo usa:
  - `C:\Projetos\infrastudio\app\api\auth\demo-create\route.ts`
  - `C:\Projetos\infrastudio\app\api\auth\demo-convert\route.ts`
- helper de demo e bloqueio:
  - `C:\Projetos\infrastudio\lib\demo-user.ts`
  - `C:\Projetos\infrastudio\lib\demo-conversion.ts`
  - `C:\Projetos\infrastudio\lib\demo-project-guard.ts`

### Worker WhatsApp
- repo separado: `C:\Projetos\whatsapp-service`
- stack: `whatsapp-web.js` + Puppeteer
- local: `http://localhost:3010`
- health local: `http://localhost:3010/health`
- health publico atual: `https://servidornode-production-c17f.up.railway.app/health`
- deploy separado na Railway
- sessao deve persistir por volume via `WHATSAPP_STORAGE_DIR`

## 5. Fluxos que importam

### Auth / onboarding
1. homepage abre `AuthModal` com login e cadastro manual
2. login manual chama `/api/auth/login`
3. cadastro manual chama `/api/auth/register`
4. login social usa `/api/auth/oauth/start` + `/api/auth/oauth/callback`
5. provedores ativos hoje no backend: Google, GitHub e Facebook
6. Instagram ainda esta so na interface e precisa backend antes de funcionar de verdade

### Demonstracao
1. `nova_home` cria ou reaproveita um email demo em localStorage
2. client tenta login do usuario demo
3. se nao existir, cria via `/api/auth/demo-create`
4. usuario entra em projeto demo real
5. mutacoes sensiveis ficam bloqueadas no frontend e backend
6. ao tentar salvar/editar, o sistema pede login/cadastro para converter o demo

### Chat
1. widget/worker chama backend
2. `lib/chat-service.ts` resolve projeto, agente e contexto
3. `lib/chat-orchestrator.ts` coordena heuristica, IA, APIs e handoff
4. resposta, uso e logs sao persistidos

### WhatsApp
1. worker recebe a mensagem
2. backend reutiliza o pipeline do chat
3. worker devolve a resposta
4. painel consulta QR/status no worker
5. sessao precisa sobreviver a restart/deploy via volume

### Handoff/inbox
1. handoff abre no backend
2. atendimento humano acontece em `admin/atendimento`
3. anexos reais existem hoje nessa inbox
4. `Liberar para IA` devolve o chat ao assistente

## 6. Arquivos centrais

### Auth / demo
- `C:\Projetos\infrastudio\app\_components\home\login-modal.tsx`
- `C:\Projetos\infrastudio\app\_components\home\home-page-client.tsx`
- `C:\Projetos\infrastudio\app\nova_home\nova-home-client.tsx`
- `C:\Projetos\infrastudio\lib\auth.ts`
- `C:\Projetos\infrastudio\lib\auth-service.ts`
- `C:\Projetos\infrastudio\lib\social-oauth.ts`
- `C:\Projetos\infrastudio\app\api\auth\oauth\start\route.ts`
- `C:\Projetos\infrastudio\app\api\auth\oauth\callback\route.ts`
- `C:\Projetos\infrastudio\app\api\auth\demo-create\route.ts`
- `C:\Projetos\infrastudio\app\api\auth\demo-convert\route.ts`

### Chat
- `C:\Projetos\infrastudio\lib\chat-service.ts`
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`

### Atendimento
- `C:\Projetos\infrastudio\app\admin\atendimento\page.tsx`
- `C:\Projetos\infrastudio\app\api\admin\chats\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\chats\[id]\route.ts`
- `C:\Projetos\infrastudio\lib\chat-attachments.ts`

### Projeto/admin
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\api\admin\projetos\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\projetos\[id]\route.ts`
- `C:\Projetos\infrastudio\lib\projetos.ts`

### Billing/planos
- `C:\Projetos\infrastudio\app\admin\planos\page.tsx`
- `C:\Projetos\infrastudio\app\api\admin\planos\route.ts`
- `C:\Projetos\infrastudio\lib\billing.ts`
- `C:\Projetos\infrastudio\lib\planos.ts`

### WhatsApp
- `C:\Projetos\infrastudio\lib\whatsapp-service.ts`
- `C:\Projetos\infrastudio\lib\whatsapp-handoff-alerts.ts`
- `C:\Projetos\infrastudio\lib\whatsapp-handoff-contatos.ts`
- `C:\Projetos\infrastudio\lib\chat-handoffs.ts`
- `C:\Projetos\whatsapp-service\server.js`

### Logs
- `C:\Projetos\infrastudio\lib\chat-logs.ts`
- `C:\Projetos\infrastudio\app\admin\chat-logs\page.tsx`

## 7. Hotspots

- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\admin\atendimento\page.tsx`
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
- `C:\Projetos\infrastudio\lib\chat-service.ts`

## 8. Regras praticas

- preservar WhatsApp funcional antes de refatorar fundo
- manter `chat-orchestrator.ts` estavel quando der para resolver antes
- preferir ajustes em `chat-service.ts` e libs auxiliares
- UI verde no painel nao prova runtime real do WhatsApp
- widget do site e inbox humana nao sao a mesma entrega
- a fonte de verdade de conversa/handoff esta em `admin/atendimento`
- quando mexer em auth, conferir manual + social + demo
- nao assumir que o texto da UI define a verdade; checar se o backend do provider existe
- se mexer em demo, validar bloqueio de mutacao no frontend e no backend
- instagram no auth ainda e placeholder visual; nao tratar como provider pronto
- facebook continua provider valido no backend mesmo se a UI mudar

### Ao investigar WhatsApp
- validar painel
- validar `admin/chat-logs`
- validar `/health` do worker
- conferir `storageDir`, `authDir` e `storedChannels`
- conferir persistencia em `WHATSAPP_STORAGE_DIR` ou `sessions/`

## 9. Validacao local

```powershell
cd C:\Projetos\infrastudio
npm run lint
npm run test:chat-intelligence
npm run test:chat-intelligence:scenarios
npm run test:chat-intelligence:domains
```

Validacao manual recomendada quando mexer em auth/demo:
- login manual
- cadastro manual
- login social com Google/GitHub/Facebook
- fluxo demo em `nova_home`
- bloqueio de edicao no modo demo
- conversao de demo para conta real

```powershell
cd C:\Projetos\whatsapp-service
npm run dev
```

Env local importante:
- `NEXT_PUBLIC_WHATSAPP_SERVICE_URL=http://localhost:3010`

## 10. Nao esquecer

- sem dependencia ativa de assinaturas
- nao recriar tela paralela para billing
- qualquer mudanca de banco vai para `database/seeder`
- nao mexer automaticamente no `geral-schema.sql`
- se o problema envolver WhatsApp, checar app + worker + logs
- modo demonstracao existe e e parte real do produto
- login social atual do backend: Google, GitHub e Facebook
- Instagram no modal ainda nao significa suporte backend
