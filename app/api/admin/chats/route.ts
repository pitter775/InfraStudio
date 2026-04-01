import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessProject, resolveCurrentProjectId } from "@/lib/access";
import { listChatHandoffsByChatIds } from "@/lib/chat-handoffs";
import { listChats } from "@/lib/chats";
import { getSessionUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestedProjectId = searchParams.get("projetoId")?.trim() || null;
  const projetoId = requestedProjectId ?? (user?.isMaster ? null : resolveCurrentProjectId(user));

  if (projetoId && !user?.isMaster && !canAccessProject(user, projetoId)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const chats = await listChats(projetoId);
  const handoffsByChatId = await listChatHandoffsByChatIds(chats.map((chat) => chat.id));
  return NextResponse.json(
    {
      chats: chats.map((chat) => ({
        ...chat,
        handoff: handoffsByChatId.get(chat.id) ?? null,
      })),
    },
    { status: 200 },
  );
}
