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
- login sempre pelo backend (`/api/auth/login`)
- sem modo demo/mock no client

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

### Worker WhatsApp
- repo separado: `C:\Projetos\whatsapp-service`
- stack: `whatsapp-web.js` + Puppeteer
- local: `http://localhost:3010`
- health local: `http://localhost:3010/health`
- health publico atual: `https://servidornode-production-c17f.up.railway.app/health`
- deploy separado na Railway
- sessao deve persistir por volume via `WHATSAPP_STORAGE_DIR`

## 5. Fluxos que importam

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
