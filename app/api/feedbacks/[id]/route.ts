import { NextResponse } from "next/server";
import { canAccessWorkspace } from "@/lib/access";
import { atualizarStatusFeedback, marcarFeedbackComoLido } from "@/lib/feedbacks";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!user || !canAccessWorkspace(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const feedback = await marcarFeedbackComoLido(user, id);

  if (feedback === false) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!feedback) {
    return NextResponse.json({ error: "Feedback nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ feedback }, { status: 200 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!user || !canAccessWorkspace(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        status?: string | null;
        acao?: "reabrir" | null;
      }
    | null;

  const feedback = await atualizarStatusFeedback({
    user,
    feedbackId: id,
    status: body?.status,
    acao: body?.acao,
  });

  if (feedback === false) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!feedback) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o feedback." }, { status: 400 });
  }

  return NextResponse.json({ feedback }, { status: 200 });
}
