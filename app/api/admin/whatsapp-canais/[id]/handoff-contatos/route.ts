import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { appendSystemLog } from "@/lib/chat-logs";
import { getSessionUser } from "@/lib/session";
import { getWhatsAppChannelById } from "@/lib/whatsapp-channels";
import { sendWhatsAppHandoffTestAlert } from "@/lib/whatsapp-handoff-alerts";
import { areSameBrazilWhatsAppPhone } from "@/lib/whatsapp-phone";
import {
  createWhatsAppHandoffContact,
  deleteWhatsAppHandoffContact,
  listWhatsAppHandoffContacts,
  WhatsAppHandoffContactError,
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

  try {
    const contacts = await listWhatsAppHandoffContacts({
      projetoId: channel.projetoId,
      canalWhatsappId: channel.id,
    });

    return NextResponse.json({ contacts }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof WhatsAppHandoffContactError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Nao foi possivel carregar os contatos de aviso.";

    await appendSystemLog({
      projetoId: channel.projetoId,
      tipo: "whatsapp_handoff_error",
      origem: "whatsapp_handoff_contatos",
      descricao: "Erro ao carregar contatos de aviso do atendimento humano.",
      payload: {
        channelId: channel.id,
        action: "list",
        error: message,
      },
      skipErrorGate: true,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    action?: "delete" | "test";
  } | null;

  if (body?.action === "test") {
    try {
      const result = await sendWhatsAppHandoffTestAlert({
        projetoId: channel.projetoId,
        projetoNome: null,
        canalWhatsappId: channel.id,
        channelNumber: channel.numero,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Nao foi possivel enviar o teste de alerta." }, { status: 400 });
      }

      return NextResponse.json({ success: true, sent: result.sent, failures: result.failures }, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel enviar o teste de alerta.";

      await appendSystemLog({
        projetoId: channel.projetoId,
        tipo: "whatsapp_handoff_error",
        origem: "whatsapp_handoff_contatos",
        descricao: "Erro ao enviar teste do alerta de atendimento humano.",
        payload: {
          channelId: channel.id,
          action: "test",
          error: message,
        },
        skipErrorGate: true,
      });

      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (body?.action === "delete" && body.contactId) {
    const ok = await deleteWhatsAppHandoffContact(body.contactId);
    if (!ok) {
      await appendSystemLog({
        projetoId: channel.projetoId,
        tipo: "whatsapp_handoff_error",
        origem: "whatsapp_handoff_contatos",
        descricao: "Erro ao remover contato de aviso do atendimento humano.",
        payload: {
          channelId: channel.id,
          contactId: body.contactId,
          action: "delete",
        },
        skipErrorGate: true,
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
        tipo: "whatsapp_handoff_error",
        origem: "whatsapp_handoff_contatos",
        descricao: "Erro ao atualizar contato de aviso do atendimento humano.",
        payload: {
          channelId: channel.id,
          contactId: body.contactId,
          action: "update",
          numero: body.numero ?? null,
        },
        skipErrorGate: true,
      });
      return NextResponse.json({ error: "Nao foi possivel atualizar o contato." }, { status: 500 });
    }

    return NextResponse.json({ contact }, { status: 200 });
  }

  if (!body?.nome?.trim() || !body?.numero?.trim()) {
    return NextResponse.json({ error: "Nome e numero sao obrigatorios." }, { status: 400 });
  }

  if (areSameBrazilWhatsAppPhone(channel.numero, body.numero)) {
    return NextResponse.json(
      {
        error:
          "Use um numero diferente do canal principal. Se o mesmo numero receber o alerta, o WhatsApp pode gerar auto-mensagem no proprio canal.",
      },
      { status: 400 },
    );
  }

  try {
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

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof WhatsAppHandoffContactError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Nao foi possivel criar o contato.";

    await appendSystemLog({
      projetoId: channel.projetoId,
      tipo: "whatsapp_handoff_error",
      origem: "whatsapp_handoff_contatos",
      descricao: "Erro ao criar contato de aviso do atendimento humano.",
      payload: {
        channelId: channel.id,
        action: "create",
        nome: body.nome,
        numero: body.numero,
        error: message,
      },
      skipErrorGate: true,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
