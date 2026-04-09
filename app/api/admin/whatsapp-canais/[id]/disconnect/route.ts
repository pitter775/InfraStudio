import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { canDemoUserEditProject, isDemoProjectMutationBlocked } from "@/lib/demo-project-guard";
import { getSessionUser } from "@/lib/session";
import { getWhatsAppChannelById, updateWhatsAppChannelSession } from "@/lib/whatsapp-channels";

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
  const channel = await getWhatsAppChannelById(id);

  if (!channel || !channel.projetoId || (!canManageProject(user, channel.projetoId) && !await canDemoUserEditProject(user?.email, channel.projetoId))) {
    return NextResponse.json({ error: "Canal nao encontrado." }, { status: 404 });
  }

  if (await isDemoProjectMutationBlocked(user?.email, channel.projetoId)) {
    return NextResponse.json({ error: "Modo demonstracao: crie uma conta para editar e salvar." }, { status: 403 });
  }

  const updated = await updateWhatsAppChannelSession(
    id,
    {
      connectionStatus: "offline",
      qrCodeUrl: null,
      qrCodeDataUrl: null,
      qrCodeText: null,
      disconnectedAt: new Date().toISOString(),
      notes: "Canal desconectado pelo admin.",
    },
    "inativo",
  );

  return NextResponse.json({ channel: updated }, { status: 200 });
}
