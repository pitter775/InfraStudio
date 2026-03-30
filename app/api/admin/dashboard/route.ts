import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/access";
import { getDashboardOverview } from "@/lib/dashboard";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessAdmin(user) || !user) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const overview = await getDashboardOverview(user);
  return NextResponse.json(overview, { status: 200 });
}
