import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessGlobalAdmin } from "@/lib/access";
import { getAgenteById, listAgentes } from "@/lib/agentes";
import { listApis } from "@/lib/apis";
import { createChatWidget, deleteChatWidget, getChatWidgetById, getChatWidgetByProjectAgentBinding, listChatWidgets, updateChatWidget } from "@/lib/chat-widgets";
import { listProjetos } from "@/lib/projetos";
import { getSessionUser } from "@/lib/session";

type ChatWidgetBody = {
  id?: string;
  nome?: string;
  slug?: string;
  projetoId?: string | null;
  agenteId?: string | null;
  dominio?: string | null;
  whatsappCelular?: string | null;
  tema?: "dark" | "light";
  corPrimaria?: string | null;
  fundoTransparente?: boolean;
  ativo?: boolean;
};

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user) || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const [widgets, projetos, agentes] = await Promise.all([listChatWidgets(), listProjetos(), listAgentes()]);
  const apisByProjeto = await Promise.all(
    projetos.map(async (projeto) => ({
      projetoId: projeto.id,
      apis: await listApis(projeto.id),
    })),
  );
  const apis = apisByProjeto.flatMap((item) => item.apis);

  return NextResponse.json({ widgets, projetos, agentes, apis }, { status: 200 });
}

async function validateAgentProject(projetoId: string | null | undefined, agenteId: string | null | undefined) {
  if (!agenteId) {
    return "Selecione um agente para o widget.";
  }

  const agente = await getAgenteById(agenteId);
  if (!agente || agente.projetoId !== projetoId) {
    return "O agente selecionado nao pertence ao projeto informado.";
  }

  return null;
}

async function validateWidgetBinding(projetoId: string, agenteId: string, currentId?: string) {
  const existing = await getChatWidgetByProjectAgentBinding({
    projetoId,
    agenteId,
    excludeId: currentId ?? null,
  });

  if (!existing) {
    return null;
  }

  return `O agente selecionado ja esta vinculado ao widget "${existing.nome}". Troque o agente do widget atual em vez de manter dois ao mesmo tempo.`;
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user) || !canAccessAdmin(user)) {
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

  const bindingError = await validateWidgetBinding(body.projetoId, body.agenteId!);
  if (bindingError) {
    return NextResponse.json({ error: bindingError }, { status: 409 });
  }

  const widget = await createChatWidget({
    nome: body.nome,
    slug: body.slug,
    projetoId: body.projetoId,
    agenteId: body.agenteId ?? null,
    dominio: body.dominio ?? null,
    whatsappCelular: body.whatsappCelular ?? null,
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

  if (!canAccessGlobalAdmin(user) || !canAccessAdmin(user)) {
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

  const bindingError = await validateWidgetBinding(body.projetoId, body.agenteId!, body.id);
  if (bindingError) {
    return NextResponse.json({ error: bindingError }, { status: 409 });
  }

  const widget = await updateChatWidget({
    id: body.id,
    nome: body.nome,
    slug: body.slug,
    projetoId: body.projetoId,
    agenteId: body.agenteId ?? null,
    dominio: body.dominio ?? null,
    whatsappCelular: body.whatsappCelular ?? null,
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

export async function DELETE(request: Request) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user) || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    projetoId?: string | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: "Id do widget e obrigatorio." }, { status: 400 });
  }

  const widget = await getChatWidgetById(body.id);
  if (!widget) {
    return NextResponse.json({ error: "Widget nao encontrado." }, { status: 404 });
  }

  if (!body.projetoId || widget.projetoId !== body.projetoId) {
    return NextResponse.json({ error: "Projeto invalido para excluir widget." }, { status: 403 });
  }

  const deleted = await deleteChatWidget(body.id);
  if (!deleted) {
    return NextResponse.json({ error: "Nao foi possivel excluir o widget." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
