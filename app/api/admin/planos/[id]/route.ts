import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { deletePlano, setPlanoAtivo, updatePlano } from "@/lib/planos";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        nome?: string | null;
        precoMensal?: number | string | null;
        limiteTokensTotalMensal?: number | string | null;
        limiteCustoMensal?: number | string | null;
        maxAgentes?: number | string | null;
        maxApis?: number | string | null;
        maxWhatsapp?: number | string | null;
        ativo?: boolean | null;
      }
    | null;

  const plano = await updatePlano({
    id,
    nome: body?.nome,
    precoMensal: body?.precoMensal,
    limiteTokensTotalMensal: body?.limiteTokensTotalMensal,
    limiteCustoMensal: body?.limiteCustoMensal,
    maxAgentes: body?.maxAgentes,
    maxApis: body?.maxApis,
    maxWhatsapp: body?.maxWhatsapp,
    ativo: body?.ativo,
  });

  if (!plano) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o plano." }, { status: 500 });
  }

  return NextResponse.json({ plano }, { status: 200 });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { ativo?: boolean | null } | null;
  const plano = await setPlanoAtivo(id, body?.ativo === true);

  if (!plano) {
    return NextResponse.json({ error: "Nao foi possivel alterar o status do plano." }, { status: 500 });
  }

  return NextResponse.json({ plano }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await deletePlano(id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Plano nao encontrado." }, { status: 404 });
    }

    if (result.reason === "in_use") {
      return NextResponse.json({ error: "Nao e possivel excluir um plano vinculado a projetos." }, { status: 409 });
    }

    return NextResponse.json({ error: "Nao foi possivel excluir o plano." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
