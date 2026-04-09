import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { getAgenteById } from "@/lib/agentes";
import {
  createConector,
  deleteConector,
  getConectorById,
  getConectorByProjetoTipo,
  listConectores,
  MERCADO_LIVRE_CONNECTOR_TYPE,
  updateConector,
  type MercadoLivreConnectorConfig,
} from "@/lib/conectores";
import { getDemoProjectMutationBlockReason } from "@/lib/demo-project-guard";
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
  const refreshToken = typeof configuracoes?.refresh_token === "string" ? configuracoes.refresh_token.trim() : "";
  const tokenExpiresAt = typeof configuracoes?.token_expires_at === "string" ? configuracoes.token_expires_at.trim() : "";
  const userId = typeof configuracoes?.user_id === "string" ? configuracoes.user_id.trim() : "";

  return {
    app_id: appId || undefined,
    client_secret: clientSecret || undefined,
    seller_id: sellerId,
    nickname: nickname || undefined,
    access_token: accessToken || undefined,
    refresh_token: refreshToken || undefined,
    token_expires_at: tokenExpiresAt || undefined,
    user_id: userId || undefined,
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

async function validateMercadoLivreProjectRule(projetoId: string, currentId?: string) {
  const existing = await getConectorByProjetoTipo({
    projetoId,
    tipo: MERCADO_LIVRE_CONNECTOR_TYPE,
    excludeId: currentId ?? null,
  });

  if (!existing) {
    return null;
  }

  return `Este projeto ja possui a integracao "${existing.nome}" do Mercado Livre. Edite a integracao atual para trocar o agente vinculado.`;
}

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projetoId = searchParams.get("projetoId")?.trim() || null;

  if (projetoId && !canManageProject(user, projetoId)) {
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

  const projectRuleError = await validateMercadoLivreProjectRule(body.projetoId);
  if (projectRuleError) {
    return NextResponse.json({ error: projectRuleError }, { status: 409 });
  }

  const createBlockReason = await getDemoProjectMutationBlockReason(user?.email, body.projetoId);
  if (createBlockReason) {
    return NextResponse.json(
      { error: createBlockReason === "DEMO_EXPIRED" ? "DEMO_EXPIRED" : "Modo demonstracao: crie uma conta para editar e salvar." },
      { status: 403 },
    );
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

  if (!body.id) {
    return NextResponse.json({ error: "Projeto invalido para atualizar conector." }, { status: 403 });
  }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome do conector e obrigatorio." }, { status: 400 });
  }

  const existingConnector = await getConectorById(body.id);
  if (!existingConnector) {
    return NextResponse.json({ error: "Conector nao encontrado." }, { status: 404 });
  }

  const projetoId = body.projetoId ?? existingConnector.projetoId;
  if (!projetoId || !canManageProject(user, projetoId)) {
    return NextResponse.json({ error: "Projeto invalido para atualizar conector." }, { status: 403 });
  }

  if (!existingConnector.projetoId || existingConnector.projetoId !== projetoId) {
    return NextResponse.json({ error: "Projeto invalido para atualizar conector." }, { status: 403 });
  }

  const agentError = await validateAgentProject(projetoId, body.agenteId);
  if (agentError) {
    return NextResponse.json({ error: agentError }, { status: 400 });
  }

  const projectRuleError = await validateMercadoLivreProjectRule(projetoId, body.id);
  if (projectRuleError) {
    return NextResponse.json({ error: projectRuleError }, { status: 409 });
  }

  const updateBlockReason = await getDemoProjectMutationBlockReason(user?.email, projetoId);
  if (updateBlockReason) {
    return NextResponse.json(
      { error: updateBlockReason === "DEMO_EXPIRED" ? "DEMO_EXPIRED" : "Modo demonstracao: crie uma conta para editar e salvar." },
      { status: 403 },
    );
  }

  const configuracoes = {
    ...normalizeMercadoLivreConfig(existingConnector.configuracoes),
    ...normalizeMercadoLivreConfig(body.configuracoes),
  };
  const conector = await updateConector({
    id: body.id,
    projetoId,
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

  const deleteBlockReason = await getDemoProjectMutationBlockReason(user?.email, body.projetoId);
  if (deleteBlockReason) {
    return NextResponse.json(
      { error: deleteBlockReason === "DEMO_EXPIRED" ? "DEMO_EXPIRED" : "Modo demonstracao: crie uma conta para editar e salvar." },
      { status: 403 },
    );
  }

  const deleted = await deleteConector(body.id);
  if (!deleted) {
    return NextResponse.json({ error: "Nao foi possivel excluir o conector." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
