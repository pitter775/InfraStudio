import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, resolveCurrentProjectId } from "@/lib/access";
import { getIaUsageSummary } from "@/lib/ia-usage";
import { getSessionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");
  const summary = await getIaUsageSummary(user?.isMaster ? null : resolveCurrentProjectId(user), { startDate, endDate });
  return NextResponse.json({ summary }, { status: 200 });
}
