import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { listAgentes } from "@/lib/agentes";
import { listApis } from "@/lib/apis";
import { listChatWidgets } from "@/lib/chat-widgets";
import { listChats } from "@/lib/chats";
import { listConectores } from "@/lib/conectores";
import { listProjetos } from "@/lib/projetos";
import { getSessionUser } from "@/lib/session";
import { listWhatsAppChannels } from "@/lib/whatsapp-channels";

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

  const [projetos, agentes, chats, apis, allWidgets, whatsappChannels, conectores] = await Promise.all([
    listProjetos(),
    listAgentes(id),
    listChats(id),
    listApis(id),
    listChatWidgets(),
    listWhatsAppChannels(id),
    listConectores(id),
  ]);
  const projeto = projetos.find((item) => item.id === id) ?? null;
  const widgets = allWidgets.filter((widget) => widget.projetoId === id);

  if (!projeto) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  return NextResponse.json(
    {
      projeto,
      agentes,
      apis,
      conectores,
      widgets,
      whatsappChannels,
      chats,
      stats: {
        totalAgentes: agentes.length,
        agenteAtivoId: agentes.find((agente) => agente.ativo)?.id ?? null,
        totalApis: apis.length,
        totalConectores: conectores.length,
        totalWidgets: widgets.length,
        totalWhatsAppChannels: whatsappChannels.length,
        totalChats: chats.length,
      },
    },
    { status: 200 },
  );
}
