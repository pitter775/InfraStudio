import { NextResponse } from "next/server";
import { appendSystemLog } from "@/lib/chat-logs";
import { getWhatsAppChannelById } from "@/lib/whatsapp-channels";

export const runtime = "nodejs";

type WorkerLogBody = {
  channelId?: string | null;
  projetoId?: string | null;
  tipo?: string;
  origem?: string;
  descricao?: string;
  payload?: Record<string, unknown> | null;
  level?: "info" | "error";
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

    const body = (await request.json()) as WorkerLogBody;
    const channelId = body.channelId?.trim() || null;
    const channel = channelId ? await getWhatsAppChannelById(channelId) : null;
    const projetoId = body.projetoId?.trim() || channel?.projetoId || null;
    const isError = body.level === "error";

    await appendSystemLog({
      projetoId,
      tipo: body.tipo?.trim() || (isError ? "whatsapp_worker_error" : "whatsapp_worker_trace"),
      origem: body.origem?.trim() || "whatsapp-worker",
      descricao: body.descricao?.trim() || "Worker do WhatsApp enviou um log operacional.",
      payload: {
        ...(body.payload ?? {}),
        channelId,
        agenteId: channel?.agenteId || null,
        numero: channel?.numero || null,
      },
      skipErrorGate: !isError,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[whatsapp-worker-log] failed to append worker log", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar log do worker do WhatsApp." },
      { status: 500 },
    );
  }
}
