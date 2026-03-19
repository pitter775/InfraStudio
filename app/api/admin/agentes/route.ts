import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject, resolveCurrentProjectId } from "@/lib/access";
import { createAgente, listAgentes, updateAgente } from "@/lib/agentes";
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

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const projetoId = user?.isMaster ? null : resolveCurrentProjectId(user);
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

    const projetoId = user?.isMaster ? body.projetoId ?? null : resolveCurrentProjectId(user);
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

    const projetoId = user?.isMaster ? body.projetoId ?? null : resolveCurrentProjectId(user);
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
