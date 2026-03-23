import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { getAgenteById } from "@/lib/agentes";
import { listarProdutosRecentesMercadoLivrePorAgente } from "@/lib/mercado-livre";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const agente = await getAgenteById(id);

  if (!agente) {
    return NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
  }

  if (!agente.projetoId || !canManageProject(user, agente.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const result = await listarProdutosRecentesMercadoLivrePorAgente(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
