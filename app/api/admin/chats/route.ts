import { NextResponse } from "next/server";
import { canAccessAdmin, resolveCurrentProjectId } from "@/lib/access";
import { listChats } from "@/lib/chats";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const chats = await listChats(user?.isMaster ? null : resolveCurrentProjectId(user));
  return NextResponse.json({ chats }, { status: 200 });
}
