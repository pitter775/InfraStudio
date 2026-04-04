import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessProject } from "@/lib/access";
import { appendSystemLog } from "@/lib/chat-logs";
import { claimHumanHandoff, getChatHandoffByChatId } from "@/lib/chat-handoffs";
import { appendMessage, deleteChatConversation, getChatById, listUnifiedChatMessages, touchChatUpdatedAt } from "@/lib/chats";
import { getSessionUser } from "@/lib/session";
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

  const messages = await listUnifiedChatMessages(id);
  const handoff = await getChatHandoffByChatId(id);
  return NextResponse.json({ chat, messages, handoff }, { status: 200 });
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

  if (!user?.isMaster && !canAccessProject(user, chat.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para esta conversa." }, { status: 403 });
  }

  const body = (await request.json()) as {
    conteudo?: string;
    sentByHuman?: boolean;
    senderName?: string;
    attachments?: Array<{
      name?: string;
      type?: string;
      size?: number;
      publicUrl?: string;
      storagePath?: string;
      category?: "image" | "video" | "file";
    }>;
  };
  const conteudo = body.conteudo?.trim() || "";
  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .map((item) => ({
          name: item.name?.trim() || "arquivo",
          type: item.type?.trim() || "application/octet-stream",
          size: typeof item.size === "number" && Number.isFinite(item.size) ? item.size : 0,
          publicUrl: item.publicUrl?.trim() || null,
          storagePath: item.storagePath?.trim() || null,
          category:
            item.category === "image" || item.category === "video" || item.category === "file"
              ? item.category
              : null,
        }))
        .slice(0, 5)
    : [];
  const senderName = body.senderName?.trim() || null;
  const sentByHuman = body.sentByHuman === true;

  if (!conteudo && !attachments.length) {
    return NextResponse.json({ error: "Digite uma mensagem ou selecione um anexo." }, { status: 400 });
  }

  const message = await appendMessage({
    chatId: chat.id,
    role: "assistant",
    conteudo: conteudo || "Anexo enviado.",
    canal: chat.canal,
    identificadorExterno: chat.identificadorExterno,
    metadata: attachments.length || sentByHuman || senderName
      ? {
          ...(attachments.length ? { attachments } : {}),
          ...(sentByHuman ? { sentByHuman: true } : {}),
          ...(senderName ? { senderName } : {}),
        }
      : null,
  });

  if (!message) {
    return NextResponse.json({ error: "Nao foi possivel enviar a mensagem." }, { status: 500 });
  }

  const channelContext =
    chat.contexto && typeof chat.contexto === "object" && !Array.isArray(chat.contexto)
      ? (chat.contexto.whatsapp as { channelId?: string | null; remoteJid?: string | null; remetente?: string | null } | undefined)
      : undefined;
  const canalWhatsappId = typeof channelContext?.channelId === "string" ? channelContext.channelId : null;
  const destinatarioWhatsapp =
    typeof channelContext?.remoteJid === "string" && channelContext.remoteJid.trim()
      ? channelContext.remoteJid.trim()
      : typeof channelContext?.remetente === "string" && channelContext.remetente.trim()
        ? channelContext.remetente.trim()
      : chat.identificadorExterno ?? "";

  if (sentByHuman && chat.projetoId) {
    await claimHumanHandoff({
      chatId: chat.id,
      projetoId: chat.projetoId,
      usuarioId: user!.id,
      canalWhatsappId,
      motivo: "Atendimento assumido por mensagem manual.",
      metadata: {
        senderName,
      },
    });
  }

  if (chat.canal === "whatsapp" && canalWhatsappId && (conteudo || attachments.length)) {
    const outbound = await sendWhatsAppServiceMessage({
      channelId: canalWhatsappId,
      to: destinatarioWhatsapp,
      message: conteudo,
      attachments,
    });

    if (!outbound.ok) {
      await appendSystemLog({
        projetoId: chat.projetoId,
        tipo: "chat_whatsapp_send_error",
        origem: "admin_chat.outbound",
        descricao: outbound.error ?? "Nao foi possivel enviar a mensagem pelo whatsapp-service.",
        payload: {
          chatId: chat.id,
          channelId: canalWhatsappId,
          to: destinatarioWhatsapp,
          hasText: Boolean(conteudo),
          attachmentCount: attachments.length,
        },
      });
      return NextResponse.json({ error: outbound.error ?? "Nao foi possivel enviar no WhatsApp." }, { status: 502 });
    }

    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: "chat_whatsapp_send",
      origem: "admin_chat.outbound",
      descricao: "Mensagem manual enviada para o WhatsApp do contato.",
      payload: {
        chatId: chat.id,
        channelId: canalWhatsappId,
        to: outbound.to ?? destinatarioWhatsapp,
        hasText: Boolean(conteudo),
        attachmentCount: attachments.length,
      },
    });
  }

  await touchChatUpdatedAt(chat.id);
  return NextResponse.json({ message }, { status: 201 });
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  const result = await deleteChatConversation(chat.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Nao foi possivel remover a conversa." }, { status: 500 });
  }

  await appendSystemLog({
    projetoId: chat.projetoId,
    tipo: "chat_deleted",
    origem: "admin_chat",
    descricao: "Conversa removida manualmente pelo modulo de atendimento.",
    payload: {
      chatId: chat.id,
      canal: chat.canal,
      identificadorExterno: chat.identificadorExterno,
      removedByUsuarioId: user?.id ?? null,
    },
    skipErrorGate: true,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
