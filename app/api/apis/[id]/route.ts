import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { deleteApi, getApiById, updateApi } from "@/lib/apis";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const currentApi = await getApiById(id);

  if (!currentApi) {
    return NextResponse.json({ error: "API nao encontrada." }, { status: 404 });
  }

  if (!canManageProject(user, currentApi.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para esta API." }, { status: 403 });
  }

  const body = (await request.json()) as {
    nome?: string;
    url?: string;
    metodo?: string;
    descricao?: string;
    ativo?: boolean;
    parametros?: Array<{
      nome?: string;
      tipo?: "string" | "number" | "boolean";
      obrigatorio?: boolean;
    }>;
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

  const api = await updateApi({
    id,
    nome: body.nome,
    url: body.url,
    metodo: "GET",
    descricao: body.descricao,
    ativo: body.ativo,
    parametros: Array.isArray(body.parametros)
      ? body.parametros
          .filter((parametro) => parametro?.nome && parametro?.tipo)
          .map((parametro) => ({
            nome: String(parametro.nome),
            tipo: parametro.tipo as "string" | "number" | "boolean",
            obrigatorio: parametro.obrigatorio === true,
          }))
      : [],
    campos: Array.isArray(body.campos)
      ? body.campos
          .filter((campo) => campo?.nome && campo?.tipo)
          .map((campo) => ({
            nome: String(campo.nome),
            tipo: campo.tipo as "string" | "number" | "boolean",
            descricao: campo.descricao ?? null,
          }))
      : undefined,
  });

  if (!api) {
    return NextResponse.json({ error: "Nao foi possivel atualizar a API." }, { status: 500 });
  }

  return NextResponse.json({ api }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const currentApi = await getApiById(id);

  if (!currentApi) {
    return NextResponse.json({ error: "API nao encontrada." }, { status: 404 });
  }

  if (!canManageProject(user, currentApi.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para esta API." }, { status: 403 });
  }

  const deleted = await deleteApi(id);
  if (!deleted) {
    return NextResponse.json({ error: "Nao foi possivel excluir a API." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
