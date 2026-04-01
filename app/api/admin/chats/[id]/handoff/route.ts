import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessProject } from "@/lib/access";
import { claimHumanHandoff, getChatHandoffByChatId, releaseHumanHandoff, requestHumanHandoff } from "@/lib/chat-handoffs";
import { getChatById } from "@/lib/chats";
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
  const canalWhatsappId = typeof channelContext?.channelId === "string" ? channelContext.channelId : null;

  if (body?.action === "claim") {
    const handoff = await claimHumanHandoff({
      chatId: chat.id,
      projetoId: chat.projetoId,
      usuarioId: user!.id,
      canalWhatsappId,
      motivo: body.motivo ?? null,
      metadata: body.metadata ?? null,
    });

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
