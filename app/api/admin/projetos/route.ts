import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { createProjetoForUsuario, listProjetos, listProjetosByUsuario, updateProjeto } from "@/lib/projetos";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const projetos = user?.isMaster ? await listProjetos() : await listProjetosByUsuario(user!.id);
  return NextResponse.json({ projetos }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    nome?: string;
    slug?: string;
    tipo?: string;
    descricao?: string;
    status?: string;
  };

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome do projeto e obrigatorio." }, { status: 400 });
  }

  const projeto = await createProjetoForUsuario({
    usuarioId: user.id,
    nome: body.nome,
    slug: body.slug,
    tipo: body.tipo,
    descricao: body.descricao,
    status: body.status,
  });

  if (!projeto) {
    return NextResponse.json({ error: "Nao foi possivel criar o projeto." }, { status: 500 });
  }

  return NextResponse.json({ projeto }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();

  if (!user || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    nome?: string;
    slug?: string;
    tipo?: string;
    descricao?: string;
    status?: string;
  };

  if (!body.id || !body.nome?.trim()) {
    return NextResponse.json({ error: "Id e nome do projeto sao obrigatorios." }, { status: 400 });
  }

  if (!canManageProject(user, body.id)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const projeto = await updateProjeto({
    id: body.id,
    nome: body.nome,
    slug: body.slug,
    tipo: body.tipo,
    descricao: body.descricao,
    status: body.status,
  });

  if (!projeto) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o projeto." }, { status: 500 });
  }

  return NextResponse.json({ projeto }, { status: 200 });
}
