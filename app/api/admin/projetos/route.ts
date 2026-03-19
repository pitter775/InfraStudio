import { NextResponse } from "next/server";
import { canAccessAdmin, resolveCurrentProjectId } from "@/lib/access";
import { createProjeto, listProjetos, updateProjeto } from "@/lib/projetos";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const projetos = await listProjetos();

  if (user?.isMaster) {
    return NextResponse.json({ projetos }, { status: 200 });
  }

  const currentProjectId = resolveCurrentProjectId(user);
  return NextResponse.json(
    { projetos: projetos.filter((projeto) => projeto.id === currentProjectId) },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user?.isMaster) {
    return NextResponse.json({ error: "Apenas o master pode criar projetos." }, { status: 403 });
  }

  const body = (await request.json()) as {
    nome?: string;
    slug?: string;
    tipo?: string;
    descricao?: string;
    status?: string;
  };

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome do projeto é obrigatório." }, { status: 400 });
  }

  const projeto = await createProjeto({
    nome: body.nome,
    slug: body.slug,
    tipo: body.tipo,
    descricao: body.descricao,
    status: body.status,
  });
  if (!projeto) {
    return NextResponse.json({ error: "Não foi possível criar o projeto." }, { status: 500 });
  }

  return NextResponse.json({ projeto }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();

  if (!user?.isMaster) {
    return NextResponse.json({ error: "Apenas o master pode editar projetos." }, { status: 403 });
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
    return NextResponse.json({ error: "Id e nome do projeto são obrigatórios." }, { status: 400 });
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
    return NextResponse.json({ error: "Não foi possível atualizar o projeto." }, { status: 500 });
  }

  return NextResponse.json({ projeto }, { status: 200 });
}
