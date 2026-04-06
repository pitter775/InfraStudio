import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessGlobalAdmin, canManageProject, resolveCurrentProjectId } from "@/lib/access";
import { getAgenteById } from "@/lib/agentes";
import { getSessionUser } from "@/lib/session";
import { createWhatsAppChannel, deleteWhatsAppChannel, getWhatsAppChannelById, getWhatsAppChannelByProject, listWhatsAppChannels, updateWhatsAppChannel, WhatsAppChannelError } from "@/lib/whatsapp-channels";

type WhatsAppChannelBody = {
  id?: string;
  projetoId?: string | null;
  agenteId?: string | null;
  numero?: string;
  status?: "ativo" | "inativo";
};

function resolveRequestedProjectId(user: Awaited<ReturnType<typeof getSessionUser>>, projetoId: string | null | undefined) {
  if (canAccessGlobalAdmin(user)) {
    return projetoId ?? null;
  }

  const requestedProjectId = projetoId?.trim() || null;
  return requestedProjectId ?? resolveCurrentProjectId(user);
}

async function validateProjectAccess(projetoId: string | null | undefined) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return { user, error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }

  const resolvedProjectId = resolveRequestedProjectId(user, projetoId);
  if (!resolvedProjectId || !canManageProject(user, resolvedProjectId)) {
    return { user, error: NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 }) };
  }

  return { user, projetoId: resolvedProjectId, error: null };
}

async function validateAgentProject(projetoId: string, agenteId: string | null | undefined) {
  if (!agenteId) {
    return null;
  }

  const agente = await getAgenteById(agenteId);
  if (!agente || agente.projetoId !== projetoId) {
    return "O agente selecionado nao pertence ao projeto informado.";
  }

  return null;
}

async function validateWhatsAppProjectRule(projetoId: string, currentId?: string) {
  const existing = await getWhatsAppChannelByProject({
    projetoId,
    excludeId: currentId ?? null,
  });

  if (!existing) {
    return null;
  }

  return `Este projeto ja possui um canal WhatsApp (${existing.numero}). Edite o canal existente para trocar o agente, sem manter dois ao mesmo tempo.`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projetoId = searchParams.get("projetoId");
  const access = await validateProjectAccess(projetoId);
  if (access.error) {
    return access.error;
  }

  const channels = await listWhatsAppChannels(access.projetoId);
  return NextResponse.json({ channels }, { status: 200 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as WhatsAppChannelBody;
  const access = await validateProjectAccess(body.projetoId);
  if (access.error) {
    return access.error;
  }

  if (!body.numero?.trim()) {
    return NextResponse.json({ error: "Numero obrigatorio." }, { status: 400 });
  }

  const agentError = await validateAgentProject(access.projetoId!, body.agenteId);
  if (agentError) {
    return NextResponse.json({ error: agentError }, { status: 400 });
  }

  const projectRuleError = await validateWhatsAppProjectRule(access.projetoId!);
  if (projectRuleError) {
    return NextResponse.json({ error: projectRuleError }, { status: 409 });
  }

  try {
    const channel = await createWhatsAppChannel({
      projetoId: access.projetoId!,
      agenteId: body.agenteId ?? null,
      numero: body.numero,
      status: body.status ?? "ativo",
    });

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    const message = error instanceof WhatsAppChannelError ? error.message : "Nao foi possivel criar o canal WhatsApp.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json()) as WhatsAppChannelBody;

  if (!body.id) {
    return NextResponse.json({ error: "Id do canal obrigatorio." }, { status: 400 });
  }

  const access = await validateProjectAccess(body.projetoId);
  if (access.error) {
    return access.error;
  }

  if (!body.numero?.trim()) {
    return NextResponse.json({ error: "Numero obrigatorio." }, { status: 400 });
  }

  const agentError = await validateAgentProject(access.projetoId!, body.agenteId);
  if (agentError) {
    return NextResponse.json({ error: agentError }, { status: 400 });
  }

  const projectRuleError = await validateWhatsAppProjectRule(access.projetoId!, body.id);
  if (projectRuleError) {
    return NextResponse.json({ error: projectRuleError }, { status: 409 });
  }

  try {
    const channel = await updateWhatsAppChannel({
      id: body.id,
      projetoId: access.projetoId!,
      agenteId: body.agenteId ?? null,
      numero: body.numero,
      status: body.status ?? "ativo",
    });

    return NextResponse.json({ channel }, { status: 200 });
  } catch (error) {
    const message = error instanceof WhatsAppChannelError ? error.message : "Nao foi possivel atualizar o canal WhatsApp.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    projetoId?: string | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: "Id do canal obrigatorio." }, { status: 400 });
  }

  const channel = await getWhatsAppChannelById(body.id);
  if (!channel) {
    return NextResponse.json({ error: "Canal WhatsApp nao encontrado." }, { status: 404 });
  }

  const access = await validateProjectAccess(body.projetoId ?? channel.projetoId);
  if (access.error) {
    return access.error;
  }

  if (channel.projetoId !== access.projetoId) {
    return NextResponse.json({ error: "Projeto invalido para excluir canal WhatsApp." }, { status: 403 });
  }

  try {
    await deleteWhatsAppChannel(body.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof WhatsAppChannelError ? error.message : "Nao foi possivel excluir o canal WhatsApp.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
