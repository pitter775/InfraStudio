import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { listBillingUsageByProject } from "@/lib/billing-access";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const uso = await listBillingUsageByProject();
  return NextResponse.json({ uso }, { status: 200 });
}
