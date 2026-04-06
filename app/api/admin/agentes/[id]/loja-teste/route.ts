import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { getAgenteById } from "@/lib/agentes";
import { appendSystemLog } from "@/lib/chat-logs";
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
    await appendSystemLog({
      tipo: "admin_agente_loja_teste_forbidden",
      origem: "api_admin_agente_loja_teste",
      descricao: "Acesso negado ao abrir o teste da loja do agente.",
      payload: {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        role: user?.role ?? null,
      },
    });
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const agente = await getAgenteById(id);

  if (!agente) {
    return NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
  }

  if (!agente.projetoId || !canManageProject(user, agente.projetoId)) {
    await appendSystemLog({
      tipo: "admin_agente_loja_teste_forbidden",
      origem: "api_admin_agente_loja_teste",
      descricao: "Acesso negado ao testar a loja de um agente fora do projeto gerenciado.",
      payload: {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        agenteId: agente.id,
        projetoId: agente.projetoId ?? null,
      },
    });
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const result = await listarProdutosRecentesMercadoLivrePorAgente(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
