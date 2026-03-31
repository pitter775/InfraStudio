import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessProject } from "@/lib/access";
import { appendMessage, getChatById, listChatMessages, touchChatUpdatedAt } from "@/lib/chats";
import { getSessionUser } from "@/lib/session";

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

  const messages = await listChatMessages(id);
  return NextResponse.json({ chat, messages }, { status: 200 });
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
    }>;
  };
  const conteudo = body.conteudo?.trim() || "";
  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .map((item) => ({
          name: item.name?.trim() || "arquivo",
          type: item.type?.trim() || "application/octet-stream",
          size: typeof item.size === "number" && Number.isFinite(item.size) ? item.size : 0,
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

  await touchChatUpdatedAt(chat.id);
  return NextResponse.json({ message }, { status: 201 });
}
