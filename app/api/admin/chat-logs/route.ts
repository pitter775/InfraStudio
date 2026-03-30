import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { listRecentSystemLogs } from "@/lib/chat-logs";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const logs = await listRecentSystemLogs(null, 160);
  return NextResponse.json({ logs }, { status: 200 });
}
