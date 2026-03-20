# InfraStudio

Painel e backend de projetos, agentes e canais de chat da InfraStudio.

## Chat SDK

O novo padrao de embed do chat e fixo no frontend e dinamico no backend.

### Embed obrigatorio

```html
<script
  src="https://infrastudio.vercel.app/chat.js"
  data-projeto="abc123"
  data-agente="imoveis"
></script>
```

### API global

O script expõe `window.InfraChat` automaticamente.

```html
<script>
  InfraChat.setContext({
    id: "uuid-123",
    cidade: "sp",
    cor: "#586"
  });
</script>
```

### Regras

- `data-projeto` e `data-agente` sao obrigatorios.
- O SDK usa JavaScript puro e funciona em HTML, React, Vue e Angular.
- O chat inicializa sozinho ao carregar o script.
- `InfraChat.setContext(...)` aceita multiplas chamadas e faz merge raso do contexto.
- Se `setContext` for chamado cedo, o SDK guarda os dados em fila interna e aplica quando terminar o load.
- Tema, cor, titulo e transparencia nao ficam fixos no snippet. Eles podem vir do backend ou do contexto enviado pelo cliente.

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
