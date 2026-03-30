import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { getIaUsageSummary, getTokenUsageOverview } from "@/lib/ia-usage";
import { getSessionUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user || !canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (startDate && endDate) {
    const summary = await getIaUsageSummary(null, { startDate, endDate });
    return NextResponse.json({ summary }, { status: 200 });
  }

  const overview = await getTokenUsageOverview(user);
  return NextResponse.json({ overview }, { status: 200 });
}
