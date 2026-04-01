import { NextResponse } from "next/server";
import { appendSystemLog } from "@/lib/chat-logs";
import { getWhatsAppChannelById, updateWhatsAppChannelSession } from "@/lib/whatsapp-channels";

type WhatsAppSessionBody = {
  channelId?: string;
  connectionStatus?: "offline" | "aguardando_qr" | "connecting" | "online";
  qrCodeUrl?: string | null;
  qrCodeDataUrl?: string | null;
  qrCodeText?: string | null;
  notes?: string | null;
};

function isBridgeAuthorized(request: Request) {
  const configuredSecret = process.env.WHATSAPP_BRIDGE_SECRET?.trim();
  if (!configuredSecret) {
    return false;
  }

  return request.headers.get("x-whatsapp-bridge-secret") === configuredSecret;
}

function shouldAppendWhatsAppErrorLog(body: WhatsAppSessionBody) {
  if (body.connectionStatus === "offline") {
    return true;
  }

  const notes = String(body.notes || "").toLowerCase();
  return /\berro\b|\berror\b|\bfailed\b|\bfailure\b|\bexception\b|\bchrome\b|\bchromium\b|\bpuppeteer\b/.test(notes);
}

function shouldAppendWhatsAppTraceLog(body: WhatsAppSessionBody) {
  if (shouldAppendWhatsAppErrorLog(body)) {
    return false;
  }

  return body.connectionStatus === "connecting" || body.connectionStatus === "online" || body.connectionStatus === "aguardando_qr";
}

export async function POST(request: Request) {
  try {
    if (!isBridgeAuthorized(request)) {
      return NextResponse.json({ error: "Bridge do WhatsApp nao autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as WhatsAppSessionBody;

    if (!body.channelId) {
      return NextResponse.json({ error: "channelId obrigatorio." }, { status: 400 });
    }

    const channel = await getWhatsAppChannelById(body.channelId);
    if (!channel) {
      return NextResponse.json({ error: "Canal WhatsApp nao encontrado." }, { status: 404 });
    }

    const updated = await updateWhatsAppChannelSession(
      body.channelId,
      {
        connectionStatus: body.connectionStatus ?? channel.sessionData?.connectionStatus ?? "offline",
        qrCodeUrl: body.qrCodeUrl ?? channel.sessionData?.qrCodeUrl ?? null,
        qrCodeDataUrl: body.qrCodeDataUrl ?? channel.sessionData?.qrCodeDataUrl ?? null,
        qrCodeText: body.qrCodeText ?? channel.sessionData?.qrCodeText ?? null,
        notes: body.notes ?? channel.sessionData?.notes ?? null,
        connectedAt:
          body.connectionStatus === "online"
            ? channel.sessionData?.connectedAt ?? new Date().toISOString()
            : channel.sessionData?.connectedAt ?? null,
        disconnectedAt: body.connectionStatus === "offline" ? new Date().toISOString() : channel.sessionData?.disconnectedAt ?? null,
      },
      channel.status,
    );

    if (shouldAppendWhatsAppErrorLog(body)) {
      await appendSystemLog({
        projetoId: channel.projetoId,
        tipo: "whatsapp_worker_error",
        origem: "whatsapp-session",
        descricao: body.notes?.trim() || "Falha ao sincronizar sessao do worker do WhatsApp.",
        payload: {
          channelId: channel.id,
          agenteId: channel.agenteId,
          numero: channel.numero,
          connectionStatus: body.connectionStatus ?? null,
          qrAvailable: Boolean(body.qrCodeDataUrl || body.qrCodeText),
        },
      });
    } else if (shouldAppendWhatsAppTraceLog(body)) {
      await appendSystemLog({
        projetoId: channel.projetoId,
        tipo: "whatsapp_worker_trace",
        origem: "whatsapp-session",
        descricao:
          body.notes?.trim() ||
          `Worker sincronizou o canal em ${body.connectionStatus ?? "estado_desconhecido"}.`,
        payload: {
          channelId: channel.id,
          agenteId: channel.agenteId,
          numero: channel.numero,
          connectionStatus: body.connectionStatus ?? null,
          qrAvailable: Boolean(body.qrCodeDataUrl || body.qrCodeText),
        },
        skipErrorGate: true,
      });
    }

    return NextResponse.json({ channel: updated }, { status: 200 });
  } catch (error) {
    console.error("[whatsapp-session] failed to sync session", error);
    await appendSystemLog({
      tipo: "whatsapp_session_error",
      origem: "whatsapp-session",
      descricao: error instanceof Error ? error.message : "Nao foi possivel sincronizar a sessao do WhatsApp.",
      payload: null,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel sincronizar a sessao do WhatsApp." },
      { status: 500 },
    );
  }
}
