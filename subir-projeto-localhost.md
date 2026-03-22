# Subir O Projeto Localhost

## Projeto principal

Abra um terminal PowerShell e rode:

```powershell
PS C:\Users\pitte> cd C:\Projetos\infrastudio\InfraStudio
PS C:\Projetos\infrastudio\InfraStudio> npm run dev
```

Depois abra no navegador:

```text
http://localhost:3000
```

## WhatsApp Service

Abra outro terminal PowerShell separado e rode:

```powershell
PS C:\Users\pitte> cd C:\Projetos\infrastudio\InfraStudio\whatsapp-service
PS C:\Projetos\infrastudio\InfraStudio\whatsapp-service> npm run dev
```

O servico do WhatsApp fica em:

```text
http://localhost:3010
```

Para testar se ele esta no ar:

```powershell
PS C:\Users\pitte> Invoke-WebRequest -UseBasicParsing http://localhost:3010/health
```

## Variavel de ambiente importante

No arquivo [`.env.local`](C:\Projetos\infrastudio\InfraStudio\.env.local), garantir esta linha:

```env
NEXT_PUBLIC_WHATSAPP_SERVICE_URL=http://localhost:3010
```

## Ordem recomendada

1. Subir o projeto principal na porta `3000`.
2. Subir o `whatsapp-service` na porta `3010`.
3. Abrir o painel admin em `http://localhost:3000`.
4. Ir na aba de WhatsApp do projeto e clicar em conectar.

## Se a porta 3000 ja estiver em uso

Ver o PID:

```powershell
PS C:\Projetos\infrastudio\InfraStudio> netstat -ano | Select-String ":3000"
```

Matar o processo:

```powershell
PS C:\Projetos\infrastudio\InfraStudio> taskkill /PID 3012 /F
```

Depois subir de novo:

```powershell
PS C:\Projetos\infrastudio\InfraStudio> npm run dev
```

## Se a porta 3010 ja estiver em uso

Ver o PID:

```powershell
PS C:\Projetos\infrastudio\InfraStudio> netstat -ano | Select-String ":3010"
```

Matar o processo:

```powershell
PS C:\Projetos\infrastudio\InfraStudio> taskkill /PID 4824 /F
```

Depois subir de novo:

```powershell
PS C:\Projetos\infrastudio\InfraStudio\whatsapp-service> npm run dev
```

## Criterios do servidor para o WhatsApp

O `whatsapp-service` precisa de um servidor que atenda estes pontos:

- rodar Node.js continuamente, sem desligar a cada requisicao
- permitir processo HTTP persistente
- ter armazenamento local ou volume persistente para manter a sessao do WhatsApp
- conseguir abrir Chrome/Chromium em modo headless via `whatsapp-web.js`
- permitir variaveis de ambiente
- manter a porta HTTP publica ou acessivel para o painel consultar `status` e `qr`

### Por que isso importa

O `whatsapp-service` nao e uma funcao simples de request/response.
Ele precisa:

- manter a sessao autenticada
- guardar os dados de `LocalAuth`
- continuar conectado mesmo depois do QR
- receber eventos do WhatsApp em tempo real

Se o servidor dormir, reiniciar sem persistencia ou matar o processo com frequencia, a conexao pode cair e o QR pode precisar ser gerado de novo.

## Por que Railway atende

O Railway atende bem esse caso porque normalmente oferece:

- deploy de app Node sem muita configuracao
- processo rodando de forma continua
- configuracao simples de variaveis de ambiente
- porta exposta para o servico HTTP
- possibilidade de usar volume/disco persistente, quando necessario
- operacao mais simples para um worker separado como o `whatsapp-service`

### Resumo pratico

Para esse projeto, o Railway atende porque o `whatsapp-service` precisa ser um processo Node dedicado e persistente, e nao apenas uma API stateless.
