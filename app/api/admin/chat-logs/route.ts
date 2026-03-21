import { NextResponse } from "next/server";
import { canAccessAdmin, resolveCurrentProjectId } from "@/lib/access";
import { listRecentChatLogs } from "@/lib/chat-logs";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const logs = await listRecentChatLogs(user?.isMaster ? null : resolveCurrentProjectId(user), 80);
  return NextResponse.json({ logs }, { status: 200 });
}
