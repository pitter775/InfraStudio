import { NextResponse } from "next/server";
import { canAccessAdmin, resolveCurrentProjectId } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { createUsuario, listUsuarios, listUsuariosByProjeto, updateUsuario } from "@/lib/usuarios";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const usuarios = user?.isMaster ? await listUsuarios() : await listUsuariosByProjeto(resolveCurrentProjectId(user) ?? "");
  return NextResponse.json({ users: usuarios }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!user?.isMaster) {
    return NextResponse.json({ error: "Apenas o master pode criar usuarios no momento." }, { status: 403 });
  }

  const body = (await request.json()) as {
    nome?: string;
    email?: string;
    senha?: string;
    ativo?: boolean;
  };

  if (!body.nome || !body.email) {
    return NextResponse.json({ error: "Nome e email são obrigatórios." }, { status: 400 });
  }

  const created = await createUsuario({
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: body.ativo,
  });

  if (!created) {
    return NextResponse.json({ error: "Não foi possível criar o usuário." }, { status: 500 });
  }

  return NextResponse.json({ user: created }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!user?.isMaster) {
    return NextResponse.json({ error: "Apenas o master pode editar usuarios no momento." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    nome?: string;
    email?: string;
    senha?: string;
    ativo?: boolean;
  };

  if (!body.id || !body.nome || !body.email) {
    return NextResponse.json({ error: "Id, nome e email são obrigatórios." }, { status: 400 });
  }

  const updated = await updateUsuario({
    id: body.id,
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: body.ativo,
  });

  if (!updated) {
    return NextResponse.json({ error: "Não foi possível atualizar o usuário." }, { status: 500 });
  }

  return NextResponse.json({ user: updated }, { status: 200 });
}
