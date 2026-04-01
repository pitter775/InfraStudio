import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
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

  if (!channel || !channel.projetoId || !canManageProject(user, channel.projetoId)) {
    return NextResponse.json({ error: "Canal nao encontrado." }, { status: 404 });
  }

  const updated = await updateWhatsAppChannelSession(
    id,
    {
      connectionStatus: "aguardando_qr",
      qrCodeUrl: null,
      qrCodeDataUrl: null,
      qrCodeText: channel.sessionData?.qrCodeText ?? null,
      notes: 'Clique em "Gerar QR Code" para iniciar a conexao deste numero.',
    },
    "ativo",
  );

  return NextResponse.json({ channel: updated }, { status: 200 });
}
