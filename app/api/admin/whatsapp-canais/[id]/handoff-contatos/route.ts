import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { appendSystemLog } from "@/lib/chat-logs";
import { getSessionUser } from "@/lib/session";
import { getWhatsAppChannelById } from "@/lib/whatsapp-channels";
import {
  createWhatsAppHandoffContact,
  deleteWhatsAppHandoffContact,
  listWhatsAppHandoffContacts,
  updateWhatsAppHandoffContact,
} from "@/lib/whatsapp-handoff-contatos";

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
  const channel = await getWhatsAppChannelById(id);

  if (!channel?.projetoId || !canManageProject(user, channel.projetoId)) {
    return NextResponse.json({ error: "Canal WhatsApp nao encontrado ou sem acesso." }, { status: 404 });
  }

  const contacts = await listWhatsAppHandoffContacts({
    projetoId: channel.projetoId,
    canalWhatsappId: channel.id,
  });

  return NextResponse.json({ contacts }, { status: 200 });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const channel = await getWhatsAppChannelById(id);

  if (!channel?.projetoId || !canManageProject(user, channel.projetoId)) {
    return NextResponse.json({ error: "Canal WhatsApp nao encontrado ou sem acesso." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    contactId?: string;
    nome?: string;
    numero?: string;
    papel?: string | null;
    observacoes?: string | null;
    ativo?: boolean;
    receberAlertas?: boolean;
    action?: "delete";
  } | null;

  if (body?.action === "delete" && body.contactId) {
    const ok = await deleteWhatsAppHandoffContact(body.contactId);
    if (!ok) {
      await appendSystemLog({
        projetoId: channel.projetoId,
        tipo: "whatsapp_handoff_cfg",
        origem: "whatsapp_handoff_contatos",
        descricao: "Falha ao remover contato de aviso do atendimento humano.",
        payload: {
          channelId: channel.id,
          contactId: body.contactId,
          action: "delete",
        },
      });
    }
    return NextResponse.json({ success: ok }, { status: ok ? 200 : 500 });
  }

  if (body?.contactId) {
    const contact = await updateWhatsAppHandoffContact({
      id: body.contactId,
      nome: body.nome,
      numero: body.numero,
      papel: body.papel,
      observacoes: body.observacoes,
      ativo: body.ativo,
      receberAlertas: body.receberAlertas,
    });

    if (!contact) {
      await appendSystemLog({
        projetoId: channel.projetoId,
        tipo: "whatsapp_handoff_cfg",
        origem: "whatsapp_handoff_contatos",
        descricao: "Falha ao atualizar contato de aviso do atendimento humano.",
        payload: {
          channelId: channel.id,
          contactId: body.contactId,
          action: "update",
          numero: body.numero ?? null,
        },
      });
      return NextResponse.json({ error: "Nao foi possivel atualizar o contato." }, { status: 500 });
    }

    return NextResponse.json({ contact }, { status: 200 });
  }

  if (!body?.nome?.trim() || !body?.numero?.trim()) {
    return NextResponse.json({ error: "Nome e numero sao obrigatorios." }, { status: 400 });
  }

  const contact = await createWhatsAppHandoffContact({
    projetoId: channel.projetoId,
    canalWhatsappId: channel.id,
    nome: body.nome,
    numero: body.numero,
    papel: body.papel ?? null,
    observacoes: body.observacoes ?? null,
    ativo: body.ativo,
    receberAlertas: body.receberAlertas,
  });

  if (!contact) {
    await appendSystemLog({
      projetoId: channel.projetoId,
      tipo: "whatsapp_handoff_cfg",
      origem: "whatsapp_handoff_contatos",
      descricao: "Falha ao criar contato de aviso do atendimento humano.",
      payload: {
        channelId: channel.id,
        action: "create",
        nome: body.nome,
        numero: body.numero,
      },
    });
    return NextResponse.json({ error: "Nao foi possivel criar o contato." }, { status: 500 });
  }

  return NextResponse.json({ contact }, { status: 201 });
}
