import { NextResponse } from "next/server";
import { cancelarAssinatura } from "@/lib/assinaturas";
import { canAccessGlobalAdmin } from "@/lib/access";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const assinatura = await cancelarAssinatura(id);

  if (!assinatura) {
    return NextResponse.json({ error: "Nao foi possivel cancelar a assinatura." }, { status: 500 });
  }

  return NextResponse.json({ assinatura }, { status: 200 });
}
