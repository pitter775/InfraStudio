import { NextResponse } from "next/server";
import { canAccessWorkspace } from "@/lib/access";
import { getFeedbackResumo } from "@/lib/feedbacks";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!user || !canAccessWorkspace(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const resumo = await getFeedbackResumo(user);
  return NextResponse.json({ resumo }, { status: 200 });
}
