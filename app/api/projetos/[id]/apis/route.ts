import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { createApi, listApis } from "@/lib/apis";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;

  if (!canManageProject(user, id)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const apis = await listApis(id);
  return NextResponse.json({ apis }, { status: 200 });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;

  if (!canManageProject(user, id)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const body = (await request.json()) as {
    nome?: string;
    url?: string;
    metodo?: string;
    descricao?: string;
    ativo?: boolean;
    campos?: Array<{
      nome?: string;
      tipo?: "string" | "number" | "boolean";
      descricao?: string | null;
    }>;
  };

  if (!body.nome?.trim() || !body.url?.trim()) {
    return NextResponse.json({ error: "Nome e URL da API sao obrigatorios." }, { status: 400 });
  }

  if (body.metodo && body.metodo.trim().toUpperCase() !== "GET") {
    return NextResponse.json({ error: "Somente APIs GET sao permitidas neste momento." }, { status: 400 });
  }

  const api = await createApi({
    projetoId: id,
    nome: body.nome,
    url: body.url,
    metodo: "GET",
    descricao: body.descricao,
    ativo: body.ativo,
    campos: Array.isArray(body.campos)
      ? body.campos
          .filter((campo) => campo?.nome && campo?.tipo)
          .map((campo) => ({
            nome: String(campo.nome),
            tipo: campo.tipo as "string" | "number" | "boolean",
            descricao: campo.descricao ?? null,
          }))
      : [],
  });

  if (!api) {
    return NextResponse.json({ error: "Nao foi possivel criar a API." }, { status: 500 });
  }

  return NextResponse.json({ api }, { status: 201 });
}
