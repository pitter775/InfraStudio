import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { listAgentes } from "@/lib/agentes";
import { listChats } from "@/lib/chats";
import { listProjetos } from "@/lib/projetos";
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

  if (!user?.isMaster && !canManageProject(user, id)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const [projetos, agentes, chats] = await Promise.all([listProjetos(), listAgentes(id), listChats(id)]);
  const projeto = projetos.find((item) => item.id === id) ?? null;

  if (!projeto) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  return NextResponse.json(
    {
      projeto,
      agentes,
      chats,
      stats: {
        totalAgentes: agentes.length,
        agenteAtivoId: agentes.find((agente) => agente.ativo)?.id ?? null,
        totalChats: chats.length,
      },
    },
    { status: 200 },
  );
}
