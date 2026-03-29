import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { getAgenteById } from "@/lib/agentes";
import {
  createConector,
  deleteConector,
  getConectorById,
  listConectores,
  MERCADO_LIVRE_CONNECTOR_TYPE,
  updateConector,
  type MercadoLivreConnectorConfig,
} from "@/lib/conectores";
import { getSessionUser } from "@/lib/session";

type ConnectorBody = {
  id?: string;
  projetoId?: string;
  agenteId?: string | null;
  nome?: string;
  tipo?: string;
  endpointBase?: string | null;
  configuracoes?: MercadoLivreConnectorConfig | null;
  ativo?: boolean;
};

function normalizeMercadoLivreConfig(configuracoes: MercadoLivreConnectorConfig | null | undefined) {
  const appId = typeof configuracoes?.app_id === "string" ? configuracoes.app_id.trim() : "";
  const clientSecret = typeof configuracoes?.client_secret === "string" ? configuracoes.client_secret.trim() : "";
  const sellerId = typeof configuracoes?.seller_id === "string" ? configuracoes.seller_id.trim() : "";
  const nickname = typeof configuracoes?.nickname === "string" ? configuracoes.nickname.trim() : "";
  const accessToken = typeof configuracoes?.access_token === "string" ? configuracoes.access_token.trim() : "";

  return {
    app_id: appId || undefined,
    client_secret: clientSecret || undefined,
    seller_id: sellerId,
    nickname: nickname || undefined,
    access_token: accessToken || undefined,
  };
}

async function validateAgentProject(projetoId: string, agenteId: string | null | undefined) {
  if (!agenteId) {
    return "Selecione um agente para o conector.";
  }

  const agente = await getAgenteById(agenteId);
  if (!agente || agente.projetoId !== projetoId) {
    return "O agente selecionado nao pertence ao projeto informado.";
  }

  return null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projetoId = searchParams.get("projetoId")?.trim() || null;

  if (projetoId && !user?.isMaster && !canManageProject(user, projetoId)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const conectores = await listConectores(projetoId);
  return NextResponse.json({ conectores }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as ConnectorBody;

  if (!body.projetoId || !canManageProject(user, body.projetoId)) {
    return NextResponse.json({ error: "Projeto invalido para criar conector." }, { status: 403 });
  }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome do conector e obrigatorio." }, { status: 400 });
  }

  if ((body.tipo?.trim() || MERCADO_LIVRE_CONNECTOR_TYPE) !== MERCADO_LIVRE_CONNECTOR_TYPE) {
    return NextResponse.json({ error: "Tipo de conector invalido." }, { status: 400 });
  }

  const agentError = await validateAgentProject(body.projetoId, body.agenteId);
  if (agentError) {
    return NextResponse.json({ error: agentError }, { status: 400 });
  }

  const configuracoes = normalizeMercadoLivreConfig(body.configuracoes);
  const conector = await createConector({
    projetoId: body.projetoId,
    agenteId: body.agenteId ?? null,
    nome: body.nome,
    tipo: MERCADO_LIVRE_CONNECTOR_TYPE,
    endpointBase: body.endpointBase ?? null,
    configuracoes,
    ativo: body.ativo ?? true,
  });

  if (!conector) {
    return NextResponse.json({ error: "Nao foi possivel criar o conector." }, { status: 500 });
  }

  return NextResponse.json({ conector }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as ConnectorBody;

  if (!body.id || !body.projetoId || !canManageProject(user, body.projetoId)) {
    return NextResponse.json({ error: "Projeto invalido para atualizar conector." }, { status: 403 });
  }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome do conector e obrigatorio." }, { status: 400 });
  }

  const agentError = await validateAgentProject(body.projetoId, body.agenteId);
  if (agentError) {
    return NextResponse.json({ error: agentError }, { status: 400 });
  }

  const configuracoes = normalizeMercadoLivreConfig(body.configuracoes);
  const conector = await updateConector({
    id: body.id,
    projetoId: body.projetoId,
    agenteId: body.agenteId ?? null,
    nome: body.nome,
    tipo: MERCADO_LIVRE_CONNECTOR_TYPE,
    endpointBase: body.endpointBase ?? null,
    configuracoes,
    ativo: body.ativo ?? true,
  });

  if (!conector) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o conector." }, { status: 500 });
  }

  return NextResponse.json({ conector }, { status: 200 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    projetoId?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "Id do conector e obrigatorio." }, { status: 400 });
  }

  const conector = await getConectorById(body.id);
  if (!conector) {
    return NextResponse.json({ error: "Conector nao encontrado." }, { status: 404 });
  }

  if (!conector.projetoId || !body.projetoId || conector.projetoId !== body.projetoId || !canManageProject(user, body.projetoId)) {
    return NextResponse.json({ error: "Projeto invalido para excluir conector." }, { status: 403 });
  }

  const deleted = await deleteConector(body.id);
  if (!deleted) {
    return NextResponse.json({ error: "Nao foi possivel excluir o conector." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
