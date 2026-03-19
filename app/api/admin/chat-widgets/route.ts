import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/access";
import { getAgenteById, listAgentes } from "@/lib/agentes";
import { createChatWidget, listChatWidgets, updateChatWidget } from "@/lib/chat-widgets";
import { listProjetos } from "@/lib/projetos";
import { getSessionUser } from "@/lib/session";

type ChatWidgetBody = {
  id?: string;
  nome?: string;
  slug?: string;
  projetoId?: string | null;
  agenteId?: string | null;
  dominio?: string | null;
  tema?: "dark" | "light";
  corPrimaria?: string | null;
  fundoTransparente?: boolean;
  ativo?: boolean;
};

export async function GET() {
  const user = await getSessionUser();

  if (!user?.isMaster || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const [widgets, projetos, agentes] = await Promise.all([listChatWidgets(), listProjetos(), listAgentes()]);
  return NextResponse.json({ widgets, projetos, agentes }, { status: 200 });
}

async function validateAgentProject(projetoId: string | null | undefined, agenteId: string | null | undefined) {
  if (!agenteId) {
    return null;
  }

  const agente = await getAgenteById(agenteId);
  if (!agente || agente.projetoId !== projetoId) {
    return "O agente selecionado nao pertence ao projeto informado.";
  }

  return null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user?.isMaster || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as ChatWidgetBody;

  if (!body.nome?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ error: "Nome e slug do widget sao obrigatorios." }, { status: 400 });
  }

  if (!body.projetoId) {
    return NextResponse.json({ error: "Selecione um projeto para o widget." }, { status: 400 });
  }

  const agentError = await validateAgentProject(body.projetoId, body.agenteId);
  if (agentError) {
    return NextResponse.json({ error: agentError }, { status: 400 });
  }

  const widget = await createChatWidget({
    nome: body.nome,
    slug: body.slug,
    projetoId: body.projetoId,
    agenteId: body.agenteId ?? null,
    dominio: body.dominio ?? null,
    tema: body.tema,
    corPrimaria: body.corPrimaria ?? null,
    fundoTransparente: body.fundoTransparente ?? true,
    ativo: body.ativo ?? true,
  });

  if (!widget) {
    return NextResponse.json({ error: "Nao foi possivel criar o widget." }, { status: 500 });
  }

  return NextResponse.json({ widget }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();

  if (!user?.isMaster || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as ChatWidgetBody;

  if (!body.id || !body.nome?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ error: "Id, nome e slug do widget sao obrigatorios." }, { status: 400 });
  }

  if (!body.projetoId) {
    return NextResponse.json({ error: "Selecione um projeto para o widget." }, { status: 400 });
  }

  const agentError = await validateAgentProject(body.projetoId, body.agenteId);
  if (agentError) {
    return NextResponse.json({ error: agentError }, { status: 400 });
  }

  const widget = await updateChatWidget({
    id: body.id,
    nome: body.nome,
    slug: body.slug,
    projetoId: body.projetoId,
    agenteId: body.agenteId ?? null,
    dominio: body.dominio ?? null,
    tema: body.tema,
    corPrimaria: body.corPrimaria ?? null,
    fundoTransparente: body.fundoTransparente ?? true,
    ativo: body.ativo ?? true,
  });

  if (!widget) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o widget." }, { status: 500 });
  }

  return NextResponse.json({ widget }, { status: 200 });
}
