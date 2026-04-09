import { NextResponse } from "next/server";
import { canAccessWorkspace } from "@/lib/access";
import { adicionarMensagemFeedback } from "@/lib/feedbacks";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!user || !canAccessWorkspace(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        mensagem?: string;
        statusAdmin?: string | null;
      }
    | null;

  if (!body?.mensagem?.trim()) {
    return NextResponse.json({ error: "Mensagem obrigatoria." }, { status: 400 });
  }

  const feedback = await adicionarMensagemFeedback({
    user,
    feedbackId: id,
    mensagem: body.mensagem,
    statusAdmin: body.statusAdmin,
  });

  if (feedback === false) {
    return NextResponse.json({ error: "Nao foi possivel enviar mensagem para este feedback." }, { status: 403 });
  }

  if (!feedback) {
    return NextResponse.json({ error: "Nao foi possivel enviar a mensagem." }, { status: 500 });
  }

  return NextResponse.json({ feedback }, { status: 201 });
}
