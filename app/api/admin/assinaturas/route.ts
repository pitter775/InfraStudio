import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { createAssinatura, listAssinaturasOverview, trocarPlanoProjeto } from "@/lib/assinaturas";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const assinaturas = await listAssinaturasOverview();
  return NextResponse.json({ assinaturas }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        projetoId?: string;
        planoId?: string;
        status?: "ativo" | "cancelado" | "trial" | "suspenso";
        renovarAutomatico?: boolean | null;
        trocarPlano?: boolean | null;
      }
    | null;

  if (!body?.projetoId || !body.planoId) {
    return NextResponse.json({ error: "Projeto e plano sao obrigatorios." }, { status: 400 });
  }

  const assinatura = body.trocarPlano
    ? await trocarPlanoProjeto(body.projetoId, body.planoId)
    : await createAssinatura({
        projetoId: body.projetoId,
        planoId: body.planoId,
        status: body.status,
        renovarAutomatico: body.renovarAutomatico,
      });

  if (!assinatura) {
    return NextResponse.json({ error: "Nao foi possivel salvar a assinatura." }, { status: 500 });
  }

  return NextResponse.json({ assinatura }, { status: 201 });
}
