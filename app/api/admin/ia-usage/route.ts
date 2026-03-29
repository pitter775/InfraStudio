import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { getTokenUsageOverview } from "@/lib/ia-usage";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!user || !canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const overview = await getTokenUsageOverview(user);
  return NextResponse.json({ overview }, { status: 200 });
}
