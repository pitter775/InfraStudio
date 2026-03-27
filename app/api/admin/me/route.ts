import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/access";
import { createSession, getSessionUser } from "@/lib/session";
import { getUsuarioById, updateUsuario } from "@/lib/usuarios";

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessAdmin(sessionUser)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    nome?: string;
    email?: string;
    senha?: string;
  };

  if (!body.nome?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: "Nome e email sao obrigatorios." }, { status: 400 });
  }

  const updated = await updateUsuario({
    id: sessionUser.id,
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: true,
  });

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o perfil." }, { status: 500 });
  }

  const freshUser = (await getUsuarioById(sessionUser.id)) ?? updated;
  await createSession(freshUser);

  return NextResponse.json({ user: freshUser }, { status: 200 });
}
