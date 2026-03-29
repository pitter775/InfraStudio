import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { createUsuario, listUsuarios, updateUsuario } from "@/lib/usuarios";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const usuarios = await listUsuarios();
  return NextResponse.json({ users: usuarios }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    nome?: string;
    email?: string;
    senha?: string;
    ativo?: boolean;
    papel?: "admin" | "viewer";
    projetoId?: string | null;
  };

  if (!body.nome || !body.email) {
    return NextResponse.json({ error: "Nome e email são obrigatórios." }, { status: 400 });
  }

  if (!body.projetoId) {
    return NextResponse.json({ error: "Selecione um projeto para vincular o usuario." }, { status: 400 });
  }

  const created = await createUsuario({
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: body.ativo,
    papel: body.papel,
    projetoId: body.projetoId,
  });

  if (!created) {
    return NextResponse.json({ error: "Não foi possível criar o usuário." }, { status: 500 });
  }

  return NextResponse.json({ user: created }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    nome?: string;
    email?: string;
    senha?: string;
    ativo?: boolean;
    papel?: "admin" | "viewer";
    projetoId?: string | null;
  };

  if (!body.id || !body.nome || !body.email) {
    return NextResponse.json({ error: "Id, nome e email são obrigatórios." }, { status: 400 });
  }

  if (!body.projetoId) {
    return NextResponse.json({ error: "Selecione um projeto para vincular o usuario." }, { status: 400 });
  }

  const updated = await updateUsuario({
    id: body.id,
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: body.ativo,
    papel: body.papel,
    projetoId: body.projetoId,
  });

  if (!updated) {
    return NextResponse.json({ error: "Não foi possível atualizar o usuário." }, { status: 500 });
  }

  return NextResponse.json({ user: updated }, { status: 200 });
}
