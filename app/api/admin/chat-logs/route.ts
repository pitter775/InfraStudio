import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { clearAllSystemLogs, listRecentSystemLogs } from "@/lib/chat-logs";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const logs = await listRecentSystemLogs(null, 500);
  return NextResponse.json({ logs }, { status: 200 });
}

export async function DELETE() {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const cleared = await clearAllSystemLogs();
  if (!cleared) {
    return NextResponse.json({ error: "Nao foi possivel remover todos os logs. Verifique permissao da tabela logs e tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
