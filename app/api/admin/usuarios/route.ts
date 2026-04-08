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
    projetoIds?: string[];
  };

  if (!body.nome || !body.email) {
    return NextResponse.json({ error: "Nome e email sao obrigatorios." }, { status: 400 });
  }

  const papel = body.papel === "admin" ? "admin" : "viewer";
  const projetoIds = Array.from(
    new Set(
      [...(Array.isArray(body.projetoIds) ? body.projetoIds : []), body.projetoId ?? null].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      ),
    ),
  );

  if (papel !== "admin" && projetoIds.length === 0) {
    return NextResponse.json({ error: "Selecione um projeto para vincular o usuario." }, { status: 400 });
  }

  const created = await createUsuario({
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: body.ativo,
    papel,
    projetoId: projetoIds[0] ?? null,
    projetoIds,
  });

  if (!created) {
    return NextResponse.json({ error: "Nao foi possivel criar o usuario." }, { status: 500 });
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
    projetoIds?: string[];
  };

  if (!body.id || !body.nome || !body.email) {
    return NextResponse.json({ error: "Id, nome e email sao obrigatorios." }, { status: 400 });
  }

  const papel = body.papel === "admin" ? "admin" : "viewer";
  const projetoIds = Array.from(
    new Set(
      [...(Array.isArray(body.projetoIds) ? body.projetoIds : []), body.projetoId ?? null].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      ),
    ),
  );

  if (papel !== "admin" && projetoIds.length === 0) {
    return NextResponse.json({ error: "Selecione um projeto para vincular o usuario." }, { status: 400 });
  }

  const updated = await updateUsuario({
    id: body.id,
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: body.ativo,
    papel,
    projetoId: projetoIds[0] ?? null,
    projetoIds,
  });

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o usuario." }, { status: 500 });
  }

  return NextResponse.json({ user: updated }, { status: 200 });
}
