import { NextResponse } from "next/server";
import { processIncomingChatMessage } from "@/lib/chat-service";
import { getWhatsAppChannelById, updateWhatsAppChannelSession } from "@/lib/whatsapp-channels";

type WhatsAppWebhookBody = {
  channelId?: string;
  numero?: string;
  message?: string;
  context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

function isBridgeAuthorized(request: Request) {
  const configuredSecret = process.env.WHATSAPP_BRIDGE_SECRET?.trim();
  if (!configuredSecret) {
    return false;
  }

  return request.headers.get("x-whatsapp-bridge-secret") === configuredSecret;
}

export async function POST(request: Request) {
  try {
    if (!isBridgeAuthorized(request)) {
      return NextResponse.json({ error: "Bridge do WhatsApp nao autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as WhatsAppWebhookBody;

    if (!body.channelId || !body.message?.trim()) {
      return NextResponse.json({ error: "channelId e message sao obrigatorios." }, { status: 400 });
    }

    const channel = await getWhatsAppChannelById(body.channelId);

    if (!channel || !channel.projetoId) {
      return NextResponse.json({ error: "Canal WhatsApp nao encontrado." }, { status: 404 });
    }

    const numero = String(body.numero || "").replace(/\D/g, "");
    if (!numero) {
      return NextResponse.json({ error: "Numero do remetente obrigatorio." }, { status: 400 });
    }

    await updateWhatsAppChannelSession(channel.id, {
      connectionStatus: "online",
      lastInboundAt: new Date().toISOString(),
      worker: "whatsapp-bridge",
    });

    const result = await processIncomingChatMessage({
      message: body.message,
      projeto: channel.projetoId,
      agente: channel.agenteId ?? undefined,
      canal: "whatsapp",
      identificadorExterno: numero,
      whatsappChannelId: channel.id,
      source: "whatsapp_webhook",
      context: {
        ...(body.context ?? {}),
        whatsapp: {
          channelId: channel.id,
          numeroCanal: channel.numero,
          remetente: numero,
          metadata: body.metadata ?? null,
        },
      },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[whatsapp-webhook] failed to process message", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel processar a mensagem do WhatsApp." },
      { status: 500 },
    );
  }
}
