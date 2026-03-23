# whatsapp-service

Servico Node.js separado para operar o canal WhatsApp com `whatsapp-web.js`.

## Variaveis

- `PORT`: porta HTTP do servico. Padrao `3010`.
- `WHATSAPP_BACKEND_URL`: URL base do InfraStudio. Ex.: `http://localhost:3000`
- `WHATSAPP_BRIDGE_SECRET`: mesmo segredo usado pelo backend para `/api/whatsapp/session`
- `PUPPETEER_EXECUTABLE_PATH`: opcional, quando precisar apontar um Chrome/Chromium especifico

## Endpoints

- `POST /connect`
- `POST /disconnect`
- `POST /purge`
- `GET /status?channelId=...`
- `GET /qr?channelId=...`

## Fluxo

1. O admin chama `POST /connect` com `channelId`, `projetoId` e `agenteId`.
2. O servico inicializa o `Client` com `LocalAuth`.
3. Quando o evento `qr` dispara, o servico expõe o QR em `GET /qr`.
4. Ao receber mensagem valida, o servico envia para `${WHATSAPP_BACKEND_URL}/api/chat`.
5. A resposta do backend volta para o usuario via `client.sendMessage`.
