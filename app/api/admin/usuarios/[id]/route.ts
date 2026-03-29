import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { deleteUsuario, setUsuarioAtivo } from "@/lib/usuarios";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { ativo?: boolean };

  if (typeof body.ativo !== "boolean") {
    return NextResponse.json({ error: "O campo ativo é obrigatório." }, { status: 400 });
  }

  const updated = await setUsuarioAtivo(id, body.ativo);

  if (!updated) {
    return NextResponse.json({ error: "Não foi possível atualizar o status do usuário." }, { status: 500 });
  }

  return NextResponse.json({ user: updated }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const deleted = await deleteUsuario(id);

  if (!deleted) {
    return NextResponse.json({ error: "Não foi possível excluir o usuário." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
