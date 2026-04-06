# InfraStudio - Guia Operacional Curto

Use este arquivo como contexto rapido para entender o projeto e executar mudancas com seguranca.

## 1. Regras obrigatorias

- repo principal: `C:\Projetos\infrastudio`
- worker WhatsApp: `C:\Projetos\whatsapp-service`
- usar Windows e PowerShell primeiro
- nao usar patch cego
- nao pedir confirmacao desnecessaria quando o caminho estiver claro

### Banco
- nunca editar automaticamente `C:\Projetos\infrastudio\database\geral-schema.sql`
- tratar `geral-schema.sql` como snapshot/manual
- toda mudanca real de banco vai em `C:\Projetos\infrastudio\database\seeder\`
- depois de aplicar no banco, o usuario atualiza `geral-schema.sql` manualmente

### Billing
- nao alterar `C:\Projetos\infrastudio\lib\billing.ts` sem pedido explicito
- nao mudar estrutura de consumo
- nao recalcular custo no frontend
- usar dados/tabelas existentes

## 2. O que o sistema e

O InfraStudio hoje tem 4 frentes ligadas:

1. painel admin de projetos, agentes, canais, APIs e uso
2. chat do site/widget travado por projeto e agente
3. WhatsApp oficial via worker Node separado
4. inbox humana com handoff, retomada da IA e anexos

## 3. Stack e arquitetura

### App principal
- Next.js App Router
- TypeScript
- React 19
- Tailwind CSS 4
- auth propria com JWT
- Supabase como banco
- OpenAI Responses API

### Worker WhatsApp
- `C:\Projetos\whatsapp-service`
- `whatsapp-web.js` + Puppeteer
- servidor esperado em `http://localhost:3010`
- health local: `http://localhost:3010/health`

### Infra
- app principal em Vercel
- worker WhatsApp separado
- comunicacao app -> worker via HTTP

## 4. Fluxo principal do chat

1. widget/worker chama backend
2. `lib/chat-service.ts` resolve projeto, agente e contexto
3. `lib/chat-orchestrator.ts` coordena heuristica, OpenAI, APIs, ML e handoff
4. resposta, uso e logs sao persistidos

## 5. Arquivos mais importantes

### Chat
- `C:\Projetos\infrastudio\lib\chat-service.ts`
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
- `C:\Projetos\infrastudio\lib\chat-openai-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-pipeline-stage.ts`
- `C:\Projetos\infrastudio\lib\chat-api-runtime.ts`
- `C:\Projetos\infrastudio\lib\chat-mercado-livre.ts`
- `C:\Projetos\infrastudio\lib\chat-handoff-policy.ts`

### Projeto/admin
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\api\admin\projetos\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\projetos\[id]\route.ts`
- `C:\Projetos\infrastudio\lib\projetos.ts`

### Atendimento
- `C:\Projetos\infrastudio\app\admin\atendimento\page.tsx`
- `C:\Projetos\infrastudio\app\api\admin\chats\route.ts`
- `C:\Projetos\infrastudio\lib\chat-attachments.ts`

### WhatsApp
- `C:\Projetos\infrastudio\lib\whatsapp-service.ts`
- `C:\Projetos\infrastudio\lib\chat-handoffs.ts`
- `C:\Projetos\whatsapp-service\server.js`

## 6. Regras praticas de mudanca

- manter `chat-orchestrator.ts` estavel quando der para resolver em camadas anteriores
- preferir ajustar `chat-service.ts` e libs auxiliares sem quebrar o pipeline atual
- UI verde no painel nao basta quando o problema envolver runtime real do WhatsApp
- inbox humana e widget do site nao sao a mesma entrega
- anexos reais existem no atendimento humano
- fonte de verdade da conversa/handoff esta em `admin/atendimento`

## 7. Testes principais

No repo principal:

```powershell
cd C:\Projetos\infrastudio
npm run lint
npm run test:chat-intelligence
npm run test:chat-intelligence:scenarios
npm run test:chat-intelligence:domains
```

## 8. Operacao local

### App
```powershell
cd C:\Projetos\infrastudio
npm run dev
```

- URL: `http://localhost:3000`

### Worker WhatsApp
```powershell
cd C:\Projetos\whatsapp-service
npm run dev
```

- URL: `http://localhost:3010`
- health: `Invoke-WebRequest -UseBasicParsing http://localhost:3010/health`

### Env importante
- `NEXT_PUBLIC_WHATSAPP_SERVICE_URL=http://localhost:3010`

## 9. Hotspots

- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\admin\atendimento\page.tsx`
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`
- `C:\Projetos\infrastudio\lib\chat-service.ts`

## 10. Lembretes finais

- qualquer mudanca de banco vai para `database/seeder`
- nao mexer automaticamente em `database/geral-schema.sql`
- worker WhatsApp e separado do app principal
- billing fica centralizado no backend
- frontend nao deve reinventar regra de custo/consumo
