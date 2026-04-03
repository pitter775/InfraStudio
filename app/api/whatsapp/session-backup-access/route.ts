import { NextResponse } from "next/server";
import { appendSystemLog } from "@/lib/chat-logs";
import {
  createWhatsAppSessionBackupDownloadAccess,
  createWhatsAppSessionBackupUploadAccess,
} from "@/lib/whatsapp-session-backup";

export const runtime = "nodejs";

function isBridgeAuthorized(request: Request) {
  const configuredSecret = process.env.WHATSAPP_BRIDGE_SECRET?.trim();
  if (!configuredSecret) {
    return false;
  }

  return request.headers.get("x-whatsapp-bridge-secret") === configuredSecret;
}

function getBackupReason(request: Request) {
  return request.headers.get("x-whatsapp-backup-reason")?.trim() || "unspecified";
}

function getBackupChannelId(request: Request) {
  return request.headers.get("x-whatsapp-channel-id")?.trim() || null;
}

export async function GET(request: Request) {
  try {
    if (!isBridgeAuthorized(request)) {
      return NextResponse.json({ error: "Bridge do WhatsApp nao autorizado." }, { status: 401 });
    }

    const access = await createWhatsAppSessionBackupDownloadAccess();
    if (!access) {
      await appendSystemLog({
        tipo: "whatsapp_backup_trace",
        origem: "whatsapp-session-backup-access",
        descricao: "Nenhum backup remoto encontrado para gerar URL assinada de download.",
        payload: {
          reason: getBackupReason(request),
          channelId: getBackupChannelId(request),
        },
        skipErrorGate: true,
      });

      return NextResponse.json({ error: "Nenhum backup remoto encontrado." }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        ...access,
      },
      { status: 200 },
    );
  } catch (error) {
    await appendSystemLog({
      tipo: "whatsapp_backup_error",
      origem: "whatsapp-session-backup-access",
      descricao: error instanceof Error ? error.message : "Falha ao gerar acesso de download do backup do WhatsApp.",
      payload: {
        reason: getBackupReason(request),
        channelId: getBackupChannelId(request),
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar acesso de download do backup do WhatsApp." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isBridgeAuthorized(request)) {
      return NextResponse.json({ error: "Bridge do WhatsApp nao autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const access = await createWhatsAppSessionBackupUploadAccess(Array.isArray(body?.files) ? body.files : []);
    return NextResponse.json(
      {
        ok: true,
        ...access,
      },
      { status: 200 },
    );
  } catch (error) {
    await appendSystemLog({
      tipo: "whatsapp_backup_error",
      origem: "whatsapp-session-backup-access",
      descricao: error instanceof Error ? error.message : "Falha ao gerar acesso de upload do backup do WhatsApp.",
      payload: {
        reason: getBackupReason(request),
        channelId: getBackupChannelId(request),
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar acesso de upload do backup do WhatsApp." },
      { status: 500 },
    );
  }
}
