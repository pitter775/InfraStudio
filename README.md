# InfraStudio

Painel e backend de projetos, agentes e canais de chat da InfraStudio.

## Chat SDK

O widget agora opera em modo host-controlled. O script expoe a API global para a aplicacao hospedeira decidir quando montar, atualizar, ocultar e destruir, mas o visual rico do chat continua sendo responsabilidade do proprio SDK.

### Carregamento do SDK

```html
<script
  src="https://infrastudio.vercel.app/chat.js"
  data-projeto="abc123"
  data-agente="imoveis"
></script>
```

### API global

```html
<script>
  InfraChat.mount({
    projeto: "abc123",
    agente: "imoveis",
    apiBase: "https://infrastudio.vercel.app",
    strictHostControl: true,
    context: {
      route: { path: window.location.pathname },
      client: { id: "tenant-a" },
      resource: { id: "imovel-123" }
    },
    policy: {
      allowed: true,
      allowedRoutes: ["/imoveis/*"]
    }
  });
</script>
```

### Regras

- `mount(...)` e obrigatorio para criar o chat.
- `data-projeto` e `data-agente` podem servir como default, mas nao causam auto-inicializacao.
- O SDK usa JavaScript puro e funciona em HTML, React, Vue e Angular.
- `InfraChat.updateContext(...)` invalida o contexto anterior e aplica o novo.
- `InfraChat.destroy()` remove root, listeners, timers, observers, controllers e o estado visual em memoria.
- O SDK nunca se auto-recria depois de `destroy()`.
- Eventos de debug: `mounted`, `context_updated`, `hidden`, `destroyed`, `blocked_by_route`, `blocked_by_policy`.
- Tema, cor, titulo e transparencia podem vir do backend ou do contexto enviado pelo cliente.
- O modo host-controlled nao implica UI minimalista: o `chat.js` mantem launcher, painel, cabecalho, digitacao e renderizacao rica de mensagens/arquivos.

### Backend

- `POST /api/chat` recebe `projeto`, `agente`, `message`, `chatId` e `context`.
- `GET /api/chat/config` resolve a configuracao visual do canal com base em `projeto` e `agente`.
- O schema de referencia do banco esta em [database/geral-schema.sql](./database/geral-schema.sql).

## Desenvolvimento

### Requisitos

- Node.js

### Rodando localmente

```bash
npm install
npm run dev
```
