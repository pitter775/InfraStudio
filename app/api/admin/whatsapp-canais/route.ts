import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject, resolveCurrentProjectId } from "@/lib/access";
import { getAgenteById } from "@/lib/agentes";
import { getSessionUser } from "@/lib/session";
import { createWhatsAppChannel, listWhatsAppChannels, updateWhatsAppChannel, WhatsAppChannelError } from "@/lib/whatsapp-channels";

type WhatsAppChannelBody = {
  id?: string;
  projetoId?: string | null;
  agenteId?: string | null;
  numero?: string;
  status?: "ativo" | "inativo";
};

async function validateProjectAccess(projetoId: string | null | undefined) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return { user, error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }

  const resolvedProjectId = user?.isMaster ? projetoId ?? null : resolveCurrentProjectId(user);
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
