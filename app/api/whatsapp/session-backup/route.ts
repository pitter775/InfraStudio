import { NextResponse } from "next/server";
import { appendSystemLog } from "@/lib/chat-logs";
import {
  downloadWhatsAppSessionBackup,
  getWhatsAppSessionBackupConfig,
  uploadWhatsAppSessionBackup,
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

function getBackupContext(request: Request, extras?: Record<string, unknown> | null) {
  const config = getWhatsAppSessionBackupConfig();

  return {
    reason: getBackupReason(request),
    channelId: getBackupChannelId(request),
    bucketName: config.bucketName,
    objectPath: config.objectPath,
    configuredFileSizeLimit: config.fileSizeLimit,
    ...(extras ?? {}),
  };
}

export async function GET(request: Request) {
  try {
    if (!isBridgeAuthorized(request)) {
      return NextResponse.json({ error: "Bridge do WhatsApp nao autorizado." }, { status: 401 });
    }

    const backup = await downloadWhatsAppSessionBackup();
    if (!backup) {
      await appendSystemLog({
        tipo: "whatsapp_backup_trace",
        origem: "whatsapp-session-backup",
        descricao: "Worker tentou restaurar backup automatico, mas nenhum arquivo salvo foi encontrado.",
        payload: getBackupContext(request),
        skipErrorGate: true,
      });

      return NextResponse.json({ error: "Nenhum backup salvo para a sessao do WhatsApp." }, { status: 404 });
    }

    await appendSystemLog({
      tipo: "whatsapp_backup_trace",
      origem: "whatsapp-session-backup",
      descricao: "Backend entregou o backup automatico da sessao do WhatsApp para o worker.",
      payload: {
        reason: getBackupReason(request),
        channelId: getBackupChannelId(request),
        bucketName: backup.bucketName,
        objectPath: backup.objectPath,
        configuredFileSizeLimit: backup.fileSizeLimit,
        size: backup.buffer.byteLength,
      },
      skipErrorGate: true,
    });

    return new NextResponse(backup.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="whatsapp-session-backup.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[whatsapp-session-backup] failed to download backup", error);
    await appendSystemLog({
      tipo: "whatsapp_backup_error",
      origem: "whatsapp-session-backup",
      descricao: error instanceof Error ? error.message : "Falha ao entregar backup da sessao do WhatsApp.",
      payload: getBackupContext(request),
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao baixar backup da sessao do WhatsApp.",
        ...getBackupContext(request),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let requestSize = 0;

  try {
    if (!isBridgeAuthorized(request)) {
      return NextResponse.json({ error: "Bridge do WhatsApp nao autorizado." }, { status: 401 });
    }

    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    requestSize = buffer.byteLength;

    if (!buffer.byteLength) {
      return NextResponse.json({ error: "Arquivo zip obrigatorio." }, { status: 400 });
    }

    const result = await uploadWhatsAppSessionBackup(buffer);

    await appendSystemLog({
      tipo: "whatsapp_backup_trace",
      origem: "whatsapp-session-backup",
      descricao: "Worker salvou backup automatico da sessao do WhatsApp no storage externo.",
      payload: {
        reason: getBackupReason(request),
        channelId: getBackupChannelId(request),
        bucketName: result.bucketName,
        objectPath: result.objectPath,
        configuredFileSizeLimit: result.fileSizeLimit,
        requestSize,
        size: result.size,
      },
      skipErrorGate: true,
    });

    return NextResponse.json(
      {
        ok: true,
        bucketName: result.bucketName,
        objectPath: result.objectPath,
        configuredFileSizeLimit: result.fileSizeLimit,
        requestSize,
        size: result.size,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[whatsapp-session-backup] failed to upload backup", error);
    await appendSystemLog({
      tipo: "whatsapp_backup_error",
      origem: "whatsapp-session-backup",
      descricao: error instanceof Error ? error.message : "Falha ao salvar backup da sessao do WhatsApp.",
      payload: getBackupContext(request, {
        requestSize,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Falha ao salvar backup da sessao do WhatsApp.",
      }),
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao salvar backup da sessao do WhatsApp.",
        ...getBackupContext(request, {
          requestSize,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
      },
      { status: 500 },
    );
  }
}
