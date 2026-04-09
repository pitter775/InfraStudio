import { NextResponse } from "next/server";
import { canAccessGlobalAdmin, canAccessWorkspace } from "@/lib/access";
import { FEEDBACK_CATEGORIAS, FEEDBACK_ORDENACOES, FEEDBACK_STATUSES, createFeedback, listFeedbacks } from "@/lib/feedbacks";
import { getSessionUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user || !canAccessWorkspace(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const result = await listFeedbacks({
    user,
    status: searchParams.get("status"),
    categoria: searchParams.get("categoria"),
    usuarioId: searchParams.get("usuarioId"),
    ordenacao: searchParams.get("ordenacao"),
  });

  return NextResponse.json(
    {
      escopo: canAccessGlobalAdmin(user) ? "admin" : "usuario",
      feedbacks: result.feedbacks,
      filtros: {
        statuses: FEEDBACK_STATUSES,
        categorias: FEEDBACK_CATEGORIAS,
        ordenacoes: FEEDBACK_ORDENACOES,
        usuarios: result.filtros.usuarios,
      },
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user || !canAccessWorkspace(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        projetoId?: string | null;
        assunto?: string;
        categoria?: string;
        mensagemInicial?: string;
      }
    | null;

  if (!body?.assunto?.trim() || !body?.mensagemInicial?.trim()) {
    return NextResponse.json({ error: "Assunto e mensagem inicial sao obrigatorios." }, { status: 400 });
  }

  if (!body.categoria || !FEEDBACK_CATEGORIAS.includes(body.categoria as (typeof FEEDBACK_CATEGORIAS)[number])) {
    return NextResponse.json({ error: "Categoria invalida." }, { status: 400 });
  }

  const feedback = await createFeedback({
    user,
    projetoId: body.projetoId,
    assunto: body.assunto,
    categoria: body.categoria as (typeof FEEDBACK_CATEGORIAS)[number],
    mensagemInicial: body.mensagemInicial,
  });

  if (feedback === false) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  if (!feedback) {
    return NextResponse.json({ error: "Nao foi possivel criar o feedback." }, { status: 500 });
  }

  return NextResponse.json({ feedback }, { status: 201 });
}
