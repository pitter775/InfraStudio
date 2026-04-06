import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject, resolveCurrentProjectId } from "@/lib/access";
import { createAgente, deleteAgente, getAgenteById, listAgentes, updateAgente } from "@/lib/agentes";
import { getSessionUser } from "@/lib/session";

function parseConfiguracoes(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return JSON.parse(trimmed) as Record<string, unknown>;
}

function resolveRequestedProjectId(user: Awaited<ReturnType<typeof getSessionUser>>, projetoId: string | null | undefined) {
  if (user?.role === "admin") {
    return projetoId ?? null;
  }

  const requestedProjectId = projetoId?.trim() || null;
  return requestedProjectId ?? resolveCurrentProjectId(user);
}

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const projetoId = user?.role === "admin" ? null : resolveCurrentProjectId(user);
  const agentes = await listAgentes(projetoId);
  return NextResponse.json({ agentes }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      projetoId?: string;
      slug?: string;
      nome?: string;
      descricao?: string;
      promptBase?: string;
      configuracoes?: unknown;
      ativo?: boolean;
      apiIds?: string[];
    };

    if (!body.nome?.trim()) {
      return NextResponse.json({ error: "Nome do agente é obrigatório." }, { status: 400 });
    }

    const projetoId = resolveRequestedProjectId(user, body.projetoId);
    if (!projetoId || !canManageProject(user, projetoId)) {
      return NextResponse.json({ error: "Projeto inválido para criar agente." }, { status: 403 });
    }

    const created = await createAgente({
      projetoId,
      slug: body.slug,
      nome: body.nome,
      descricao: body.descricao,
      promptBase: body.promptBase,
      configuracoes: parseConfiguracoes(body.configuracoes),
      ativo: body.ativo,
      apiIds: Array.isArray(body.apiIds) ? body.apiIds : [],
    });

    if (!created) {
      return NextResponse.json({ error: "Não foi possível criar o agente." }, { status: 500 });
    }

    return NextResponse.json({ agente: created }, { status: 201 });
  } catch (error) {
    console.error("[api/admin/agentes] failed to create agent", error);
    return NextResponse.json({ error: "Configurações inválidas. Use JSON válido." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      projetoId?: string;
      slug?: string;
      nome?: string;
      descricao?: string;
      promptBase?: string;
      configuracoes?: unknown;
      ativo?: boolean;
      apiIds?: string[];
    };

    if (!body.id || !body.nome?.trim()) {
      return NextResponse.json({ error: "Id e nome do agente são obrigatórios." }, { status: 400 });
    }

    const projetoId = resolveRequestedProjectId(user, body.projetoId);
    if (!projetoId || !canManageProject(user, projetoId)) {
      return NextResponse.json({ error: "Projeto inválido para atualizar agente." }, { status: 403 });
    }

    const updated = await updateAgente({
      id: body.id,
      projetoId,
      slug: body.slug,
      nome: body.nome,
      descricao: body.descricao,
      promptBase: body.promptBase,
      configuracoes: parseConfiguracoes(body.configuracoes),
      ativo: body.ativo,
      apiIds: Array.isArray(body.apiIds) ? body.apiIds : [],
    });

    if (!updated) {
      return NextResponse.json({ error: "Não foi possível atualizar o agente." }, { status: 500 });
    }

    return NextResponse.json({ agente: updated }, { status: 200 });
  } catch (error) {
    console.error("[api/admin/agentes] failed to update agent", error);
    return NextResponse.json({ error: "Configurações inválidas. Use JSON válido." }, { status: 400 });
  }
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
    return NextResponse.json({ error: "Id do agente e obrigatorio." }, { status: 400 });
  }

  const agente = await getAgenteById(body.id);
  if (!agente) {
    return NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
  }

  const projetoId = resolveRequestedProjectId(user, body.projetoId ?? agente.projetoId ?? undefined);
  if (!projetoId || !canManageProject(user, projetoId) || agente.projetoId !== projetoId) {
    return NextResponse.json({ error: "Projeto invalido para excluir agente." }, { status: 403 });
  }

  const deleted = await deleteAgente(body.id);
  if (!deleted) {
    return NextResponse.json({ error: "Nao foi possivel excluir o agente." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
