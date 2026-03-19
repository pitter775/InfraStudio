import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { getChatById, listChatMessages } from "@/lib/chats";
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
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  if (!user?.isMaster && !canManageProject(user, chat.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para esta conversa." }, { status: 403 });
  }

  const messages = await listChatMessages(id);
  return NextResponse.json({ chat, messages }, { status: 200 });
}
