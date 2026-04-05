import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessProject } from "@/lib/access";
import { claimHumanHandoff, getChatHandoffByChatId, releaseHumanHandoff, requestHumanHandoff } from "@/lib/chat-handoffs";
import { getChatById, getUnifiedWhatsAppOutboundContext } from "@/lib/chats";
import { appendSystemLog } from "@/lib/chat-logs";
import { getSessionUser } from "@/lib/session";
import { getWhatsAppHandoffContactById } from "@/lib/whatsapp-handoff-contatos";
import { getPreferredWhatsAppChannel, getWhatsAppChannelByProject } from "@/lib/whatsapp-channels";
import { sendWhatsAppServiceMessage } from "@/lib/whatsapp-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const chat = await getChatById(id);

  if (!chat) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  if (!user?.isMaster && !canAccessProject(user, chat.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para esta conversa." }, { status: 403 });
  }

  const handoff = await getChatHandoffByChatId(chat.id);
  return NextResponse.json({ handoff }, { status: 200 });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const chat = await getChatById(id);

  if (!chat) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  if (!chat.projetoId || (!user?.isMaster && !canAccessProject(user, chat.projetoId))) {
    return NextResponse.json({ error: "Acesso negado para esta conversa." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: "request" | "claim" | "release";
    motivo?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;

  const channelContext =
    chat.contexto && typeof chat.contexto === "object" && !Array.isArray(chat.contexto)
      ? (chat.contexto.whatsapp as { channelId?: string | null } | undefined)
      : undefined;
  const linkedHandoffContactId =
    body?.metadata &&
    typeof body.metadata === "object" &&
    !Array.isArray(body.metadata) &&
    typeof body.metadata.handoffContactId === "string" &&
    body.metadata.handoffContactId.trim()
      ? body.metadata.handoffContactId.trim()
      : null;

  const unifiedWhatsAppContext = await getUnifiedWhatsAppOutboundContext(chat.id);
  const currentHandoff = await getChatHandoffByChatId(chat.id);
  const preferredChannel =
    !unifiedWhatsAppContext?.channelId && chat.projetoId
      ? await getPreferredWhatsAppChannel({ projetoId: chat.projetoId, agenteId: chat.agenteId })
      : null;
  const projectChannel =
    !unifiedWhatsAppContext?.channelId && !preferredChannel && chat.projetoId
      ? await getWhatsAppChannelByProject({ projetoId: chat.projetoId })
      : null;
  const canalWhatsappId =
    (typeof channelContext?.channelId === "string" ? channelContext.channelId : null) ??
    unifiedWhatsAppContext?.channelId ??
    currentHandoff?.canalWhatsappId ??
    preferredChannel?.id ??
    projectChannel?.id ??
    null;

  const destinatarioWhatsapp = unifiedWhatsAppContext?.to ?? chat.identificadorExterno ?? "";

  const notifyCustomerAboutHumanClaim = async () => {
    if (!canalWhatsappId || !destinatarioWhatsapp) {
      await appendSystemLog({
        projetoId: chat.projetoId,
        tipo: "chat_human_claim_notify_skipped",
        origem: "admin_chat.handoff",
        descricao: "Aviso ao cliente foi pulado porque faltou contexto de canal ou destinatario no WhatsApp.",
        payload: {
          chatId: chat.id,
          channelId: canalWhatsappId,
          to: destinatarioWhatsapp || null,
          handoffContactId: linkedHandoffContactId,
          hasChannelId: Boolean(canalWhatsappId),
          hasRecipient: Boolean(destinatarioWhatsapp),
        },
        skipErrorGate: true,
      });
      return;
    }

    const handoffContact = linkedHandoffContactId
      ? await getWhatsAppHandoffContactById(linkedHandoffContactId)
      : null;
    const attendantName =
      handoffContact?.nome?.trim() ||
      user?.name?.trim()?.split(/\s+/)[0] ||
      "um atendente";
    const message =
      attendantName === "um atendente"
        ? "Oi! Um atendente humano vai assumir seu atendimento por aqui agora. Enquanto leio o historico, ja sigo com voce."
        : `Oi! Aqui e ${attendantName}. Vou assumir seu atendimento por aqui agora. Enquanto leio o historico, ja sigo com voce.`;

    const result = await sendWhatsAppServiceMessage({
      channelId: canalWhatsappId,
      to: destinatarioWhatsapp,
      message,
    });

    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: result.ok ? "chat_human_claim_notified" : "chat_human_claim_notify_error",
      origem: "admin_chat.handoff",
      descricao: result.ok
        ? "Cliente avisado no WhatsApp sobre a entrada do atendente humano."
        : result.error ?? "Falha ao avisar o cliente sobre a entrada do atendente humano.",
      payload: {
        chatId: chat.id,
        channelId: canalWhatsappId,
        to: destinatarioWhatsapp,
        target: result.ok ? result.target ?? null : null,
        handoffContactId: linkedHandoffContactId,
        attendantName,
      },
      skipErrorGate: true,
    });
  };

  if (body?.action === "claim") {
    const shouldNotifyCustomer = currentHandoff?.status !== "human";
    const handoff = await claimHumanHandoff({
      chatId: chat.id,
      projetoId: chat.projetoId,
      usuarioId: user!.id,
      canalWhatsappId,
      motivo: body.motivo ?? null,
      metadata: body.metadata ?? null,
    });

    if (shouldNotifyCustomer) {
      await notifyCustomerAboutHumanClaim();
    } else {
      await appendSystemLog({
        projetoId: chat.projetoId,
        tipo: "chat_human_claim_notify_skipped",
        origem: "admin_chat.handoff",
        descricao: "Aviso ao cliente foi pulado porque o atendimento humano ja estava assumido.",
        payload: {
          chatId: chat.id,
          channelId: canalWhatsappId,
          to: destinatarioWhatsapp || null,
          handoffContactId: linkedHandoffContactId,
          previousStatus: currentHandoff?.status ?? null,
        },
        skipErrorGate: true,
      });
    }

    return NextResponse.json({ handoff }, { status: 200 });
  }

  if (body?.action === "release") {
    const handoff = await releaseHumanHandoff({
      chatId: chat.id,
      projetoId: chat.projetoId,
      usuarioId: user?.id ?? null,
      motivo: body.motivo ?? null,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json({ handoff }, { status: 200 });
  }

  const handoff = await requestHumanHandoff({
    chatId: chat.id,
    projetoId: chat.projetoId,
    canalWhatsappId,
    requestedBy: "human",
    requestedByUsuarioId: user?.id ?? null,
    motivo: body?.motivo ?? null,
    metadata: body?.metadata ?? null,
  });

  return NextResponse.json({ handoff }, { status: 200 });
}
